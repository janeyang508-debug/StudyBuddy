# StudyBuddy

A modern full-stack application built with Next.js, Prisma, and NextAuth.js.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (via Prisma)
- **Authentication:** NextAuth.js (Auth.js)
- **ORM:** Prisma

## Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (accessible via private network)
- npm, yarn, pnpm, or bun

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration (Private Network)
# Replace 192.168.1.100 with your actual private network database IP address
# Common private network ranges: 192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x
DATABASE_URL="postgresql://user:password@192.168.1.100:5432/studybuddy?schema=public"

# NextAuth Configuration
# Generate a secret with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

**Important:** This project is configured to use a **private network** database connection. Make sure:
- Your PostgreSQL database is accessible on your private network
- Replace the IP address (192.168.1.100) with your actual database server's private IP
- Update the username, password, and database name as needed
- Ensure your network allows connections to the database port (default: 5432)

### 3. Set Up Database

Generate Prisma Client:
```bash
npx prisma generate
```

Run database migrations:
```bash
npx prisma migrate dev
```

(Optional) Open Prisma Studio to view/edit your database:
```bash
npx prisma studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
studybuddy/
├── app/              # Next.js App Router pages and layouts
│   ├── api/          # API routes
│   └── ...
├── components/       # React components
├── lib/              # Utility functions and helpers
├── prisma/           # Prisma schema and migrations
│   └── schema.prisma
└── public/           # Static assets
```

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx prisma studio` - Open Prisma Studio
- `npx prisma migrate dev` - Run database migrations
- `npx prisma generate` - Generate Prisma Client

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
