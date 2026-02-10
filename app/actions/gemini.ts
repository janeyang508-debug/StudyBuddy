"use server";

// Main SDK for the AI model
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType, Part } from "@google/generative-ai";

// Server-only SDK for handling PDFs and PowerPoints
import { GoogleAIFileManager } from "@google/generative-ai/server";

import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import mammoth from "mammoth";

// Initialize both
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// Safety settings: BLOCK_ONLY_HIGH to allow rigorous business/risk analysis
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

// MBA Professor system instruction (ultra-concise for speed - reduces Time to First Token)
const MBA_PROFESSOR_SYSTEM_INSTRUCTION = `Elite MBA Professor. Strategic insights.`;

// Exam Generator system instruction (from exam-generator.md)
const EXAM_GENERATOR_SYSTEM_INSTRUCTION = `You are an Academic Examiner for MBA programs. Generate situational, scenario-based multiple-choice questions (MCQs) at the "Analyze" and "Evaluate" levels of Bloom's Taxonomy.

Requirements:
- Questions must be situational and scenario-based
- Distractors must be plausible MBA concepts that are incorrect for the specific scenario
- Each question must include a "Professor's Note" (rationale) explaining why the correct answer is right based on course theory

Output a JSON object with a key "questions" containing an array of question objects. Do not include any text outside of the JSON structure.

Format: {"questions": [{"question": "question text", "options": ["option1", "option2", "option3", "option4"], "correctIndex": 0, "rationale": "explanation"}]}

Generate 5-8 questions.`;

// Learning Opportunity system instruction (from learning-opportunity.md)
// If updating, sync with commands/learning-opportunity.md
const LEARNING_OPPORTUNITY_SYSTEM_INSTRUCTION = `You are an Executive Education Coach. After an exam is complete, identify 3 'Learning Opportunities' based on the student's performance.

## Opportunity Types:
- **Concept Deep-dive:** If the student missed a Finance, marketing, sales or strategy question, explain the underlying formula or concept.
- **Related Case Studies:** Mention a famous real-world company facing a similar problem.
- **Critical Thinking:** Ask a 'What If' question to test the student's adaptability (e.g., 'What if interest rates doubled?').

## Goal:
Encourage active recall and curiosity. Never end a session with just 'Correct/Incorrect'.

Provide your response in a clear, structured format with 3 distinct learning opportunities.`;

export interface FilePart {
  mimeType: string;
  data: string; // base64 string
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  rationale: string;
}

// Helper function to check if error is retryable (503, 429, or quota-related)
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("503") ||
      message.includes("429") ||
      message.includes("overloaded") ||
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    );
  }
  return false;
}

// Helper function to sleep/delay
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to check file size and optimize if needed
function optimizeFileParts(
  files: FilePart[],
  maxSizeBytes: number = 8 * 1024 * 1024 // 8MB default (leaving room for other payload)
): FilePart[] {
  const optimized: FilePart[] = [];
  let totalSize = 0;

  for (const file of files) {
    // Estimate base64 size (roughly 4/3 of original)
    const estimatedSize = (file.data.length * 3) / 4;
    
    if (totalSize + estimatedSize > maxSizeBytes) {
      console.warn(`File ${file.mimeType} exceeds size limit, skipping additional files`);
      break;
    }
    
    optimized.push(file);
    totalSize += estimatedSize;
  }

  return optimized;
}

// Session cache for file parts (to avoid re-uploading)
const sessionFileCache = new Map<string, FilePart[]>();

// Cache for uploaded file URIs (to avoid re-uploading the same file)
const fileUriCache = new Map<string, string>();

// Helper function to upload file using Gemini File API
async function uploadFileToGemini(
  filePart: FilePart,
  originalFileName?: string
): Promise<string> {
  // Check cache first
  const cacheKey = `${filePart.mimeType}-${filePart.data.substring(0, 100)}`;
  if (fileUriCache.has(cacheKey)) {
    return fileUriCache.get(cacheKey)!;
  }

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(filePart.data, 'base64');
    
    // Generate file extension from MIME type
    const mimeToExt: { [key: string]: string } = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/csv': 'csv',
    };
    const ext = mimeToExt[filePart.mimeType] || 'file';
    const safeFileName = originalFileName 
      ? originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      : `upload-${Date.now()}.${ext}`;
    
    // Write to temporary file
    const tempFilePath = join(tmpdir(), `gemini-upload-${Date.now()}-${safeFileName}`);
    await writeFile(tempFilePath, buffer);
    
    try {
      // Upload file using File API (using top-level fileManager)
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: filePart.mimeType,
        displayName: safeFileName,
      });
      
      // Cache the file URI
      const fileUri = uploadResult.file.uri;
      fileUriCache.set(cacheKey, fileUri);
      
      return fileUri;
    } finally {
      // Clean up temporary file
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temp file:", cleanupError);
      }
    }
  } catch (error) {
    console.error("Error uploading file to Gemini:", error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to estimate file size from base64 data
function estimateFileSize(base64Data: string): number {
  // Base64 is roughly 4/3 of original size
  return (base64Data.length * 3) / 4;
}

// Helper function to convert .docx files to text using mammoth
async function convertDocxToText(filePart: FilePart): Promise<string> {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(filePart.data, 'base64');
    
    // Convert .docx to HTML first, then extract text
    const result = await mammoth.extractRawText({ buffer });
    
    // Return the extracted text
    return result.value;
  } catch (error) {
    console.error("Error converting .docx to text:", error);
    throw new Error(`Failed to convert .docx file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to determine if a file should use File API (large documents) or inlineData (small files)
// Small File Shortcut: PDF/Image < 4MB use inlineData for speed (bypasses upload step)
function shouldUseFileAPI(mimeType: string, fileSizeBytes?: number): boolean {
  const fileAPITypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX - always use File API
    'application/vnd.ms-powerpoint', // PPT - always use File API
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX - always use File API
    'text/csv', // CSV - always use File API
  ];
  
  // Always use File API for Office documents
  if (fileAPITypes.includes(mimeType)) {
    return true;
  }
  
  // For PDF and Images: use inlineData if < 4MB (faster), File API if >= 4MB
  const smallFileTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  if (smallFileTypes.includes(mimeType)) {
    const sizeMB = fileSizeBytes ? fileSizeBytes / (1024 * 1024) : 0;
    return sizeMB >= 4; // Use File API only if >= 4MB
  }
  
  return false;
}

// Helper function to generate content stream with a specific model
async function* generateWithModelStream(
  genAI: GoogleGenerativeAI,
  modelName: string,
  systemInstruction: string,
  parts: Part[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationConfig?: Record<string, any>
): AsyncGenerator<string, void, unknown> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    safetySettings,
    generationConfig,
  });
  
  const stream = await model.generateContentStream(parts);
  
  for await (const chunk of stream.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

export type BrainMode = "auto" | "standard" | "speed";
export type GenerationType = "analysis" | "exam";

// Academic Peer Review system instruction (from academic-peer-review.md)
// Used for Audit Analysis with gemini-2.5-pro for higher reasoning
// Includes comprehensive frameworks moved from initial analysis for speed optimization
const ACADEMIC_PEER_REVIEW_SYSTEM_INSTRUCTION = `You are an Academic Peer Reviewer. Review business analysis for logical fallacies and apply comprehensive strategic frameworks.

## Review Criteria:
1. **Logical Fallacies:** Identify flawed reasoning, false assumptions, or logical inconsistencies.
2. **Executive Nuance:** Did the AI miss hidden risks, strategic blind spots, or subtle business implications?
3. **Framework Application:** Apply comprehensive frameworks:
   - Porter's Five Forces Analysis
   - SWOT Analysis
   - McKinsey 7S Framework
   - Blue Ocean Strategy
   - Value Chain Analysis
   - MECE Principle validation
4. **Financial Analysis:** If data available, calculate margins (Gross, Operating, Net), ROIC, NPV, and identify top revenue sources and cost structure.
5. **Confidence Score:** Provide a 'Confidence Score' from 1-10 based on soundness of principles, completeness of risk assessment, depth of insight, and framework accuracy.

## Process:
- Read the business analysis output.
- Identify logical fallacies and missing nuances.
- Apply comprehensive strategic frameworks.
- Highlight hidden risks or strategic blind spots.
- Provide detailed financial analysis if applicable.
- Provide a Confidence Score (1-10) with justification.`;

export async function generateMbaInsight(
  userPrompt: string,
  contextData?: string,
  course?: string,
  files?: FilePart[],
  brainMode: BrainMode = "auto",
  type: GenerationType = "analysis"
): Promise<ReadableStream<Uint8Array>> {
  
  // Select system instruction based on type
  const systemInstruction = type === "exam" 
    ? EXAM_GENERATOR_SYSTEM_INSTRUCTION 
    : MBA_PROFESSOR_SYSTEM_INSTRUCTION;
  
  // Build the prompt with context and course if provided
  let fullPrompt = userPrompt;
  const courseContext = course ? `Course Context: ${course}\n\n` : "";
  
  if (type === "exam") {
    // For exams, use a simpler prompt structure
    fullPrompt = `${courseContext}Based on the following lecture notes, generate MCQ questions:\n\n${contextData || userPrompt}`;
  } else {
    // For analysis, use concise prompt (reduced for faster Time to First Token)
    const fileInstruction = files && files.length > 0 
      ? `\n\nAnalyze all uploaded files comprehensively. Extract text, charts, tables, and visual data.`
      : "";
    
    if (contextData) {
      fullPrompt = `${courseContext}Context (Case Study/Reading Material):\n\n${contextData}${fileInstruction}\n\n---\n\nUser Question/Prompt:\n\n${userPrompt}`;
    } else if (files && files.length > 0) {
      fullPrompt = `${courseContext}${fileInstruction}\n\nUser Question/Prompt:\n\n${userPrompt}`;
    } else if (course) {
      fullPrompt = `${courseContext}${userPrompt}`;
    }
  }

  // Build parts array for multimodal input
  // Support both inlineData (for images) and fileData (for documents via File API)
  const parts: Part[] = [];

  // Add file parts if provided
  if (files && files.length > 0) {
    // Logging: Verify files received on server
    console.log(`[Server] Received ${files.length} file(s) for ${type}:`, 
      files.map(f => ({ 
        mimeType: f.mimeType, 
        dataLength: f.data?.length || 0,
        hasData: !!f.data && f.data.trim().length > 0 
      }))
    );

    // Validate base64 data is not empty before processing
    const validFiles = files.filter(f => {
      if (!f.data || f.data.trim().length === 0) {
        console.error(`[Server] Skipping file with empty data: ${f.mimeType}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      throw new Error("All uploaded files have empty or invalid data. Please re-upload.");
    }

    if (validFiles.length < files.length) {
      console.warn(`[Server] Filtered out ${files.length - validFiles.length} invalid file(s)`);
    }

    const optimizedFiles = optimizeFileParts(validFiles);
    
    // Store in session cache for reuse (simple in-memory cache)
    const cacheKey = `${type}-${brainMode}-${optimizedFiles.map(f => f.mimeType).join(',')}`;
    sessionFileCache.set(cacheKey, optimizedFiles);
    
    // Collect converted .docx text to add to prompt
    const docxTexts: string[] = [];
    
    // Process each file - Small File Shortcut: PDF/Image < 4MB use inlineData (faster)
    for (const file of optimizedFiles) {
      const fileSizeBytes = estimateFileSize(file.data);
      const sizeMB = fileSizeBytes / (1024 * 1024);
      
      // Logging: File processing decision
      console.log(`[Server] Processing file: ${file.mimeType}, Size: ${sizeMB.toFixed(2)}MB`);
      
      // Special handling for .docx files: convert to text using mammoth
      if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log(`[Server] Converting .docx to text using mammoth`);
        try {
          const docxText = await convertDocxToText(file);
          docxTexts.push(docxText);
          console.log(`[Server] Successfully converted .docx to text (${docxText.length} characters)`);
          continue; // Skip file upload, text will be added to prompt
        } catch (conversionError) {
          console.error(`[Server] Failed to convert .docx to text, falling back to File API:`, conversionError);
          // Fall through to File API upload as fallback
        }
      }
      
      if (shouldUseFileAPI(file.mimeType, fileSizeBytes)) {
        // Use File API for large files (>= 4MB) or Office documents
        console.log(`[Server] Using File API for ${file.mimeType} (${sizeMB.toFixed(2)}MB)`);
        try {
          const fileUri = await uploadFileToGemini(file);
          parts.push({
            fileData: {
              fileUri: fileUri,
              mimeType: file.mimeType,
            },
          });
          console.log(`[Server] File uploaded via File API: ${file.mimeType}, URI: ${fileUri.substring(0, 50)}...`);
        } catch (uploadError) {
          console.error(`[Server] Failed to upload ${file.mimeType} via File API, falling back to inlineData:`, uploadError);
          // Fallback to inlineData if File API fails
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data,
            },
          });
          console.log(`[Server] Using inlineData fallback for ${file.mimeType}`);
        }
      } else {
        // Small File Shortcut: Use inlineData for PDF/Image < 4MB (bypasses upload, much faster)
        console.log(`[Server] Using inlineData for ${file.mimeType} (${sizeMB.toFixed(2)}MB < 4MB threshold)`);
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data,
          },
        });
      }
    }
    
    // Add converted .docx text to prompt if any
    if (docxTexts.length > 0) {
      const docxContent = docxTexts.map((text, index) => 
        `\n\n--- Document ${index + 1} (from .docx file) ---\n\n${text}`
      ).join('\n\n');
      
      // Prepend docx content to the prompt
      fullPrompt = `${docxContent}\n\n---\n\n${fullPrompt}`;
    }
    
    // Logging: Final parts array for files
    console.log(`[Server] File parts added to request: ${parts.length} part(s)`, 
      parts.map(p => p.inlineData ? `inlineData:${p.inlineData.mimeType}` : `fileData:${p.fileData?.mimeType}`)
    );
  } else {
    console.log(`[Server] No files provided for ${type}`);
  }

  // Add text prompt (after files to ensure proper order)
  parts.push({ text: fullPrompt });
  
  // Logging: Final parts array including prompt
  console.log(`[Server] Total parts in request: ${parts.length} (${parts.filter(p => p.text).length} text, ${parts.filter(p => p.inlineData || p.fileData).length} file)`);

  // Configure generation settings: temperature 0.5 for both analysis and exam to minimize hallucination
  const generationConfig = type === "exam" 
    ? {
        temperature: 0.5,
        responseMimeType: "application/json" as const,
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            questions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  question: {
                    type: SchemaType.STRING,
                    description: "The question text"
                  },
                  options: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.STRING
                    },
                    description: "Array of answer options"
                  },
                  correctIndex: {
                    type: SchemaType.NUMBER,
                    description: "Zero-based index of the correct answer"
                  },
                  rationale: {
                    type: SchemaType.STRING,
                    description: "Explanation of why the correct answer is right"
                  }
                },
                required: ["question", "options", "correctIndex", "rationale"]
              }
            }
          },
          required: ["questions"]
        }
      }
    : {
        temperature: 0.5
      };

  // Determine models based on brain mode
  // Force Tier 1 for Speed: Initial Analysis ALWAYS starts with gemini-2.5-flash
  // Only use Tier 2 (Pro) if explicitly requested via "standard" mode or Audit Analysis
  let primaryModel: string;
  let fallbackModel: string;
  let usedModel: string = "";

  switch (brainMode) {
    case "standard":
      primaryModel = "gemini-2.5-pro";
      usedModel = "Gemini 2.5 Pro";
      break;
    case "speed":
      primaryModel = "gemini-2.5-flash";
      usedModel = "Gemini 2.5 Flash";
      break;
    case "auto":
    default:
      // Force Tier 1 for speed: Always start with Flash for Initial Analysis
      primaryModel = "gemini-2.5-flash";
      fallbackModel = "gemini-2.5-pro";
      usedModel = "Gemini 2.5 Flash";
      break;
  }
  
  // Override: For Initial Analysis (not Audit), always use Tier 1 for sub-5 second response
  if (type === "analysis" && brainMode === "auto") {
    primaryModel = "gemini-2.5-flash";
    usedModel = "Gemini 2.5 Flash";
  }

  // Create a readable stream
  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {
      try {
        // Send model info as first chunk with special prefix (will be filtered on client)
        controller.enqueue(encoder.encode(`\0MODEL:${usedModel}\n`));
        
        // For standard and speed modes, use model directly with Tier 3 fallback on 503/429
        if (brainMode === "standard" || brainMode === "speed") {
          try {
            for await (const chunk of generateWithModelStream(genAI, primaryModel, systemInstruction, parts, generationConfig)) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            // Robust Fallback: If 503/429, automatically retry with Tier 3 (Safety Net)
            if (isRetryableError(error)) {
              console.log(`Retryable error with ${primaryModel}, falling back to Tier 3 (gemini-2.5-flash-lite)`);
              const tier3Model = "gemini-2.5-flash-lite";
              usedModel = "Gemini 2.5 Flash Lite (Safety Net)";
              controller.enqueue(encoder.encode(`\0MODEL:${usedModel}\n`));
              
              try {
                for await (const chunk of generateWithModelStream(genAI, tier3Model, systemInstruction, parts, generationConfig)) {
                  controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
              } catch (tier3Error) {
                console.error("Tier 3 Safety Net also failed:", tier3Error);
                const errorMsg = tier3Error instanceof Error ? tier3Error.message : `Failed to generate ${type}`;
                controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
                controller.close();
              }
            } else {
              console.error(`Error with ${primaryModel}:`, error);
              const errorMsg = error instanceof Error ? error.message : `Failed to generate ${type}`;
              controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
              controller.close();
            }
          }
          return;
        }

        // Auto mode: Try primary model first (with retries)
        const maxRetries = 2;
        let success = false;
        
        for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
          try {
            for await (const chunk of generateWithModelStream(genAI, primaryModel, systemInstruction, parts, generationConfig)) {
              controller.enqueue(encoder.encode(chunk));
            }
            success = true;
            controller.close();
          } catch (error) {
            // Check for 404 (model not found) - verify model name
            if (error instanceof Error && error.message.toLowerCase().includes("404")) {
              console.error(`Model ${primaryModel} not found. Verify model name matches registry.`);
              const errorMsg = `Model ${primaryModel} not found. Please check model name.`;
              controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
              controller.close();
              return;
            }
            
            // If it's a retryable error and we haven't exhausted retries, wait and retry
            if (isRetryableError(error) && attempt < maxRetries) {
              console.log(`Retryable error on attempt ${attempt + 1}, waiting 5 seconds before retry...`);
              await sleep(5000);
              continue;
            }
            
            // If it's a retryable error but we've exhausted retries, fallback to Tier 3 (Safety Net)
            if (isRetryableError(error) && attempt === maxRetries) {
              console.log(`Primary model failed after retries, falling back to Tier 3 (gemini-2.5-flash-lite)`);
              const tier3Model = "gemini-2.5-flash-lite";
              usedModel = "Gemini 2.5 Flash Lite (Safety Net)";
              controller.enqueue(encoder.encode(`\0MODEL:${usedModel}\n`));
              
              try {
                for await (const chunk of generateWithModelStream(genAI, tier3Model, systemInstruction, parts, generationConfig)) {
                  controller.enqueue(encoder.encode(chunk));
                }
                success = true;
                controller.close();
              } catch (fallbackError) {
                console.error("Tier 3 Safety Net also failed:", fallbackError);
                const errorMsg = fallbackError instanceof Error ? fallbackError.message : `Failed to generate ${type} with all models`;
                controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
                controller.close();
              }
            } else {
              // Non-retryable error
              console.error(`Error generating ${type}:`, error);
              const errorMsg = error instanceof Error ? error.message : `Failed to generate ${type}`;
              controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
              controller.close();
            }
          }
        }
      } catch (error) {
        console.error("Unexpected error in stream:", error);
        const errorMsg = error instanceof Error ? error.message : "Unexpected error";
        controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
        controller.close();
      }
    },
  });
}

// Deep critique function using gemini-2.5-pro
export async function generateDeepCritique(
  existingAnalysis: string,
  contextData?: string,
  course?: string,
  files?: FilePart[]
): Promise<ReadableStream<Uint8Array>> {
  
  // Use academic-peer-review.md prompt structure with comprehensive frameworks
  const prompt = `Review the following business analysis for logical fallacies and apply comprehensive strategic frameworks:\n\n${existingAnalysis}\n\nFollow the Academic Peer Review process:
1. Identify logical fallacies and missing nuances.
2. Apply comprehensive frameworks: Porter's Five Forces, SWOT, McKinsey 7S, Blue Ocean, Value Chain Analysis, MECE validation.
3. If financial data is available, calculate margins (Gross, Operating, Net), ROIC, NPV, and identify top revenue sources and cost structure.
4. Highlight hidden risks or strategic blind spots.
5. Provide a Confidence Score (1-10) with justification based on soundness of business principles, completeness of risk assessment, depth of strategic insight, and accuracy of framework application.`;
  
  const courseContext = course ? `Course Context: ${course}\n\n` : "";
  let fullPrompt = `${courseContext}${prompt}`;

  // Build parts array
  // Support both inlineData (for images) and fileData (for documents via File API)
  const parts: Part[] = [];

  // Add file parts if provided (for reference)
  // Small File Shortcut: PDF/Image < 4MB use inlineData (faster)
  if (files && files.length > 0) {
    // Logging: Verify files received on server for audit
    console.log(`[Server] Received ${files.length} file(s) for audit:`, 
      files.map(f => ({ 
        mimeType: f.mimeType, 
        dataLength: f.data?.length || 0,
        hasData: !!f.data && f.data.trim().length > 0 
      }))
    );

    // Validate base64 data is not empty before processing
    const validFiles = files.filter(f => {
      if (!f.data || f.data.trim().length === 0) {
        console.error(`[Server] Skipping file with empty data: ${f.mimeType}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0 && files.length > 0) {
      throw new Error("All uploaded files have empty or invalid data. Please re-upload.");
    }

    const optimizedFiles = optimizeFileParts(validFiles);
    
    // Collect converted .docx text to add to prompt
    const docxTexts: string[] = [];
    
    for (const file of optimizedFiles) {
      const fileSizeBytes = estimateFileSize(file.data);
      const sizeMB = fileSizeBytes / (1024 * 1024);
      
      // Logging: File processing decision
      console.log(`[Server] Processing file for audit: ${file.mimeType}, Size: ${sizeMB.toFixed(2)}MB`);
      
      // Special handling for .docx files: convert to text using mammoth
      if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log(`[Server] Converting .docx to text using mammoth for audit`);
        try {
          const docxText = await convertDocxToText(file);
          docxTexts.push(docxText);
          console.log(`[Server] Successfully converted .docx to text for audit (${docxText.length} characters)`);
          continue; // Skip file upload, text will be added to prompt
        } catch (conversionError) {
          console.error(`[Server] Failed to convert .docx to text for audit, falling back to File API:`, conversionError);
          // Fall through to File API upload as fallback
        }
      }
      
      if (shouldUseFileAPI(file.mimeType, fileSizeBytes)) {
        // Use File API for large files (>= 4MB) or Office documents
        console.log(`[Server] Using File API for audit ${file.mimeType} (${sizeMB.toFixed(2)}MB)`);
        try {
          const fileUri = await uploadFileToGemini(file);
          parts.push({
            fileData: {
              fileUri: fileUri,
              mimeType: file.mimeType,
            },
          });
          console.log(`[Server] File uploaded via File API for audit: ${file.mimeType}, URI: ${fileUri.substring(0, 50)}...`);
        } catch (uploadError) {
          console.error(`[Server] Failed to upload ${file.mimeType} via File API, falling back to inlineData:`, uploadError);
          // Fallback to inlineData if File API fails
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data,
            },
          });
          console.log(`[Server] Using inlineData fallback for audit ${file.mimeType}`);
        }
      } else {
        // Small File Shortcut: Use inlineData for PDF/Image < 4MB (bypasses upload, much faster)
        console.log(`[Server] Using inlineData for audit ${file.mimeType} (${sizeMB.toFixed(2)}MB < 4MB threshold)`);
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data,
          },
        });
      }
    }
    
    // Add converted .docx text to prompt if any
    if (docxTexts.length > 0) {
      const docxContent = docxTexts.map((text, index) => 
        `\n\n--- Document ${index + 1} (from .docx file) ---\n\n${text}`
      ).join('\n\n');
      
      // Prepend docx content to the prompt
      fullPrompt = `${docxContent}\n\n---\n\n${fullPrompt}`;
    }
    
    // Logging: Final parts array for files
    console.log(`[Server] File parts added to audit request: ${parts.length} part(s)`, 
      parts.map(p => p.inlineData ? `inlineData:${p.inlineData.mimeType}` : `fileData:${p.fileData?.mimeType}`)
    );
  } else {
    console.log(`[Server] No files provided for audit`);
  }

  // Add text prompt (after files to ensure proper order)
  parts.push({ text: fullPrompt });
  
  // Logging: Final parts array including prompt
  console.log(`[Server] Total parts in audit request: ${parts.length} (${parts.filter(p => p.text).length} text, ${parts.filter(p => p.inlineData || p.fileData).length} file)`);

  // Configure generation settings: temperature 0.5 to minimize hallucination
  const generationConfig = {
    temperature: 0.5
  };

  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\0MODEL:Gemini 2.5 Pro (Academic Peer Review)\n`));
        
        try {
          // Force gemini-2.5-pro for higher reasoning (Tier 2 equivalent for Audit Analysis)
          for await (const chunk of generateWithModelStream(genAI, "gemini-2.5-pro", ACADEMIC_PEER_REVIEW_SYSTEM_INSTRUCTION, parts, generationConfig)) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          console.error("Error with deep critique:", error);
          const errorMsg = error instanceof Error ? error.message : "Failed to generate deep critique";
          controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
          controller.close();
        }
      } catch (error) {
        console.error("Unexpected error in deep critique stream:", error);
        const errorMsg = error instanceof Error ? error.message : "Unexpected error";
        controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
        controller.close();
      }
    },
  });
}

// Generate learning opportunities based on exam results
export async function generateLearningOpportunities(
  examQuestions: ExamQuestion[],
  selectedAnswers: { [key: number]: number },
  course?: string
): Promise<ReadableStream<Uint8Array>> {
  // Calculate which questions were answered incorrectly
  const incorrectQuestions: ExamQuestion[] = [];
  examQuestions.forEach((q, idx) => {
    if (selectedAnswers[idx] !== q.correctIndex) {
      incorrectQuestions.push(q);
    }
  });

  // Build prompt with exam results
  const courseContext = course ? `Course Context: ${course}\n\n` : "";
  const score = {
    correct: examQuestions.filter((q, idx) => selectedAnswers[idx] === q.correctIndex).length,
    total: examQuestions.length,
  };
  
  let prompt = `${courseContext}The student completed an exam with a score of ${score.correct}/${score.total} (${Math.round((score.correct / score.total) * 100)}%).

Exam Questions and Answers:
${examQuestions.map((q, idx) => {
  const isCorrect = selectedAnswers[idx] === q.correctIndex;
  const selectedOption = q.options[selectedAnswers[idx] || -1] || 'Not answered';
  return `Q${idx + 1}: ${q.question}
Selected: ${selectedOption} ${isCorrect ? '✓' : '✗'}
Correct Answer: ${q.options[q.correctIndex]}
Professor's Note: ${q.rationale}
`;
}).join('\n')}

${incorrectQuestions.length > 0 ? `\nQuestions answered incorrectly:\n${incorrectQuestions.map((q, idx) => `- ${q.question}`).join('\n')}` : '\nThe student answered all questions correctly!'}

Based on this performance, generate 3 Learning Opportunities following the guidelines in learning-opportunity.md.`;

  // Use the learning opportunity system instruction
  const parts: Part[] = [{ text: prompt }];

  const generationConfig = {
    temperature: 0.7, // Slightly higher for more creative learning opportunities
  };

  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\0MODEL:Gemini 2.5 Flash (Learning Opportunities)\n`));
        
        try {
          // Use Flash for speed
          for await (const chunk of generateWithModelStream(genAI, "gemini-2.5-flash", LEARNING_OPPORTUNITY_SYSTEM_INSTRUCTION, parts, generationConfig)) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          console.error("Error generating learning opportunities:", error);
          const errorMsg = error instanceof Error ? error.message : "Failed to generate learning opportunities";
          controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
          controller.close();
        }
      } catch (error) {
        console.error("Unexpected error in learning opportunities stream:", error);
        const errorMsg = error instanceof Error ? error.message : "Unexpected error";
        controller.enqueue(encoder.encode(`\0ERROR:${errorMsg}`));
        controller.close();
      }
    },
  });
}
