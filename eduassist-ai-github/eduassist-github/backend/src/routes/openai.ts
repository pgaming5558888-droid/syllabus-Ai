import { Router } from "express";
import OpenAI from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const router = Router();

// In-memory conversation store (resets on server restart)
const conversations = new Map<string, { id: string; title: string; messages: { role: string; content: string }[] }>();
let nextId = 1;

router.get("/conversations", (_req, res) => {
  res.json([...conversations.values()].map(({ id, title }) => ({ id, title })));
});

router.post("/conversations", (req, res) => {
  const id = String(nextId++);
  const title = req.body?.title ?? "AI Tutor Session";
  conversations.set(id, { id, title, messages: [] });
  res.status(201).json({ id, title });
});

router.get("/conversations/:id", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json(conv);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Not found" });

  const userMsg = req.body?.content?.trim();
  if (!userMsg) return res.status(400).json({ error: "No content" });

  conv.messages.push({ role: "user", content: userMsg });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const systemPrompt = `You are EduAssist AI — a friendly, expert AI tutor for Indian students (School, Diploma, and B.Tech).
You help students understand subjects, solve problems, explain concepts, and prepare for exams.
Keep answers clear, structured, and educational. Use simple English mixed with Hindi if needed.
For math/formulas, explain step by step. For concepts, give definitions + examples.
Always encourage the student.`;

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...conv.messages.slice(-12).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: chatMessages, stream: true, max_tokens: 800 });

    let full = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) { full += token; sendEvent({ content: token }); }
    }

    conv.messages.push({ role: "assistant", content: full });
    sendEvent({ done: true });
    res.end();
  } catch (err) {
    console.error(err);
    sendEvent({ error: "Failed to get response" });
    res.end();
  }
});

router.post("/conversations/:id/voice-messages", async (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Not found" });

  try {
    // Expect base64 audio in request body
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "No audio" });

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const audioFile = new File([audioBuffer], "audio.webm", { type: mimeType ?? "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({ file: audioFile, model: "whisper-1" });
    const userText = transcription.text?.trim();
    if (!userText) return res.json({ transcript: "", response: "" });

    conv.messages.push({ role: "user", content: userText });

    const systemPrompt = `You are EduAssist AI — a friendly, expert AI tutor for Indian students (School, Diploma, and B.Tech). Keep answers concise (2-3 sentences max) since this is a voice conversation.`;
    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...conv.messages.slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const completion = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: chatMessages, max_tokens: 300 });
    const reply = completion.choices[0]?.message?.content ?? "";
    conv.messages.push({ role: "assistant", content: reply });

    res.json({ transcript: userText, response: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Voice processing failed" });
  }
});

export default router;
