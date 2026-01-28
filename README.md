# StudyBuddy

An MBA study tool for case analysis and mock exams, powered by Google Gemini with optional cross-model verification via OpenAI.

## Features

- **Case Analysis:** Upload PDF, DOCX, CSV, or images; get fast strategic analysis (BLUF, critical challenge, key insight, action).
- **Audit Analysis:** Deep peer review of your analysis using frameworks (Porter's Five Forces, SWOT, McKinsey 7S, etc.) and a confidence score.
- **Mock Exam:** Generate situational MCQ questions from lecture notes or uploaded materials; take the exam and see results with Professor's Notes.
- **Learning Opportunities:** After an exam, get 3 personalized learning opportunities (concept deep-dives, related case studies, critical-thinking “What If” questions).
- **Verify Quality:** Use OpenAI to verify Gemini-generated learning opportunities (score, issues, suggestions). Optional; requires `OPENAI_API_KEY`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **AI:** Google Generative AI (Gemini 2.5 Flash / Pro)
- **Optional verification:** OpenAI API (for “Verify Quality”)

## Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
# Required for Case Analysis, Mock Exam, and Learning Opportunities
GEMINI_API_KEY=your_google_ai_api_key

# Optional: for "Verify Quality" on Learning Opportunities (cross-model verification)
OPENAI_API_KEY=your_openai_api_key
```

- **GEMINI_API_KEY:** Get it from [Google AI Studio](https://aistudio.google.com/apikey). Required for analysis, exams, and learning opportunities.
- **OPENAI_API_KEY:** From [OpenAI](https://platform.openai.com/api-keys). Only needed if you use the “Verify Quality” button on learning opportunities.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project structure

```
StudyBuddy/
├── app/
│   ├── actions/          # Server actions (Gemini, exam, verifier)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── commands/             # Specs for prompts and behavior (@-reference in Cursor)
│   ├── academic-peer-review.md
│   ├── case-analyzer.md
│   ├── cross-model-verification.md
│   ├── exam-generator.md
│   ├── learning-opportunity.md
│   └── ...
├── components/ui/        # Reusable UI components
├── lib/                  # Utilities (e.g. file-utils)
├── scripts/              # e.g. check-models.ts
└── public/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx tsx scripts/check-models.ts` | List Gemini models (uses `GEMINI_API_KEY` from `.env.local`) |

## File support

- **Documents:** PDF, DOCX (via mammoth for .docx text extraction), CSV
- **Images:** PNG, JPEG, GIF, WebP
- **Not supported:** PPTX
- Max file size: 20MB (see server action body limit in `next.config.ts`).

## Documentation

- **SOP.md** — Design, typography, workflow, and troubleshooting.
- **commands/** — Prompt and behavior specs; reference these when changing AI flows (e.g. `@learning-opportunity.md`, `@cross-model-verification.md`).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Google AI for JavaScript](https://ai.google.dev/docs)
