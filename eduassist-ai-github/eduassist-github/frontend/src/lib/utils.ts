import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseMaterial(content: string) {
  const sections = {
    notes: "",
    qa: "",
    questionBank: "",
    vvi: ""
  };

  let currentSection: keyof typeof sections | null = null;
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("## NOTES")) {
      currentSection = "notes";
      continue;
    } else if (upper.startsWith("## QA") || upper.startsWith("## Q&A") || upper.startsWith("## QUESTION AND ANSWER")) {
      currentSection = "qa";
      continue;
    } else if (upper.startsWith("## QUESTION BANK")) {
      currentSection = "questionBank";
      continue;
    } else if (upper.startsWith("## VVI") || upper.startsWith("## VERY VERY IMPORTANT")) {
      currentSection = "vvi";
      continue;
    }

    if (currentSection) {
      sections[currentSection] += line + '\n';
    } else {
      // If no section matched yet, put in notes by default
      sections.notes += line + '\n';
    }
  }

  return sections;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}

export async function pdfToImages(file: File, maxPages = 6): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    images.push(dataUrl.split(",")[1]);
  }

  return images;
}
