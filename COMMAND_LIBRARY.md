# Command Library

This file defines how to behave when working on this project. Follow these guidelines strictly.

## Core Principles

1. **Keep it lightweight** - No heavy frameworks or over-engineering
2. **Simple solutions first** - Prefer simple, straightforward code over complex patterns
3. **Minimal dependencies** - Only add packages when absolutely necessary
4. **Direct and clear** - Code should be easy to read and understand

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **No ORM** - Use direct database queries or lightweight query builders if needed
- **No heavy auth libraries** - Keep authentication simple

## Project Structure

```
studybuddy/
├── app/              # Next.js App Router
│   ├── api/          # API routes
│   └── ...
├── components/       # React components
├── lib/              # Utility functions
└── public/           # Static assets
```

## Coding Guidelines

1. **Use TypeScript** - Type everything properly
2. **Keep components small** - One component per file
3. **Use Tailwind for styling** - No CSS-in-JS libraries
4. **API routes in app/api/** - Keep them simple and focused
5. **Utilities in lib/** - Reusable functions only

## What NOT to Do

- ❌ Don't add Prisma or heavy ORMs
- ❌ Don't add complex state management (use React state/context)
- ❌ Don't add unnecessary abstractions
- ❌ Don't over-engineer solutions
- ❌ Don't add packages without asking first

## What TO Do

- ✅ Keep code simple and readable
- ✅ Use built-in Next.js features
- ✅ Write clear, self-documenting code
- ✅ Ask before adding new dependencies
- ✅ Follow Next.js App Router patterns

## Database

- Use direct SQL queries or a lightweight query builder (like `pg` for PostgreSQL)
- Keep database logic in API routes or server components
- No migrations framework - use simple SQL scripts if needed

## Authentication

- Keep it simple - use NextAuth.js only if necessary
- Prefer simple session management
- No complex auth providers unless required

## When in Doubt

Ask the user before:
- Adding new dependencies
- Creating complex abstractions
- Implementing patterns that add complexity
- Making architectural decisions
