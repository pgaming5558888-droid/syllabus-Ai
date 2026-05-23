import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Send, X, Volume2, VolumeX, Bot, Loader2, StopCircle } from "lucide-react";

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    if (n === "google us english") return 100;
    if (n.includes("google") && n.includes("uk english female")) return 96;
    if (n.includes("google") && n.includes("uk english male")) return 92;
    if (n.includes("google") && v.lang.startsWith("en")) return 88;
    if (n.includes("microsoft") && (n.includes("aria") || n.includes("jenny") || n.includes("guy"))) return 82;
    if (n.includes("microsoft") && v.lang === "en-US") return 72;
    if (n.includes("microsoft") && v.lang.startsWith("en")) return 66;
    if (v.lang === "en-US") return 50;
    if (v.lang === "en-GB") return 46;
    if (v.lang === "en-IN") return 42;
    if (v.lang.startsWith("en")) return 30;
    return 0;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function speakText(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const say = () => {
    const u = new SpeechSynthesisUtterance(text.slice(0, 800));
    u.rate = 0.88; u.pitch = 1.05; u.volume = 1.0;
    const v = pickBestVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };
  window.speechSynthesis.getVoices().length > 0
    ? say()
    : window.speechSynthesis.addEventListener("voiceschanged", say, { once: true });
}

interface Message { role: "user" | "assistant"; content: string; typing?: boolean; }

export function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen && !conversationId && !isCreatingRef.current) {
      isCreatingRef.current = true;
      fetch("/api/openai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "AI Tutor Session" }),
      })
        .then(r => r.json())
        .then(conv => setConversationId(String(conv.id)))
        .catch(() => { isCreatingRef.current = false; });
    }
    if (!isOpen) { window.speechSynthesis?.cancel(); setIsSpeaking(false); }
  }, [isOpen, conversationId]);

  const handleSendText = useCallback(async () => {
    const q = textInput.trim();
    if (!q || !conversationId || isSending) return;
    setTextInput(""); setIsSending(true);
    setMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: "", typing: true }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: q }),
        signal: ctrl.signal,
      });
      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let full = "";
      let done = false;
      while (!done) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (value) {
          for (const line of dec.decode(value).split("\n\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                full += data.content;
                setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: full, typing: true }; return n; });
              }
              if (data.done) {
                setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: full, typing: false }; return n; });
                if (speakEnabled && full.trim()) {
                  setIsSpeaking(true); speakText(full);
                  setTimeout(() => setIsSpeaking(false), Math.min(Math.max(2000, (full.length / 12) * 1000), 18000));
                }
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: "Something went wrong. Please try again.", typing: false }; return n; });
      }
    } finally { setIsSending(false); }
  }, [textInput, conversationId, isSending, speakEnabled]);

  const handleMic = async () => {
    if (!conversationId) return;
    window.speechSynthesis?.cancel(); setIsSpeaking(false);

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = e => chunksRef.current.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          setMessages(prev => [...prev, { role: "user", content: "🎤 Processing..." }]);
          try {
            const r = await fetch(`/api/openai/conversations/${conversationId}/voice-messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioBase64: base64, mimeType: "audio/webm" }),
            });
            const data = await r.json();
            if (data.transcript) {
              setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "user", content: data.transcript }; return n; });
            }
            if (data.response) {
              setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
              if (speakEnabled) { setIsSpeaking(true); speakText(data.response); setTimeout(() => setIsSpeaking(false), Math.min(Math.max(2000, (data.response.length / 12) * 1000), 18000)); }
            }
          } catch { setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "user", content: "🎤 (could not process)" }; return n; }); }
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setIsRecording(true);
      } catch { alert("Microphone access denied. Please allow microphone in browser settings."); }
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {isOpen ? (
        <div className="flex flex-col shadow-2xl rounded-2xl overflow-hidden" style={{ width: 360, height: 580, background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                {isSpeaking && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-slate-900 animate-pulse" />}
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">EduAssist AI</p>
                <p className="text-xs leading-tight" style={{ color: "rgba(167,139,250,0.8)" }}>
                  {isSpeaking ? "Speaking..." : isRecording ? "Listening..." : "Ask anything"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setSpeakEnabled(v => { if (v) window.speechSynthesis?.cancel(); return !v; }); }} className="p-2 rounded-full transition-colors hover:bg-white/10">
                {speakEnabled ? <Volume2 className="w-4 h-4 text-white/70" /> : <VolumeX className="w-4 h-4 text-white/40" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 rounded-full transition-colors hover:bg-white/10">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">Hi! I'm your AI Tutor</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(148,163,184,0.8)" }}>Speak or type your question — I'll explain it clearly.</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full text-left mt-2">
                  {["Explain Newton's 3 laws of motion", "What is Ohm's Law?", "Solve: x² - 5x + 6 = 0"].map((q) => (
                    <button key={q} onClick={() => { setTextInput(q); inputRef.current?.focus(); }} className="px-3 py-2 rounded-xl text-xs text-left transition-colors" style={{ background: "rgba(99,102,241,0.15)", color: "rgba(199,210,254,0.9)", border: "1px solid rgba(99,102,241,0.2)" }}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed" style={msg.role === "user" ? { background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", borderBottomRightRadius: 4 } : { background: "rgba(255,255,255,0.07)", color: "rgba(241,245,249,0.95)", borderBottomLeftRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {msg.content}
                  {msg.typing && <span className="inline-flex gap-0.5 ml-1 align-middle"><span className="w-1 h-1 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "0ms" }} /><span className="w-1 h-1 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-1 h-1 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "300ms" }} /></span>}
                </div>
              </div>
            ))}
          </div>
          {isSpeaking && (
            <div className="flex items-center justify-center gap-1 py-2 border-t border-white/5">
              {[...Array(12)].map((_, i) => <div key={i} className="rounded-full bg-indigo-400" style={{ width: 3, height: Math.random() * 18 + 4, animation: `bounce ${0.4 + Math.random() * 0.4}s ease-in-out infinite alternate`, animationDelay: `${i * 60}ms` }} />)}
              <span className="text-xs ml-2" style={{ color: "rgba(167,139,250,0.8)" }}>Speaking...</span>
            </div>
          )}
          <div className="px-3 pb-4 pt-2 border-t border-white/10 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input ref={inputRef} value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} placeholder="Type your question..." disabled={isSending || !conversationId} className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none disabled:opacity-40" style={{ background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.12)" }} />
              <button onClick={handleSendText} disabled={!textInput.trim() || isSending || !conversationId} className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
                {isSending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
              <button onClick={handleMic} disabled={isSending || !conversationId} className="relative flex items-center justify-center rounded-full transition-all disabled:opacity-40" style={{ width: 56, height: 56, background: isRecording ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#6366f1,#4f46e5)", boxShadow: isRecording ? "0 0 0 8px rgba(239,68,68,0.2)" : "0 0 0 4px rgba(99,102,241,0.2)" }}>
                {isRecording ? <StopCircle className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                {isRecording && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(239,68,68,0.3)" }} />}
              </button>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            </div>
            <p className="text-center text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
              {isRecording ? "🎙 Listening — tap stop when done" : "Tap mic to speak"}
            </p>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="relative flex items-center gap-2.5 px-5 py-3 rounded-full transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", boxShadow: "0 8px 32px rgba(99,102,241,0.45)" }}>
          <Bot className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">AI Tutor</span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white animate-pulse" />
        </button>
      )}
    </div>
  );
}
