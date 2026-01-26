"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { generateMbaInsight, generateDeepCritique, type FilePart, type BrainMode } from "@/app/actions/gemini";
import { generateExam, type ExamQuestion } from "@/app/actions/exam";
import { processFile, validateFile, type FileData } from "@/lib/file-utils";
import ReactMarkdown from "react-markdown";

type CaseAnalysisStep = "upload" | "results";
type ExamStep = "upload" | "generate" | "results" | "explore";

export default function Dashboard() {
  // Mode selection
  const [activeMode, setActiveMode] = useState<"case-analysis" | "mock-exam">("case-analysis");

  // Case Analysis state
  const [caseAnalysisStep, setCaseAnalysisStep] = useState<CaseAnalysisStep>("upload");
  const [caseStudyText, setCaseStudyText] = useState("");
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [insight, setInsight] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [usedModel, setUsedModel] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isGettingDeepCritique, setIsGettingDeepCritique] = useState(false);
  const [deepCritique, setDeepCritique] = useState<string>("");

  // Mock Exam state
  const [examStep, setExamStep] = useState<ExamStep>("upload");
  const [lectureNotes, setLectureNotes] = useState("");
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [uploadedExamFiles, setUploadedExamFiles] = useState<FileData[]>([]);
  const [examScore, setExamScore] = useState<{ correct: number; total: number; percentage: number } | null>(null);
  const [examProcessingStatus, setExamProcessingStatus] = useState<string>("");

  // Shared state
  const [error, setError] = useState<string>("");
  const [modelContext, setModelContext] = useState<string>("");
  const [brainMode, setBrainMode] = useState<BrainMode>("auto");

  const contextOptions = [
    { value: "", label: "Auto-detect" },
    { value: "General", label: "General" },
    { value: "Finance", label: "Finance" },
    { value: "Marketing", label: "Marketing" },
    { value: "Strategy", label: "Strategy" },
  ];

  // File upload handlers
  const onDropCaseAnalysis = useCallback(async (acceptedFiles: File[]) => {
    setError("");
    for (const file of acceptedFiles) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        continue;
      }

      try {
        const fileData = await processFile(file);
        setUploadedFiles((prev) => [...prev, fileData]);
        setCaseAnalysisStep("results");
      } catch (err) {
        setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }, []);

  const onDropExam = useCallback(async (acceptedFiles: File[]) => {
    setError("");
    for (const file of acceptedFiles) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        continue;
      }

      try {
        const fileData = await processFile(file);
        setUploadedExamFiles((prev) => [...prev, fileData]);
        setExamStep("generate");
      } catch (err) {
        setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }, []);

  const { getRootProps: getCaseAnalysisRootProps, getInputProps: getCaseAnalysisInputProps, isDragActive: isCaseAnalysisDragActive } = useDropzone({
    onDrop: onDropCaseAnalysis,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/csv': ['.csv'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxSize: 20 * 1024 * 1024,
  });

  const { getRootProps: getExamRootProps, getInputProps: getExamInputProps, isDragActive: isExamDragActive } = useDropzone({
    onDrop: onDropExam,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/csv': ['.csv'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxSize: 20 * 1024 * 1024,
  });

  const handleAnalyze = async () => {
    if (!caseStudyText.trim() && uploadedFiles.length === 0) {
      setError("Please paste text or upload a file.");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setInsight("");
    setUsedModel("");
    setProcessingStatus("Reading PDF Content...");
    setCaseAnalysisStep("results");

    try {
      // Speed-First Lean Prompt (400 words max, no frameworks)
      const defaultPrompt = `Analyze this case study with high-speed precision. Focus on signal over noise.

Structure your analysis as follows:
1. **BLUF (Bottom Line Up Front):** 2-3 sentence summary
2. **Critical Challenge:** The single most important strategic problem (1-2 sentences)
3. **Key Insight:** One core business insight (1-2 sentences)
4. **Immediate Action:** One actionable recommendation (1 sentence)

Keep total response under 400 words. Use bullet points. Avoid verbose explanations.`;

      const prompt = analysisPrompt.trim() || defaultPrompt;
      
      const fileParts: FilePart[] = uploadedFiles.map((f) => ({
        mimeType: f.mimeType,
        data: f.data,
      }));

      // Data verification: Log file data before sending
      if (fileParts.length > 0) {
        console.log(`[Client] Sending ${fileParts.length} file(s) to server:`, 
          fileParts.map(f => ({ 
            mimeType: f.mimeType, 
            dataLength: f.data?.length || 0,
            hasData: !!f.data && f.data.length > 0 
          }))
        );
        
        // Validate base64 data is not empty
        const invalidFiles = fileParts.filter(f => !f.data || f.data.trim().length === 0);
        if (invalidFiles.length > 0) {
          setError(`Invalid file data detected. Please re-upload the file(s).`);
          setIsAnalyzing(false);
          return;
        }
      }

      // Quick status update (no artificial delays for speed)
      if (uploadedFiles.length > 0) {
        setProcessingStatus("Processing files...");
      } else {
        setProcessingStatus("Streaming analysis...");
      }

      // Get the stream from the server action
      const stream = await generateMbaInsight(
        prompt,
        caseStudyText || undefined,
        modelContext || undefined,
        fileParts.length > 0 ? fileParts : undefined,
        brainMode
      );

      // Read the stream with robust error handling
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      try {
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                accumulatedText += buffer;
                setInsight(accumulatedText);
              }
              break;
            }

            try {
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process complete lines for metadata, but update UI immediately with any text
              const lines = buffer.split('\n');
              buffer = lines.pop() || ""; // Keep incomplete line in buffer

              for (const line of lines) {
                try {
                  if (line.startsWith('\0MODEL:')) {
                    const modelName = line.substring(7).trim();
                    setUsedModel(modelName);
                  } else if (line.startsWith('\0ERROR:')) {
                    const errorMsg = line.substring(7).trim();
                    setError(errorMsg);
                    setIsAnalyzing(false);
                    return;
                  } else if (line.trim() && !line.startsWith('\0')) {
                    // Append to accumulated text and update UI immediately (chunk-by-chunk)
                    accumulatedText += line + '\n';
                    setInsight(accumulatedText);
                  }
                } catch (lineError) {
                  // Skip invalid lines, continue processing
                  console.warn("Error processing line:", lineError);
                  continue;
                }
              }
              
              // Also update UI with incomplete buffer content for instant feedback
              if (buffer.trim() && !buffer.startsWith('\0')) {
                setInsight(accumulatedText + buffer);
              }
            } catch (chunkError) {
              // If chunk decoding fails, skip it and continue
              console.warn("Error decoding chunk:", chunkError);
              continue;
            }
          } catch (readError) {
            // If reading fails, log and break
            console.error("Error reading stream:", readError);
            setError("Stream reading error. Please try again.");
            break;
          }
        }
      } catch (streamError) {
        console.error("Stream error:", streamError);
        setError("Stream processing error. Please try again.");
      } finally {
        try {
          reader.releaseLock();
        } catch (releaseError) {
          console.warn("Error releasing reader:", releaseError);
        }
        setProcessingStatus("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze case study");
      setProcessingStatus("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to extract JSON from a messy AI string
  const extractJson = (text: string): ExamQuestion[] | null => {
    console.log("RAW AI OUTPUT:", text); // Check your F12 console for this!
    try {
      // 1. Remove markdown code blocks and whitespace
      let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      // 2. Look for the start of an object or array
      const startObj = cleaned.indexOf('{');
      const startArr = cleaned.indexOf('[');
      const start = (startObj !== -1 && (startArr === -1 || startObj < startArr)) ? startObj : startArr;
      
      const endObj = cleaned.lastIndexOf('}');
      const endArr = cleaned.lastIndexOf(']');
      const end = (endObj !== -1 && endObj > endArr) ? endObj : endArr;

      if (start !== -1 && end !== -1) {
        cleaned = cleaned.substring(start, end + 1);
      }

      // 3. Fix common 'Single Quote' mistake from AI
      // Note: This is a hack, the Schema fix in Step 1 is the real solution
      const parsed = JSON.parse(cleaned);
      return parsed.questions || parsed; // Handle both {questions: []} and []
    } catch (e) {
      console.error("JSON Parse failed. Raw text was:", text);
      return null;
    }
  };

  const handleGenerateExam = async () => {
    if (!lectureNotes.trim() && uploadedExamFiles.length === 0) {
      setError("Please paste text or upload a file.");
      return;
    }

    setIsGeneratingExam(true);
    setError("");
    setExamQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setExamScore(null);
    setExamProcessingStatus("Reading PDF Content...");
    setExamStep("results");

    try {
      const fileParts: FilePart[] = uploadedExamFiles.map((f) => ({
        mimeType: f.mimeType,
        data: f.data,
      }));

      // Quick status update (no artificial delays for speed)
      if (uploadedExamFiles.length > 0) {
        setExamProcessingStatus("Processing files...");
      } else {
        setExamProcessingStatus("Generating questions...");
      }

      // Force speed mode (gemini-2.5-flash) for Mock Exam - better at JSON formatting
      const stream = await generateExam(
        lectureNotes || "",
        modelContext || undefined,
        fileParts.length > 0 ? fileParts : undefined,
        "speed" // Always use Flash for exams - better JSON compliance
      );

      // Read the stream into a buffer - don't parse until complete
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      try {
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                accumulatedText += buffer;
              }
              break;
            }

            try {
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process complete lines for metadata only
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";

              for (const line of lines) {
                try {
                  if (line.startsWith('\0MODEL:')) {
                    const modelName = line.substring(7).trim();
                    setUsedModel(modelName);
                  } else if (line.startsWith('\0ERROR:')) {
                    const errorMsg = line.substring(7).trim();
                    setError(errorMsg);
                    setIsGeneratingExam(false);
                    setExamStep("generate");
                    return;
                  } else if (line.trim() && !line.startsWith('\0')) {
                    // Just accumulate - don't try to parse yet
                    accumulatedText += line + '\n';
                  }
                } catch (lineError) {
                  // Skip invalid lines, continue processing
                  console.warn("Error processing line:", lineError);
                  continue;
                }
              }
            } catch (chunkError) {
              // If chunk decoding fails, skip it and continue
              console.warn("Error decoding chunk:", chunkError);
              continue;
            }
          } catch (readError) {
            // If reading fails, log and break
            console.error("Error reading stream:", readError);
            setError("Stream reading error. Please try again.");
            break;
          }
        }

        // Now that stream is complete, check for errors before parsing
        setExamProcessingStatus("Parsing questions...");
        
        // Error Shield: Check if response contains error message before parsing JSON
        if (accumulatedText.trim().startsWith('ERROR:') || accumulatedText.includes('\0ERROR:')) {
          // Extract error message if present, otherwise show friendly message
          const errorMatch = accumulatedText.match(/\0ERROR:(.+)/) || accumulatedText.match(/ERROR:(.+)/);
          const errorMessage = errorMatch && errorMatch[1].trim() 
            ? errorMatch[1].trim() 
            : "The Professors are busy. Retrying with the Safety Net model...";
          setError(errorMessage);
          setExamStep("generate");
          setIsGeneratingExam(false);
          return;
        }
        
        // Use robust JSON extraction helper
        const extracted = extractJson(accumulatedText);
        
        if (!extracted) {
          setError("The Professor generated a messy exam format. Click Generate again to retry.");
          setExamStep("generate");
          setIsGeneratingExam(false);
          return;
        }
        
        // Validate each question
        try {
          const validQuestions = extracted.filter((q: any) => 
            q.question && 
            typeof q.question === "string" &&
            Array.isArray(q.options) && 
            q.options.length >= 2 &&
            q.options.length <= 6 && // Reasonable limit
            typeof q.correctIndex === "number" && 
            q.correctIndex >= 0 &&
            q.correctIndex < q.options.length &&
            q.rationale &&
            typeof q.rationale === "string"
          );
          
          if (validQuestions.length > 0) {
            setExamQuestions(validQuestions);
          } else {
            setError("The Professor generated a messy exam format. Click Generate again to retry.");
            setExamStep("generate");
          }
        } catch (validationError) {
          console.error("Question validation error:", validationError);
          setError("The Professor generated a messy exam format. Click Generate again to retry.");
          setExamStep("generate");
        }
      } catch (streamError) {
        console.error("Stream error:", streamError);
        setError("Stream processing error. Please try again.");
      } finally {
        try {
          reader.releaseLock();
        } catch (releaseError) {
          console.warn("Error releasing reader:", releaseError);
        }
        setExamProcessingStatus("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate exam");
      setExamProcessingStatus("");
      setExamStep("generate");
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: answerIndex,
    }));
  };

  const handleViewResults = () => {
    let correct = 0;
    examQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correct++;
      }
    });
    const score = { correct, total: examQuestions.length, percentage: Math.round((correct / examQuestions.length) * 100) };
    setExamScore(score);
    setShowResults(true);
    setExamStep("explore");
  };

  const handleDeepCritique = async () => {
    if (!insight.trim()) {
      setError("No analysis available for critique. Please generate an analysis first.");
      return;
    }

    setIsGettingDeepCritique(true);
    setError("");
    setDeepCritique("");

    try {
      const fileParts: FilePart[] = uploadedFiles.map((f) => ({
        mimeType: f.mimeType,
        data: f.data,
      }));

      // Data verification: Log file data before sending
      if (fileParts.length > 0) {
        console.log(`[Client] Sending ${fileParts.length} file(s) to server for audit:`, 
          fileParts.map(f => ({ 
            mimeType: f.mimeType, 
            dataLength: f.data?.length || 0,
            hasData: !!f.data && f.data.length > 0 
          }))
        );
        
        // Validate base64 data is not empty
        const invalidFiles = fileParts.filter(f => !f.data || f.data.trim().length === 0);
        if (invalidFiles.length > 0) {
          setError(`Invalid file data detected. Please re-upload the file(s).`);
          setIsGettingDeepCritique(false);
          return;
        }
      }

      const stream = await generateDeepCritique(
        insight,
        caseStudyText || undefined,
        modelContext || undefined,
        fileParts.length > 0 ? fileParts : undefined
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      try {
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              if (buffer.trim()) {
                accumulatedText += buffer;
                setDeepCritique(accumulatedText);
              }
              break;
            }

            try {
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";

              for (const line of lines) {
                try {
                  if (line.startsWith('\0MODEL:')) {
                    // Model info - can be ignored or displayed
                  } else if (line.startsWith('\0ERROR:')) {
                    const errorMsg = line.substring(7).trim();
                    setError(errorMsg);
                    setIsGettingDeepCritique(false);
                    return;
                  } else if (line.trim() && !line.startsWith('\0')) {
                    accumulatedText += line + '\n';
                    setDeepCritique(accumulatedText);
                  }
                } catch (lineError) {
                  console.warn("Error processing line:", lineError);
                  continue;
                }
              }
            } catch (chunkError) {
              console.warn("Error decoding chunk:", chunkError);
              continue;
            }
          } catch (readError) {
            console.error("Error reading stream:", readError);
            setError("Stream reading error. Please try again.");
            break;
          }
        }
      } catch (streamError) {
        console.error("Stream error:", streamError);
        setError("Stream processing error. Please try again.");
      } finally {
        try {
          reader.releaseLock();
        } catch (releaseError) {
          console.warn("Error releasing reader:", releaseError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate deep critique");
    } finally {
      setIsGettingDeepCritique(false);
    }
  };

  const handleClearAnalysis = () => {
    setInsight("");
    setDeepCritique("");
    setError("");
    setUsedModel("");
    setProcessingStatus("");
    setCaseAnalysisStep("upload");
    setUploadedFiles([]);
    setCaseStudyText("");
    setAnalysisPrompt("");
    setIsAnalyzing(false);
    setIsGettingDeepCritique(false);
  };

  const handleClearExam = () => {
    setExamQuestions([]);
    setError("");
    setUsedModel("");
    setExamProcessingStatus("");
    setExamStep("upload");
    setUploadedExamFiles([]);
    setLectureNotes("");
    setSelectedAnswers({});
    setShowResults(false);
    setExamScore(null);
    setCurrentQuestionIndex(0);
    setIsGeneratingExam(false);
  };

  const currentQuestion = examQuestions[currentQuestionIndex];
  const hasSelectedAnswer = currentQuestion && selectedAnswers[currentQuestionIndex] !== undefined;
  const isCorrect = currentQuestion && selectedAnswers[currentQuestionIndex] === currentQuestion.correctIndex;

  // Render Center Canvas Content
  const renderCenterCanvas = () => {
    if (activeMode === "case-analysis") {
      if (isAnalyzing || processingStatus) {
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a] mb-4"></div>
            <p className="text-slate-600 mb-2">Analyzing case study...</p>
            {processingStatus && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">{processingStatus}</p>
                <Button
                  onClick={handleClearAnalysis}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
            {insight && (
              <div className="mt-6 w-full max-w-[800px]">
                <div className="mb-4 p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                  <p className="text-xs text-slate-500">Streaming results...</p>
                  <Button
                    onClick={handleClearAnalysis}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
                <div className="prose prose-slate max-w-none" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif" }}>
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => (
                        <h1 className="text-3xl font-bold mb-6 mt-0 text-slate-900 border-b border-slate-200 pb-3" {...props} />
                      ),
                      h2: ({node, ...props}) => (
                        <h2 className="text-2xl font-semibold mb-4 mt-8 text-slate-900 first:mt-0" {...props} />
                      ),
                      h3: ({node, ...props}) => (
                        <h3 className="text-xl font-semibold mb-3 mt-6 text-slate-900" {...props} />
                      ),
                      p: ({node, ...props}) => (
                        <p className="text-justify text-base leading-relaxed mb-6 text-slate-800" style={{ textAlign: 'justify', textAlignLast: 'left', wordSpacing: 'normal' }} {...props} />
                      ),
                      ul: ({node, ...props}) => (
                        <ul className="list-disc list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                      ),
                      ol: ({node, ...props}) => (
                        <ol className="list-decimal list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                      ),
                      li: ({node, ...props}) => (
                        <li className="text-slate-700 leading-relaxed" {...props} />
                      ),
                      strong: ({node, ...props}) => (
                        <strong className="font-semibold text-slate-900" {...props} />
                      ),
                      code: ({node, ...props}) => (
                        <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-800" {...props} />
                      ),
                      blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-4 border-[#1e3a8a] pl-4 italic text-slate-600 my-6" {...props} />
                      ),
                    }}
                  >
                    {insight}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      }
      if (insight) {
        return (
          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              {usedModel && (
                <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-600">
                    <span className="font-medium">Status:</span> Analyzed by {usedModel}
                  </p>
                </div>
              )}
              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={handleDeepCritique}
                  disabled={isGettingDeepCritique}
                  variant="default"
                  size="lg"
                  className="bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-2.5"
                >
                  {isGettingDeepCritique ? "Analyzing..." : "Audit Analysis"}
                </Button>
                <Button
                  onClick={handleClearAnalysis}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="prose prose-slate max-w-none" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif" }}>
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => (
                    <h1 className="text-3xl font-bold mb-6 mt-0 text-slate-900 border-b border-slate-200 pb-3" style={{ borderBottomWidth: '1px' }} {...props} />
                  ),
                  h2: ({node, ...props}) => (
                    <h2 className="text-2xl font-semibold mb-4 mt-8 text-slate-900 first:mt-0" {...props} />
                  ),
                  h3: ({node, ...props}) => (
                    <h3 className="text-xl font-semibold mb-3 mt-6 text-slate-900" {...props} />
                  ),
                  p: ({node, ...props}) => (
                    <p className="text-justify text-base leading-relaxed mb-6 text-slate-800" style={{ textAlign: 'justify', textAlignLast: 'left', textJustify: 'inter-word' }} {...props} />
                  ),
                  ul: ({node, ...props}) => (
                    <ul className="list-disc list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                  ),
                  ol: ({node, ...props}) => (
                    <ol className="list-decimal list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                  ),
                  li: ({node, ...props}) => (
                    <li className="text-slate-700 leading-relaxed" {...props} />
                  ),
                  strong: ({node, ...props}) => (
                    <strong className="font-semibold text-slate-900" {...props} />
                  ),
                  code: ({node, ...props}) => (
                    <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-800" {...props} />
                  ),
                  blockquote: ({node, ...props}) => (
                    <blockquote className="border-l-4 border-[#1e3a8a] pl-4 italic text-slate-600 my-6" {...props} />
                  ),
                }}
              >
                {insight}
              </ReactMarkdown>
            </div>
            {deepCritique && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Audit Analysis</h3>
                  <Button
                    onClick={() => setDeepCritique("")}
                    variant="outline"
                    size="sm"
                  >
                    Hide
                  </Button>
                </div>
                <div className="prose prose-slate max-w-none font-serif" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => (
                        <h1 className="text-3xl font-bold mb-6 mt-0 text-slate-900 border-b border-slate-200 pb-3" {...props} />
                      ),
                      h2: ({node, ...props}) => (
                        <h2 className="text-2xl font-semibold mb-4 mt-8 text-slate-900 first:mt-0" {...props} />
                      ),
                      h3: ({node, ...props}) => (
                        <h3 className="text-xl font-semibold mb-3 mt-6 text-slate-900" {...props} />
                      ),
                      p: ({node, ...props}) => (
                        <p className="text-justify text-base leading-relaxed mb-6 text-slate-800" style={{ textAlign: 'justify', textAlignLast: 'left', wordSpacing: 'normal' }} {...props} />
                      ),
                      ul: ({node, ...props}) => (
                        <ul className="list-disc list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                      ),
                      ol: ({node, ...props}) => (
                        <ol className="list-decimal list-outside mb-6 space-y-2 text-slate-700 ml-6 text-lg" {...props} />
                      ),
                      li: ({node, ...props}) => (
                        <li className="text-slate-700 leading-relaxed" {...props} />
                      ),
                      strong: ({node, ...props}) => (
                        <strong className="font-semibold text-slate-900" {...props} />
                      ),
                      code: ({node, ...props}) => (
                        <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-800" {...props} />
                      ),
                      blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-4 border-[#1e3a8a] pl-4 italic text-slate-600 my-6" {...props} />
                      ),
                    }}
                  >
                    {deepCritique}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {isGettingDeepCritique && !deepCritique && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1e3a8a]"></div>
                  <p className="text-sm text-slate-600">Running Academic Peer Review with Gemini 2.5 Pro...</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">Case analysis will appear here</p>
          <p className="text-sm text-slate-400 mt-2">Upload a file or paste text to begin</p>
        </div>
      );
    } else {
      // Mock Exam Center Canvas
      if (isGeneratingExam || examProcessingStatus) {
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a] mb-4"></div>
            <p className="text-slate-600 mb-2">Generating exam questions...</p>
            {examProcessingStatus && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">{examProcessingStatus}</p>
              </div>
            )}
            {examQuestions.length > 0 && (
              <div className="mt-6 w-full max-w-[800px] space-y-4">
                <div className="mb-4 p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Streaming questions... ({examQuestions.length} generated so far)
                  </p>
                  <Button
                    onClick={handleClearExam}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
                {examQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-white">
                    <p className="font-semibold text-slate-900 mb-2 text-justify leading-relaxed" style={{ textAlign: 'justify', textAlignLast: 'left' }}>Q{idx + 1}: {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="p-2 bg-slate-50 rounded text-sm">
                          {String.fromCharCode(65 + optIdx)}. {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!examQuestions.length && (
              <Button
                onClick={handleClearExam}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      }
      if (examQuestions.length > 0 && !showResults) {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600 mb-2">
                  Question {currentQuestionIndex + 1} of {examQuestions.length}
                </p>
                <div className="h-2 bg-slate-200 rounded-full">
                  <div
                    className="h-2 bg-[#1e3a8a] rounded-full transition-all"
                    style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button
                onClick={handleClearExam}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                Clear
              </Button>
            </div>
            <div className="p-6 border border-slate-200 rounded-lg bg-white">
              <h3 className="text-2xl font-semibold text-slate-900 mb-6 text-justify leading-relaxed" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif", textAlign: 'justify', textAlignLast: 'left' }}>
                {currentQuestion.question}
              </h3>
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((opt, optIdx) => (
                  <label
                    key={optIdx}
                    className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition-colors ${
                      selectedAnswers[currentQuestionIndex] === optIdx
                        ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestionIndex}`}
                      checked={selectedAnswers[currentQuestionIndex] === optIdx}
                      onChange={() => handleAnswerSelect(currentQuestionIndex, optIdx)}
                      className="mt-1"
                    />
                    <span className="text-lg">
                      <span className="font-medium">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                    </span>
                  </label>
                ))}
              </div>
              {hasSelectedAnswer && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Professor's Note:</p>
                  <p className="text-sm text-blue-800 mb-3 text-justify leading-relaxed" style={{ textAlign: 'justify', textAlignLast: 'left' }}>{currentQuestion.rationale}</p>
                  {isCorrect ? (
                    <p className="text-sm font-semibold text-green-700">✓ Correct!</p>
                  ) : (
                    <p className="text-sm font-semibold text-red-700">
                      ✗ Incorrect. The correct answer is {String.fromCharCode(65 + currentQuestion.correctIndex)}.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                variant="outline"
                className="flex-1"
              >
                Previous
              </Button>
              {currentQuestionIndex < examQuestions.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  disabled={!hasSelectedAnswer}
                  className="flex-1 bg-[#1e3a8a] hover:bg-[#1e40af] text-white"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleViewResults}
                  disabled={!hasSelectedAnswer}
                  className="flex-1 bg-[#1e3a8a] hover:bg-[#1e40af] text-white"
                >
                  View Results
                </Button>
              )}
            </div>
          </div>
        );
      }
      if (showResults && examScore) {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 p-6 bg-slate-50 rounded-lg border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Exam Results</h2>
                <div className="text-4xl font-bold text-[#1e3a8a] mb-2">{examScore.percentage}%</div>
                <p className="text-lg text-slate-600">
                  {examScore.correct} out of {examScore.total} questions correct
                </p>
              </div>
              <Button
                onClick={handleClearExam}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                Clear
              </Button>
            </div>
            {examQuestions.map((q, idx) => {
              const isQCorrect = selectedAnswers[idx] === q.correctIndex;
              return (
                <div key={idx} className="p-6 border border-slate-200 rounded-lg bg-white">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="font-semibold text-slate-900 text-lg">Q{idx + 1}:</span>
                    <p className="flex-1 text-slate-900 text-base text-justify leading-relaxed" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif", textAlign: 'justify', textAlignLast: 'left' }}>
                      {q.question}
                    </p>
                    {isQCorrect ? (
                      <span className="text-green-600 font-semibold text-xl">✓</span>
                    ) : (
                      <span className="text-red-600 font-semibold text-xl">✗</span>
                    )}
                  </div>
                  <div className="space-y-2 mb-4">
                    {q.options.map((opt, optIdx) => {
                      const isCorrectOption = optIdx === q.correctIndex;
                      const isSelected = selectedAnswers[idx] === optIdx;
                      let bgColor = "bg-white";
                      if (isCorrectOption) bgColor = "bg-green-50 border-green-300";
                      else if (isSelected && !isCorrectOption) bgColor = "bg-red-50 border-red-300";

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 border rounded ${bgColor} ${
                            isCorrectOption ? "border-green-400" : isSelected ? "border-red-400" : "border-slate-200"
                          }`}
                        >
                          <span className="font-medium text-slate-700">{String.fromCharCode(65 + optIdx)}.</span>{" "}
                          <span className={isCorrectOption ? "font-semibold text-green-800" : ""}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Professor's Note:</p>
                    <p className="text-sm text-blue-800">{q.rationale}</p>
                  </div>
                </div>
              );
            })}
            {examStep === "explore" && (
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 mt-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">Explore Further</h3>
                <p className="text-slate-700 mb-4">
                  Would you like to generate follow-up questions or dive deeper into any specific topic?
                </p>
                <Button
                  onClick={() => {
                    setExamStep("upload");
                    setExamQuestions([]);
                    setSelectedAnswers({});
                    setShowResults(false);
                    setExamScore(null);
                    setUploadedExamFiles([]);
                    setLectureNotes("");
                  }}
                  variant="outline"
                >
                  Start New Exam
                </Button>
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg">Exam questions will appear here</p>
          <p className="text-sm text-slate-400 mt-2">Upload a file or paste text to begin</p>
        </div>
      );
    }
  };

  // Render Control Panel Content
  const renderControlPanel = () => {
    if (activeMode === "case-analysis") {
      if (caseAnalysisStep === "upload") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Case Study Input</h3>
              <p className="text-sm text-slate-600 mb-4">Upload a file or paste text below</p>
            </div>
            <div
              {...getCaseAnalysisRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
                isCaseAnalysisDragActive
                  ? "border-[#1e3a8a] bg-blue-50"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input {...getCaseAnalysisInputProps()} />
              <div className="flex flex-col items-center justify-center text-center">
                <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-700 mb-1">Drop Case Study (PDF/PPTX/Image)</p>
                <p className="text-xs text-slate-500">or click to browse</p>
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 w-full space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs text-slate-700 truncate flex-1">{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="ml-2 text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Or paste text:</label>
              <textarea
                value={caseStudyText}
                onChange={(e) => setCaseStudyText(e.target.value)}
                placeholder="Paste case study text here..."
                className="w-full h-32 p-4 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Prompt (Optional)</label>
              <input
                type="text"
                value={analysisPrompt}
                onChange={(e) => setAnalysisPrompt(e.target.value)}
                placeholder="e.g., Focus on Porter's Five Forces"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <p className="text-xs text-red-800 text-justify leading-relaxed" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif", textAlign: 'justify', textAlignLast: 'left' }}>{error}</p>
                <Button
                  onClick={handleClearAnalysis}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Clear & Try Again
                </Button>
              </div>
            )}
          </div>
        );
      }
      return null; // Results shown in center canvas
    } else {
      // Mock Exam Control Panel
      if (examStep === "upload") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Mock Exam Generator</h3>
              <p className="text-sm text-slate-600 mb-4">Upload lecture notes or paste text</p>
            </div>
            <div
              {...getExamRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
                isExamDragActive
                  ? "border-[#1e3a8a] bg-blue-50"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input {...getExamInputProps()} />
              <div className="flex flex-col items-center justify-center text-center">
                <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-700 mb-1">Drop Lecture Notes (PDF/PPTX/Image)</p>
                <p className="text-xs text-slate-500">or click to browse</p>
                {uploadedExamFiles.length > 0 && (
                  <div className="mt-4 w-full space-y-2">
                    {uploadedExamFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs text-slate-700 truncate flex-1">{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedExamFiles((prev) => prev.filter((_, i) => i !== idx));
                            if (uploadedExamFiles.length === 1) setExamStep("upload");
                          }}
                          className="ml-2 text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Or paste text:</label>
              <textarea
                value={lectureNotes}
                onChange={(e) => setLectureNotes(e.target.value)}
                placeholder="Paste lecture notes here..."
                className="w-full h-32 p-4 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif" }}
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <p className="text-xs text-red-800 text-justify leading-relaxed" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif", textAlign: 'justify', textAlignLast: 'left' }}>{error}</p>
                <Button
                  onClick={handleClearAnalysis}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Clear & Try Again
                </Button>
              </div>
            )}
          </div>
        );
      }
      if (examStep === "generate") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Generate</h3>
              <p className="text-sm text-slate-600 mb-4">Click below to generate exam questions</p>
            </div>
            {uploadedExamFiles.length > 0 && (
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-2">Uploaded files:</p>
                {uploadedExamFiles.map((file, idx) => (
                  <div key={idx} className="text-xs text-slate-600">{file.name}</div>
                ))}
              </div>
            )}
            {lectureNotes && (
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-1">Text input provided</p>
                <p className="text-xs text-slate-600 line-clamp-2">{lectureNotes.substring(0, 100)}...</p>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <p className="text-xs text-red-800 text-justify leading-relaxed" style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif", textAlign: 'justify', textAlignLast: 'left' }}>{error}</p>
                <Button
                  onClick={handleClearAnalysis}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Clear & Try Again
                </Button>
              </div>
            )}
          </div>
        );
      }
      return null; // Results shown in center canvas
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white" style={{ height: '100vh' }}>
      {/* Center Canvas (flex-1) - Main Results Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-[850px] mx-auto px-12 py-8">
          {renderCenterCanvas()}
        </div>
      </div>

      {/* Control Panel (400px) - Right Side Input Controls */}
      <div className="w-[400px] flex-shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col">
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header with Mode Selection */}
            <div>
              <h1 className="text-xl font-semibold text-slate-900 mb-4">StudyBuddy</h1>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Mode</label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setActiveMode("case-analysis");
                      setCaseAnalysisStep("upload");
                      setExamStep("upload");
                    }}
                    variant={activeMode === "case-analysis" ? "default" : "outline"}
                    className="flex-1"
                    size="sm"
                  >
                    Case Analysis
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveMode("mock-exam");
                      setCaseAnalysisStep("upload");
                      setExamStep("upload");
                    }}
                    variant={activeMode === "mock-exam" ? "default" : "outline"}
                    className="flex-1"
                    size="sm"
                  >
                    Mock Exam
                  </Button>
                </div>
              </div>
            </div>

            {/* Model Context Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Model Context</label>
              <Select value={modelContext} onChange={(e) => setModelContext(e.target.value)}>
                {contextOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {modelContext ? `Forcing ${modelContext} perspective` : "AI will auto-detect topic"}
              </p>
            </div>

            {/* Brain Mode Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Brain Mode</label>
              <Select value={brainMode} onChange={(e) => setBrainMode(e.target.value as BrainMode)}>
                <option value="auto">Tier 1: Primary (2.5 Flash)</option>
                <option value="standard">Tier 2: Strategic (3 Flash Preview)</option>
                <option value="speed">Tier 3: Safety Net (2.5 Flash Lite)</option>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {brainMode === "auto" && "Tier 1: Everyday workhorse. 90% of tasks. Auto-fallback to Tier 3 on errors."}
                {brainMode === "standard" && "Tier 2: High-reasoning for complex MBA case analysis. May experience 503 overloads."}
                {brainMode === "speed" && "Tier 3: Emergency backup. Ultra-stable availability when Tier 1 or 2 are unavailable."}
              </p>
            </div>

            {/* Control Panel Content */}
            {renderControlPanel()}
          </div>
        </div>
        
        {/* Sticky Bottom Button Area - Only show Analyze button when in upload step */}
        {activeMode === "case-analysis" && caseAnalysisStep === "upload" && (
          <div className="border-t border-slate-200 bg-slate-50 p-6 sticky bottom-0">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!caseStudyText.trim() && uploadedFiles.length === 0)}
              size="lg"
              className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Case Study"}
            </Button>
          </div>
        )}
        {activeMode === "mock-exam" && examStep === "generate" && (
          <div className="border-t border-slate-200 bg-slate-50 p-6 sticky bottom-0">
            <Button
              onClick={handleGenerateExam}
              disabled={isGeneratingExam}
              size="lg"
              className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white"
            >
              {isGeneratingExam ? "Generating..." : "Generate Exam"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
