import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import syllabusRouter from "./routes/syllabus.js";
import openaiRouter from "./routes/openai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// API routes
app.use("/api/syllabus", syllabusRouter);
app.use("/api/openai", openaiRouter);
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

// Serve frontend static build
const distPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`✅ EduAssist AI running on http://localhost:${port}`));
