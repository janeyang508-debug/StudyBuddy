# Role: Project Anchor
## Core Architecture (DO NOT DEVIATE)
- **Frontend:** Next.js 15 (App Router).
- **Styling:** Tailwind CSS + Shadcn UI ONLY.
- **Backend:** Next.js Server Actions (No Express, No FastAPI).
- **Database:** Supabase (No Prisma, No local Postgres).
- **AI:** Direct Google AI Studio SDK (@google/generative-ai).
- **Model:** gemini-2.0-flash-exp (or latest preview).

## Development Philosophy
- Keep it lightweight.
- Prioritize context-window size over RAG/Vector DBs.
- Configuration over Engineering.

## Constraints
- NO Vertex AI (use Google AI Studio instead).
- NO Prisma or complex ORMs (use Supabase client).
- NO FastAPI/Python (keep everything in Next.js).
- Personal use only: prioritize speed and context window over enterprise scalability.