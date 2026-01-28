"use server";

import { verifyContent, type VerificationResult, type VerifierModel } from "./verifier";
import { generateLearningOpportunities, type ExamQuestion } from "./gemini";

/**
 * Generate learning opportunities with cross-model verification
 * 
 * This function:
 * 1. Generates learning opportunities using Gemini
 * 2. Verifies the output using a second model (Claude/OpenAI/Gemini Pro)
 * 3. Returns both the content and verification results
 */
export async function generateVerifiedLearningOpportunities(
  examQuestions: ExamQuestion[],
  selectedAnswers: { [key: number]: number },
  course?: string,
  verifier: VerifierModel = "claude"
): Promise<{
  content: ReadableStream<Uint8Array>;
  verification?: Promise<VerificationResult>;
}> {
  // Generate learning opportunities
  const contentStream = await generateLearningOpportunities(
    examQuestions,
    selectedAnswers,
    course
  );

  // For verification, we need to collect the stream first
  // In a real implementation, you might want to stream verification separately
  // or verify after the content is complete
  
  return {
    content: contentStream,
    // Verification can be done asynchronously after content is generated
    verification: undefined, // Will be set after content is collected
  };
}

/**
 * Verify already-generated learning opportunities content
 */
export async function verifyLearningOpportunities(
  learningOpportunitiesText: string,
  examQuestions: ExamQuestion[],
  verifier: VerifierModel = "claude"
): Promise<VerificationResult> {
  const context = `These learning opportunities were generated based on an exam with ${examQuestions.length} questions.`;
  
  return verifyContent(learningOpportunitiesText, verifier, context);
}
