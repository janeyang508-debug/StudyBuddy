"use server";

import { generateMbaInsight, type BrainMode, type FilePart } from "./gemini";

// Re-export types from gemini.ts
export type { ExamQuestion, FilePart, BrainMode } from "./gemini";

// Exam generation uses the unified function with type="exam"
export async function generateExam(
  lectureNotes: string,
  course?: string,
  files?: FilePart[],
  brainMode: BrainMode = "auto"
): Promise<ReadableStream<Uint8Array>> {
  return generateMbaInsight(
    lectureNotes,
    undefined, // contextData
    course,
    files,
    brainMode,
    "exam" // type
  );
}
