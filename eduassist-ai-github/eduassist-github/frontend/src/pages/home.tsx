import React, { useState, useRef } from "react";
import { Upload, FileText, Download, Loader2, CheckCircle2, GraduationCap, BookOpen, ScrollText, FileBadge, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { VoiceAssistant } from "@/components/voice-assistant";
import { parseMaterial, fileToBase64, pdfToImages } from "@/lib/utils";

import { jsPDF } from "jspdf";

// ── Inline markdown parser (bold + italic) ───────────────────────────────────
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    if (raw.startsWith("**"))
      parts.push(<strong key={k++} className="font-bold text-slate-900">{raw.slice(2, -2)}</strong>);
    else
      parts.push(<em key={k++} className="italic text-slate-600">{raw.slice(1, -1)}</em>);
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

// ── Styled content renderer ──────────────────────────────────────────────────
function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { elements.push(<div key={key++} className="h-2" />); continue; }

    // UNIT-X header (e.g. "UNIT-1", "UNIT 1", "## UNIT-1")
    if (/^(##\s+)?UNIT[-\s]?\d+/i.test(t)) {
      const label = t.replace(/^##\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <div key={key++} className="mt-6 mb-2">
          <h2 className="text-sm font-extrabold text-blue-900 uppercase tracking-widest">{label}</h2>
          <div className="h-0.5 bg-blue-900/25 mt-1 rounded" />
        </div>
      );

    // ## Section heading
    } else if (t.startsWith("## ") || (t.startsWith("**") && t.endsWith("**") && t.length < 80 && !t.includes(" "))) {
      elements.push(
        <h2 key={key++} className="text-base font-bold text-primary mt-5 mb-2 pb-1 border-b border-primary/20">
          {parseInline(t.replace(/^## /, "").replace(/^\*\*|\*\*$/g, ""))}
        </h2>
      );

    // ### Sub-section (difficulty headers like Easy / Medium / Hard)
    } else if (t.startsWith("### ")) {
      const label = t.replace(/^### /, "");
      elements.push(
        <div key={key++} className="mt-5 mb-2 px-3 py-1.5 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
          <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wide">{label}</h3>
        </div>
      );

    // Q1. / Q2. numbered question
    } else if (/^Q\d+[.).:\s]/.test(t)) {
      const match = t.match(/^(Q\d+)[.).:\s]+(.*)$/);
      const qnum = match?.[1] ?? "Q";
      const qtext = match?.[2] ?? t;
      elements.push(
        <div key={key++} className="mt-4 mb-1 flex gap-2 items-start">
          <span className="shrink-0 px-1.5 py-0.5 bg-blue-700 text-white text-xs font-bold rounded min-w-[28px] text-center mt-0.5">{qnum}</span>
          <p className="font-bold text-slate-900 text-sm leading-relaxed">{parseInline(qtext)}</p>
        </div>
      );

    // Q: format (old style)
    } else if (t.startsWith("Q:")) {
      elements.push(
        <div key={key++} className="mt-4 mb-1 flex gap-2 items-start">
          <span className="shrink-0 px-1.5 py-0.5 bg-blue-700 text-white text-xs font-bold rounded min-w-[28px] text-center mt-0.5">Q</span>
          <p className="font-bold text-slate-900 text-sm leading-relaxed">{parseInline(t.replace(/^Q:\s*/, ""))}</p>
        </div>
      );

    // A: format (old style)
    } else if (t.startsWith("A:")) {
      elements.push(
        <div key={key++} className="mb-3 ml-9 px-3 py-2 bg-blue-50 border-l-2 border-blue-400 rounded-r text-sm leading-relaxed text-slate-800">
          {parseInline(t.replace(/^A:\s*/, ""))}
        </div>
      );

    // MCQ options: A) B) C) D)  or  A. B. C. D.
    } else if (/^[A-Da-d][).]\s/.test(t)) {
      const letter = t[0].toUpperCase();
      const optText = t.slice(2).trim();
      elements.push(
        <div key={key++} className="flex gap-2 items-start ml-10 my-0.5">
          <span className="shrink-0 w-5 h-5 rounded border border-slate-300 bg-white text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">{letter}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{parseInline(optText)}</p>
        </div>
      );

    // Answer: [for MCQ/Fill in blank]
    } else if (/^answer:/i.test(t)) {
      const ans = t.replace(/^answer:\s*/i, "");
      elements.push(
        <div key={key++} className="ml-10 my-1.5 flex items-center gap-2">
          <span className="shrink-0 px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">ANS</span>
          <span className="text-sm font-semibold text-emerald-800">{parseInline(ans)}</span>
        </div>
      );

    // Bullet points
    } else if (/^[-•*]\s/.test(t)) {
      const txt = t.replace(/^[-•*]\s+/, "");
      elements.push(
        <div key={key++} className="flex gap-2 items-start ml-4 my-0.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <p className="text-slate-800 text-sm leading-relaxed">{parseInline(txt)}</p>
        </div>
      );

    // Numbered items (1. 2. 3.) — but NOT Q1. Q2.
    } else if (/^\d+[.)]\s/.test(t)) {
      const num = t.match(/^(\d+)/)?.[1];
      const rest = t.replace(/^\d+[.)]\s*/, "");
      elements.push(
        <div key={key++} className="flex gap-2 items-start ml-4 my-0.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center mt-0.5">{num}</span>
          <p className="text-slate-800 text-sm leading-relaxed">{parseInline(rest)}</p>
        </div>
      );

    // Regular paragraph (with inline bold/italic)
    } else {
      elements.push(
        <p key={key++} className="text-slate-800 text-sm leading-relaxed my-0.5 ml-1">{parseInline(t)}</p>
      );
    }
  }
  return <div className="space-y-0.5">{elements}</div>;
}

// ── Course data ──────────────────────────────────────────────────────────────
const SCHOOL_SUBJECTS: Record<string, string[]> = {
  "1": ["English", "Hindi", "Mathematics", "EVS"],
  "2": ["English", "Hindi", "Mathematics", "EVS"],
  "3": ["English", "Hindi", "Mathematics", "EVS", "General Knowledge"],
  "4": ["English", "Hindi", "Mathematics", "EVS", "General Knowledge"],
  "5": ["English", "Hindi", "Mathematics", "EVS", "General Knowledge"],
  "6": ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit"],
  "7": ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit"],
  "8": ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit"],
  "9": ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit", "Computer Science"],
  "10": ["English", "Hindi", "Mathematics", "Science", "Social Science", "Sanskrit", "Computer Science"],
  "11": ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Economics", "Accountancy", "Business Studies", "Computer Science", "History", "Geography", "Political Science"],
  "12": ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Economics", "Accountancy", "Business Studies", "Computer Science", "History", "Geography", "Political Science"],
};

const ENGINEERING_BRANCHES = [
  "Computer Science", "Electronics", "Mechanical", "Civil",
  "Electrical", "Information Technology", "Chemical", "Aerospace",
];

// ── PDF generator ────────────────────────────────────────────────────────────
function generatePDF(sectionContent: string, title: string, meta: string, filename: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableW = pageW - margin * 2;
  let y = margin;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("EduAssist AI", margin, 12);
  doc.setFontSize(11);
  doc.text(title, margin, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 255);
  doc.text(meta, pageW - margin - doc.getTextWidth(meta), 21);
  y = 36;

  const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "");
  const addLine = () => { if (y > pageH - margin - 6) { doc.addPage(); y = margin; } };

  for (const rawLine of sectionContent.split("\n")) {
    const t = rawLine.trim();
    addLine();
    if (!t) { y += 3; continue; }

    // UNIT-X header
    if (/^(##\s+)?UNIT[-\s]?\d+/i.test(t)) {
      y += 3;
      doc.setFillColor(30, 58, 138); doc.rect(margin, y - 4, usableW, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      const label = stripMd(t.replace(/^##\s*/, ""));
      doc.text(label, margin + 3, y + 1); y += 9;

    // ## section heading
    } else if (t.startsWith("## ") || (t.startsWith("**") && t.endsWith("**") && t.length < 80)) {
      y += 2;
      doc.setFillColor(239, 246, 255); doc.rect(margin, y - 4, usableW, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 64, 175);
      const wrapped = doc.splitTextToSize(stripMd(t.replace(/^## /, "")), usableW - 4);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 2, y); y += 6; }
      y += 1;

    // ### sub-section
    } else if (t.startsWith("### ")) {
      y += 2;
      doc.setFillColor(238, 242, 255); doc.rect(margin, y - 4, usableW, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(55, 48, 163);
      const wrapped = doc.splitTextToSize(t.replace(/^### /, "").toUpperCase(), usableW - 4);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 3, y); y += 5.5; }

    // Q1./Q2. numbered question
    } else if (/^Q\d+[.).:\s]/.test(t)) {
      y += 2;
      const match = t.match(/^(Q\d+)[.).:\s]+(.*)/);
      const qnum = match?.[1] ?? "Q";
      const qtext = stripMd(match?.[2] ?? t);
      doc.setFillColor(219, 234, 254); doc.rect(margin, y - 4, 14, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(29, 78, 216);
      doc.text(qnum, margin + 2, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(qtext, usableW - 16);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 16, y); y += 5.5; }

    // Q: old format
    } else if (t.startsWith("Q:")) {
      y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30, 64, 175);
      const wrapped = doc.splitTextToSize(stripMd("Q  " + t.replace(/^Q:\s*/, "")), usableW - 8);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 7, y); y += 5; }

    // A: old format
    } else if (t.startsWith("A:")) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(20, 83, 45);
      const wrapped = doc.splitTextToSize(stripMd("    " + t.replace(/^A:\s*/, "")), usableW - 8);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 7, y); y += 5; }
      y += 2;

    // MCQ option A) B) C) D)
    } else if (/^[A-Da-d][).]\s/.test(t)) {
      const letter = t[0].toUpperCase();
      const optText = stripMd(t.slice(2).trim());
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50, 50, 80);
      const wrapped = doc.splitTextToSize(`${letter})  ${optText}`, usableW - 14);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 12, y); y += 4.5; }

    // Answer: block
    } else if (/^answer:/i.test(t)) {
      const ans = stripMd(t.replace(/^answer:\s*/i, ""));
      doc.setFillColor(220, 252, 231);
      const wrapped = doc.splitTextToSize("✓  " + ans, usableW - 12);
      const bh = wrapped.length * 5 + 3;
      if (y + bh > pageH - margin) { doc.addPage(); y = margin; }
      doc.rect(margin + 4, y - 3, usableW - 4, bh, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(21, 128, 61);
      for (const wl of wrapped) { doc.text(wl, margin + 7, y); y += 5; }
      y += 2;

    // Bullet points
    } else if (/^[-•*]\s/.test(t)) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      const wrapped = doc.splitTextToSize("•  " + stripMd(t.replace(/^[-•*]\s+/, "")), usableW - 6);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 5, y); y += 5; }

    // Numbered list
    } else if (/^\d+[.)]\s/.test(t)) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      const wrapped = doc.splitTextToSize(stripMd(t), usableW - 6);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin + 5, y); y += 5; }

    // Regular paragraph
    } else {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      const wrapped = doc.splitTextToSize(stripMd(t), usableW);
      for (const wl of wrapped) { addLine(); doc.text(wl, margin, y); y += 5; }
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`EduAssist AI  |  ${title}  |  Page ${p} of ${totalPages}`, margin, pageH - 6);
  }
  doc.save(filename);
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const { toast } = useToast();

  // Study material state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [courseType, setCourseType] = useState<string>("B.Tech");
  const [semester, setSemester] = useState<string>("");
  const [branch, setBranch] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [parsedSections, setParsedSections] = useState<{ notes: string; qa: string; questionBank: string; vvi: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paper solver state
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [isSolvingPaper, setIsSolvingPaper] = useState(false);
  const [paperProgress, setPaperProgress] = useState("");
  const [solvedContent, setSolvedContent] = useState<string | null>(null);
  const paperInputRef = useRef<HTMLInputElement>(null);

  const isSchool = courseType === "School";

  const semesterOptions = isSchool
    ? Array.from({ length: 12 }, (_, i) => String(i + 1))
    : courseType === "Diploma" ? ["1","2","3","4","5","6"]
    : ["1","2","3","4","5","6","7","8"];

  const branchOptions = isSchool
    ? (semester ? SCHOOL_SUBJECTS[semester] ?? [] : [])
    : ENGINEERING_BRANCHES;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setPreviewUrl(URL.createObjectURL(e.dataTransfer.files[0]));
    }
  };

  const handleGenerate = async () => {
    if (!file) { toast({ title: "Please upload a syllabus image first", variant: "destructive" }); return; }
    if (!semester || !branch) { toast({ title: "Please select all details", variant: "destructive" }); return; }

    setIsGenerating(true);
    setProgress("Preparing image...");
    setParsedSections(null);

    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/syllabus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          courseType: courseType,
          semester,
          branch,
          isSchool,
        }),
      });

      if (!response.ok || !response.body) throw new Error('Failed to start generation');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (value) {
          for (const line of decoder.decode(value).split('\n\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.progress) setProgress(data.progress);
              if (data.chunk) { accumulated += data.chunk; setParsedSections(parseMaterial(accumulated)); }
              if (data.done && data.content) setParsedSections(parseMaterial(data.content));
              if (data.error) toast({ title: data.error, variant: "destructive" });
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to generate material", variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setProgress("");
    }
  };

  const handleDownload = (sectionContent: string, title: string) => {
    if (!sectionContent || isDownloading) return;
    setIsDownloading(true);
    try {
      const label = isSchool ? `Class${semester}` : `Sem${semester}`;
      generatePDF(sectionContent, title, `${courseType} | ${isSchool ? "Class" : "Semester"} ${semester} | ${branch}`, `${title.replace(/\s+/g, "_")}_${label}.pdf`);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSolvePaper = async () => {
    if (!paperFile) { toast({ title: "Please upload a question paper (image or PDF)", variant: "destructive" }); return; }
    setIsSolvingPaper(true);
    setSolvedContent(null);
    setPaperProgress("Reading question paper...");

    try {
      const isImage = paperFile.type.startsWith("image/");
      let filePayload: Record<string, unknown>;

      if (isImage) {
        const base64 = await fileToBase64(paperFile);
        filePayload = { imageBase64: base64 };
      } else {
        // PDF: render each page to an image in the browser, then send as images
        setPaperProgress("Converting PDF pages...");
        try {
          const images = await pdfToImages(paperFile, 5);
          if (images.length === 0) throw new Error("No pages rendered");
          filePayload = { imagesBase64: images };
        } catch {
          toast({ title: "Could not read this PDF. Please upload as a JPG/PNG image instead.", variant: "destructive" });
          setIsSolvingPaper(false);
          setPaperProgress("");
          return;
        }
      }

      const response = await fetch('/api/syllabus/solve-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filePayload,
          courseType,
          semester: semester || undefined,
          branch: branch || undefined,
          isSchool,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to connect");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (value) {
          for (const line of decoder.decode(value).split('\n\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.progress) setPaperProgress(data.progress);
              if (data.chunk) { accumulated += data.chunk; setSolvedContent(accumulated); }
              if (data.done && data.content) setSolvedContent(data.content);
              if (data.error) toast({ title: data.error, variant: "destructive" });
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to solve paper. Please try again.", variant: "destructive" });
    } finally {
      setIsSolvingPaper(false);
      setPaperProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">EduAssist AI</h1>
              <p className="text-xs text-slate-500 font-medium">Your Smart Academic Companion</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <BookOpen className="w-4 h-4" />
            For School, Diploma and B.Tech Students
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

        {/* ── Study Material Generator ────────────────────────────────────── */}
        <div className="grid md:grid-cols-12 gap-8">

          {/* Left panel */}
          <div className="md:col-span-5 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6 space-y-6">

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Upload Syllabus / Chapter Image</Label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                      ${file ? 'border-primary/50 bg-primary/5' : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} />
                    {previewUrl ? (
                      <div className="space-y-3">
                        <img src={previewUrl} alt="Syllabus preview" className="max-h-40 mx-auto rounded-md shadow-sm" />
                        <p className="text-sm font-medium text-primary">Click to change image</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                          <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Drop syllabus image here</p>
                          <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Label className="text-sm font-semibold">I am a...</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["School", "Diploma", "B.Tech"].map((ct) => (
                      <button
                        key={ct}
                        onClick={() => { setCourseType(ct); setSemester(""); setBranch(""); }}
                        className={`py-2.5 px-2 rounded-lg border text-sm font-semibold transition-all
                          ${courseType === ct ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary"}`}
                      >
                        {ct === "School" ? "School (1-12)" : ct}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isSchool ? "Class" : "Semester"}</Label>
                    <Select value={semester} onValueChange={(v) => { setSemester(v); setBranch(""); }}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={isSchool ? "Class" : "Sem"} />
                      </SelectTrigger>
                      <SelectContent>
                        {semesterOptions.map((s) => (
                          <SelectItem key={s} value={s}>{isSchool ? `Class ${s}` : `Semester ${s}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isSchool ? "Subject" : "Branch"}</Label>
                    <Select value={branch} onValueChange={setBranch} disabled={isSchool && !semester}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={isSchool ? "Subject" : "Branch"} />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold shadow-sm"
                  onClick={handleGenerate}
                  disabled={isGenerating || !file || !semester || !branch}
                >
                  {isGenerating
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{progress || "Generating..."}</>
                    : <><FileText className="w-5 h-5 mr-2" />Generate Study Material</>
                  }
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right panel */}
          <div className="md:col-span-7">
            {!parsedSections && !isGenerating ? (
              <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-8 bg-white/50">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <GraduationCap className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to study?</h3>
                <p className="text-slate-500 max-w-sm text-sm">
                  Upload your syllabus or chapter image, choose your class or course, and get complete notes, Q&A and exam questions instantly.
                </p>
              </div>
            ) : isGenerating && !parsedSections ? (
              <div className="h-full min-h-[400px] border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-8 bg-white shadow-sm">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Creating your materials</h3>
                <p className="text-slate-500 max-w-sm text-sm animate-pulse">{progress || "Analyzing and compiling notes..."}</p>
              </div>
            ) : parsedSections ? (
              <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                <CardContent className="p-0 flex-1 flex flex-col">
                  <Tabs defaultValue="notes" className="w-full flex-1 flex flex-col">
                    <div className="bg-slate-50 p-2 border-b border-slate-200">
                      <TabsList className="w-full grid grid-cols-4 bg-slate-200/50">
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                        <TabsTrigger value="qa">Q&A</TabsTrigger>
                        <TabsTrigger value="questionBank">Question Bank</TabsTrigger>
                        <TabsTrigger value="vvi">VVI</TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-white">
                      {[
                        { id: 'notes', title: 'Chapter Notes', content: parsedSections.notes },
                        { id: 'qa', title: 'Questions & Answers', content: parsedSections.qa },
                        { id: 'questionBank', title: 'Question Bank', content: parsedSections.questionBank },
                        { id: 'vvi', title: 'VVI Questions', content: parsedSections.vvi },
                      ].map((tab) => (
                        <TabsContent key={tab.id} value={tab.id} className="m-0 h-full flex flex-col absolute inset-0 data-[state=inactive]:hidden">
                          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              {tab.title}
                              {isGenerating && <span className="text-xs font-normal text-primary animate-pulse ml-1">generating...</span>}
                            </h2>
                            <Button size="sm" variant="outline" onClick={() => handleDownload(tab.content, tab.title)} disabled={isDownloading || !tab.content} className="h-8 gap-2">
                              {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Download PDF
                            </Button>
                          </div>
                          <div className="flex-1 overflow-auto p-5">
                            {tab.content ? renderContent(tab.content) : <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No content yet.</div>}
                          </div>
                        </TabsContent>
                      ))}
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        {/* ── Previous Year Paper Solver ──────────────────────────────────── */}
        <div className="border-t border-slate-200 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-100 p-2 rounded-lg">
              <ScrollText className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Previous Year Paper Solver</h2>
              <p className="text-sm text-slate-500">Upload a photo or PDF of your question paper — AI will answer every question with complete exam-ready answers</p>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-8">
            {/* Upload panel */}
            <div className="md:col-span-5">
              <Card className="border-amber-200 shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Upload Question Paper</Label>
                    <div
                      className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors
                        ${paperFile ? 'border-amber-400 bg-amber-50' : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'}`}
                      onClick={() => paperInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const f = e.dataTransfer.files?.[0];
                        if (f) setPaperFile(f);
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        ref={paperInputRef}
                        onChange={(e) => { if (e.target.files?.[0]) setPaperFile(e.target.files[0]); }}
                      />
                      {paperFile ? (
                        <div className="space-y-2">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                            {paperFile.type.startsWith("image/") ? <ImageIcon className="w-6 h-6 text-amber-600" /> : <FileBadge className="w-6 h-6 text-amber-600" />}
                          </div>
                          <p className="text-sm font-semibold text-amber-800 break-all">{paperFile.name}</p>
                          <p className="text-xs text-slate-500">{(paperFile.size / 1024).toFixed(0)} KB — Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                            <Upload className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Photo or PDF of question paper</p>
                            <p className="text-xs text-slate-500 mt-1">JPG, PNG, or PDF — click or drag here</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                    <strong>Tip:</strong> For scanned/printed papers, take a clear photo and upload as image (JPG/PNG). PDFs work best when they contain selectable text.
                    The course details selected above will be used for better answers.
                  </div>

                  <Button
                    className="w-full h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                    onClick={handleSolvePaper}
                    disabled={isSolvingPaper || !paperFile}
                  >
                    {isSolvingPaper
                      ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{paperProgress || "Solving..."}</>
                      : <><ScrollText className="w-5 h-5 mr-2" />Solve Question Paper</>
                    }
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Results panel */}
            <div className="md:col-span-7">
              {!solvedContent && !isSolvingPaper ? (
                <div className="min-h-[300px] border-2 border-dashed border-amber-200 rounded-xl flex flex-col items-center justify-center text-center p-8 bg-amber-50/30">
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                    <ScrollText className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload a question paper</h3>
                  <p className="text-slate-500 max-w-sm text-sm">
                    Every question — MCQ, fill in the blank, short answer, long answer — will be fully solved with marks-worthy answers.
                  </p>
                </div>
              ) : isSolvingPaper && !solvedContent ? (
                <div className="min-h-[300px] border border-amber-200 rounded-xl flex flex-col items-center justify-center text-center p-8 bg-white shadow-sm">
                  <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Solving your paper</h3>
                  <p className="text-slate-500 max-w-sm text-sm animate-pulse">{paperProgress || "Answering every question..."}</p>
                </div>
              ) : solvedContent ? (
                <Card className="border-amber-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-amber-100 bg-amber-50/60">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Solved Paper
                      {isSolvingPaper && <span className="text-xs font-normal text-amber-600 animate-pulse ml-1">solving...</span>}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        if (!solvedContent || isDownloading) return;
                        setIsDownloading(true);
                        try {
                          const meta = semester && branch ? `${courseType} | ${isSchool ? "Class" : "Sem"} ${semester} | ${branch}` : "Previous Year Paper";
                          generatePDF(solvedContent, "Solved Question Paper", meta, "Solved_Question_Paper.pdf");
                        } finally { setIsDownloading(false); }
                      }}
                      disabled={isDownloading || !solvedContent}
                    >
                      {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Download PDF
                    </Button>
                  </div>
                  <div className="overflow-auto p-5 max-h-[600px]">
                    {renderContent(solvedContent)}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </div>

      </main>

      <VoiceAssistant />
    </div>
  );
}
