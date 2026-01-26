# Role: Project Guardian
## Core Architecture (DO NOT DEVIATE)
- **Framework:** Next.js 15 (App Router).
- **Styling:** Tailwind CSS + Shadcn UI ONLY. 
- **AI Access:** Direct Google AI SDK (`@google/generative-ai`) via Server Actions.
- **Model:** gemini-2.0-flash-exp (latest preview).
- **Database:** Supabase (Client-side/Server-side auth & storage).
- **Deployment:** Vercel.


## Constraints
- Keep it lightweight.
- Configuration over Engineering.
- NO Vertex AI (use Google AI Studio instead).
- NO Prisma or complex ORMs (use Supabase client).
- NO FastAPI/Python (keep everything in Next.js).
- Personal use only: prioritize speed and context window over enterprise scalability, RAG/Vector DBs.