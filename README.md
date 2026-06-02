# Party Game 🎂

A Quiplash-style birthday party game built with Next.js + Supabase.

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
3. Copy your project credentials from **Project Settings → API**.

### 2. Environment Variables

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 3. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to Play

### Host
1. Go to the home page → **Create Room (Host)**.
2. Enter a PIN (you'll need it to return to the host screen).
3. Share the room code with players.
4. Import prompts (paste a list, one per line).
5. Click **Start Game** when everyone has joined.

### Players
1. Go to the home page on their phone.
2. Click **Join a Room**, enter the room code and a nickname.
3. Follow on-screen prompts.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the three environment variables in Vercel → Project Settings → Environment Variables.
4. Deploy.

## Game States

```
lobby → answer_submission → voting → results → leaderboard
              ↑__________________________|
                                         → game_over
```

Only the host can advance between states.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Realtime)
- **Vercel** (deployment)
