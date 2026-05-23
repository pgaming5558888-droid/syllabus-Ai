import { Router } from "express";
import OpenAI from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/generate", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 8000);

  try {
    const { imageBase64, courseType, semester, branch, isSchool } = req.body;
    if (!imageBase64 || !semester || !branch) {
      clearInterval(heartbeat); sendEvent({ error: "Missing required fields" }); res.end(); return;
    }

    sendEvent({ progress: "Analyzing your syllabus image..." });

    const prompt = isSchool
      ? `You are an expert academic content creator for Indian school students.
Analyze this syllabus or chapter image and create complete study materials for Class ${semester}, Subject: ${branch}.

Output EXACTLY these 4 sections using EXACTLY these headers on their own line:

## NOTES
Write clear notes in document style. Use this exact format:
- Start with "UNIT-1" (or chapter heading) followed by a brief description on the next line
- Use **Bold Term:** format to introduce every key definition or concept, followed by explanation
- Use bullet points (- ) for sub-points under each concept
- Use *italic* for important notes, exam tips, formulas
- Keep language simple for Class ${semester} students

## QA
Write 20-25 Question and Answer pairs. Use this EXACT format:
Q1. [Full question text here?]
**[Key Term]:** [Complete answer in 3-4 sentences using **bold** for key terms. Include examples.]

## QUESTION BANK
Write 35 exam-style questions organized as follows:

### Easy Questions (1-2 Marks)
Fill in the Blanks:
Q1. The SI unit of _______ is Newton.
Answer: Force

MCQ (Multiple Choice):
Q3. [Question text?]
A) [Option 1]
B) [Option 2]
C) [Option 3]
D) [Option 4]
Answer: B) [Option 2]

### Medium Questions (3-4 Marks)
Q11. [Short answer question?]
Answer: **[Key point 1]:** explanation. Include 4-6 sentences.

### Hard Questions (5-6 Marks)
Q21. [Long answer question?]
Answer: **Introduction:** [opening paragraph]
**[Heading 1]:** [detailed explanation with examples]

## VVI QUESTIONS
List 15 Very Very Important questions with COMPLETE MODEL ANSWERS.
Q1. [Most important question?]
**Answer:**
**[Key aspect 1]:** [detailed explanation]
- [Supporting point]
*[Exam tip or formula to remember]*

These materials will directly help the student score well in exams. Keep language age-appropriate for Class ${semester}.`
      : `You are an expert academic content creator for Indian engineering and diploma students.
Analyze this syllabus image and create comprehensive study materials for ${courseType}, Semester ${semester}, Branch: ${branch}.

Output EXACTLY these 4 sections using EXACTLY these headers on their own line:

## NOTES
Write detailed notes in professional document style. Use this exact format:
- Start each unit with "UNIT-1: [Unit Name]" header on its own line
- Use **Bold Term:** to introduce every definition, concept, formula
- Use bullet points (- ) for sub-points, advantages, applications
- Use *italic* for formulas, important notes, diagrams description

## QA
Write 25-30 Question and Answer pairs. Use this EXACT format:
Q1. [Full question here?]
**[Key Term]:** [Answer paragraph with **bold** key terms, 3-5 sentences, exam-ready detail]

## QUESTION BANK
Write 40 exam-style questions organized as follows:

### Easy Questions (1-2 Marks)
Fill in the Blanks:
Q1. The unit of moment of force is _______.
Answer: Newton-metre (N·m)

MCQ (Multiple Choice Questions):
Q6. [Question text?]
A) [Option one]
B) [Option two]
C) [Option three]
D) [Option four]
Answer: C) [Option three]

### Medium Questions (2-5 Marks)
Q16. [Short answer question?]
Answer: **[Point 1]:** [explanation]. **[Point 2]:** [explanation]. Cover all marking points.

### Hard Questions (5-10 Marks)
Q26. [Long answer / essay question?]
Answer: **Introduction:** [opening definition]
**[Main Heading 1]:** [detailed explanation with examples, 3-4 lines]

## VVI QUESTIONS
List the 20 most Very Very Important questions with COMPLETE MODEL ANSWERS.
Q1. [Most exam-important question?]
**Answer:**
**[Aspect 1]:** [thorough explanation — minimum 4-5 lines]
- [Key point]
*[Formula / important exam note]*

These study materials will directly help students pass their semester exams. Be thorough, accurate, and use the exact formatting above.`;

    sendEvent({ progress: "Generating notes, Q&A and question bank..." });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 6000,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "auto" } },
        ],
      }],
      stream: true,
    });

    let fullContent = "";
    let chunkBuffer = "";
    for await (const chunk of response) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullContent += token;
        chunkBuffer += token;
        if (chunkBuffer.length >= 40) { sendEvent({ chunk: chunkBuffer }); chunkBuffer = ""; }
      }
    }
    if (chunkBuffer.length > 0) sendEvent({ chunk: chunkBuffer });

    clearInterval(heartbeat);
    sendEvent({ done: true, content: fullContent });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    console.error(err);
    sendEvent({ error: "Failed to generate study material. Please try again." });
    res.end();
  }
});

router.post("/solve-paper", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 8000);

  try {
    const { pdfBase64, imageBase64, imagesBase64, courseType, semester, branch, isSchool } = req.body;

    if (!pdfBase64 && !imageBase64 && (!imagesBase64 || imagesBase64.length === 0)) {
      clearInterval(heartbeat); sendEvent({ error: "No file provided." }); res.end(); return;
    }

    const context = courseType && semester && branch
      ? (isSchool ? `Class ${semester}, Subject: ${branch}` : `${courseType} — Semester ${semester}, Branch: ${branch}`)
      : "Indian Exam";

    const solvePrompt = `You are an expert teacher solving a previous year question paper for Indian students.
Context: ${context}

Solve EVERY question completely. Format:
## SOLVED QUESTION PAPER
${context}

Q1: [question]
Answer: [complete answer]

Rules:
- MCQ: State correct option + explain in 1-2 lines
- Fill in the Blank: Give exact answer with brief explanation
- Short Answer (2-5 marks): Complete answer, 4-8 lines
- Long Answer (5-10 marks): Full model answer with headings, sub-points, examples, formulas
- Keep original question numbers
- Write "Answer:" before each answer`;

    let messages: OpenAI.ChatCompletionMessageParam[];

    if (imageBase64) {
      sendEvent({ progress: "Reading question paper image..." });
      messages = [{ role: "user", content: [
        { type: "text", text: solvePrompt + "\n\nHere is the question paper:" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "auto" } },
      ]}];
    } else if (imagesBase64 && imagesBase64.length > 0) {
      sendEvent({ progress: `Reading ${imagesBase64.length} page(s) of question paper...` });
      messages = [{ role: "user", content: [
        { type: "text", text: solvePrompt + `\n\nHere is the question paper (${imagesBase64.length} page(s)):` },
        ...(imagesBase64 as string[]).map((img) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${img}`, detail: "auto" as const } })),
      ]}];
    } else {
      sendEvent({ progress: "Reading PDF question paper..." });
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      let paperText = "";
      try { const pdfData = await pdfParse(pdfBuffer); paperText = pdfData.text?.trim() ?? ""; } catch { /* ignore */ }
      if (paperText.length < 50) {
        clearInterval(heartbeat);
        sendEvent({ error: "Could not read this PDF. Please upload as a JPG/PNG image instead." });
        res.end(); return;
      }
      sendEvent({ progress: "Solving all questions..." });
      messages = [{ role: "user", content: solvePrompt + "\n\nHere is the question paper:\n\n" + paperText.slice(0, 12000) }];
    }

    const response = await openai.chat.completions.create({ model: "gpt-4o", max_tokens: 6000, messages, stream: true });

    let fullContent = "";
    let chunkBuffer = "";
    for await (const chunk of response) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullContent += token; chunkBuffer += token;
        if (chunkBuffer.length >= 40) { sendEvent({ chunk: chunkBuffer }); chunkBuffer = ""; }
      }
    }
    if (chunkBuffer.length > 0) sendEvent({ chunk: chunkBuffer });
    clearInterval(heartbeat);
    sendEvent({ done: true, content: fullContent });
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    console.error(err);
    sendEvent({ error: "Failed to solve the paper. Please try again." });
    res.end();
  }
});

export default router;
