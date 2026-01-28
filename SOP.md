# 📘 StudyBuddy MBA: Standard Operating Procedure (SOP)
**Version:** 1.0 (January 2026)
**Owner:** MBA Student / Senior UI Expert
**Primary Objective:** High-speed, high-reasoning business analysis with a professional corporate aesthetic.

---

## 1. Design & Typography (The "Corporate Strategist")
To maintain a tidy and professional workspace, all UI changes must follow these rules:
- **Font:** Clean Sans-Serif stack (Primary: **Calibri**, Secondary: Inter/Arial).
- **Text Alignment:** Analysis results and exam questions MUST be **justified** (`text-justify`) with `leading-relaxed` line height.
- **Layout:** "Viewport Lock" (100vh). No page-level scrolling.
    - **Main Canvas (Center):** Primary reading and exam area.
    - **Control Panel (Right):** Fixed 400px width for inputs and actions.
    - **Sidebar:** Removed for maximum reading focus.

## 2. Intelligence Engine (The "Automatic Gearbox")
The application uses a 3-Tier fallback system to ensure 100% uptime:
1. **TIER 1 (Primary):** `gemini-2.5-flash` - Fast, everyday tasks.
2. **TIER 2 (Strategic):** `gemini-3-flash-preview` - Deep MBA case analysis.
3. **TIER 3 (Safety Net):** `gemini-2.5-flash-lite` - Emergency fallback for 503/429 errors.

### 2.1 Streaming Requirements
- **Mandatory:** All responses must use `generateContentStream` (no blocking calls)
- **Latency:** Stream must start within 2 seconds of request
- **Frontend:** Handles partial chunks gracefully (Markdown/JSON buffering)
- **Error Handling:** Robust try-catch blocks prevent UI crashes from incomplete chunks

## 3. Workflow Protocol
Follow these steps for academic rigor:
1. **Analyze:** Upload document (PDF, DOCX, CSV, or Image) -> Generate Initial Analysis.
2. **Audit:** Click "Audit Analysis" to run `@academic-peer-review.md` using the "Pro" model.
3. **Test:** Navigate to "Mock Exam" tab to generate situational questions via `@exam-generator.md`.
4. **Learn:** Use the footer "Learning Opportunities" via `@learning-opportunity.md` to bridge knowledge gaps.

### 3.1 File Handling
- **Supported Types:** PDF, DOCX, CSV, Images (PNG, JPEG, GIF, WebP)
- **Not supported:** PPTX
- **File API Path:** Documents (PDF, DOCX, CSV) use `GoogleAIFileManager` with `fileData: { fileUri, mimeType }` wrapper
- **Inline Data Path:** Images use Base64 `inlineData` for smaller payloads
- **Temp File Cleanup:** All temporary files uploaded via File API are automatically deleted after use

### 3.2 UI Controls
- **Brain Mode Selector:** Choose Tier 1 (Primary), Tier 2 (Strategic), or Tier 3 (Safety Net) in right panel
- **Model Context Selector:** Auto-detect, General, Finance, Marketing, or Strategy perspective

### 3.3 Exam Generation
- **Model Selection:** Mock Exam always uses Tier 1 (gemini-2.5-flash) for better JSON compliance
- **Response Schema:** Strict JSON schema enforced to prevent parsing errors
- **Format:** `{ questions: [{ question, options, correctIndex, rationale }] }`

## 4. Maintenance (For Cursor Agent / Claude)
When modifying the application, the Agent MUST follow this sequence:
1. **Check Commands:** Always reference the relevant `.md` file in the `/commands` folder.
2. **Exploration Phase:** Use `@exploration-phase.md` for major feature planning.
3. **Code Audit:** Use `@code-peer-review.md` (Cross-Model Verification) before final implementation to check Gemini's logic against Claude's standards.
4. **Architectural Guardrails:** No Prisma, no Docker, no external servers. Keep it lightweight.

## 5. Troubleshooting
- **MIME Error:** If a file fails, ensure it is a PDF, DOCX, CSV, or Image. DOCX/CSV require the 'File API' path. PPTX is not supported.
- **Stream Error:** If the stream fails to parse, check the `extractJson` buffer logic in `app/page.tsx`.
- **JSON Parse Error:** Verify Response Schema is configured correctly for Mock Exam. Check browser console for raw output.
- **Quota Error (429):** The system should auto-shift to Tier 3. Automatic retry with 5-second delay (max 2 retries) before fallback.
- **503 Overload:** Automatic retry with 5-second delay (max 2 retries), then fallback to Tier 3.
- **File Upload Failure:** Verify File API initialization (`GoogleAIFileManager`) and check temp file cleanup in `app/actions/gemini.ts`.
- **Model Not Found (404):** Verify model name matches registry. Check `@gemini-api-config.md` for correct model strings.
