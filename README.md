# Party Game 🎂

A Quiplash-style birthday party game. Host shows questions on a TV/projector, players answer from their phones, everyone votes anonymously, and the funniest answer wins.

Built with **Next.js 16 + Supabase Realtime**. All screens update live — no page refreshes.

---

## Supabase Setup (do this first)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Once your project is ready, open the **SQL Editor**
3. Paste and run the entire contents of [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/NadavBenda/nadav-28-party-game.git
cd nadav-28-party-game
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Open .env.local and fill in the three Supabase values

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing from a Phone on the Same Wi-Fi

When `npm run dev` is running on your laptop:

1. Find your laptop's local IP:
   - **macOS**: `ipconfig getifaddr en0` (or `en1` for Wi-Fi)
   - **Windows**: `ipconfig` → look for IPv4 Address under Wi-Fi
   - **Linux**: `ip addr show` or `hostname -I`

2. On your phone (same Wi-Fi), open:
   ```
   http://192.168.x.x:3000
   ```
   Replace `192.168.x.x` with your laptop's IP.

3. Create a room on your laptop (host screen), then join from your phone.

> **iOS Safari note**: If the page doesn't load, check that your laptop's firewall isn't blocking port 3000.

---

## Vercel Deployment

1. Push this repo to GitHub (already done)
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy** — Vercel handles the rest

Players connect to your Vercel URL from anywhere with internet.

---

## How to Run the Game

### As Host (laptop connected to TV/projector)

1. Open the app → **Create Room (Host)**
2. Set a PIN (you'll need it to control the game)
3. Share the **5-character room code** with players
4. In the lobby: paste your prompts (one per line) → **Save Prompts**
5. Wait for players to join → **Start Game**
6. Control each phase:
   - After players answer → **End Submission & Start Voting**
   - After voting → **Reveal Results**
   - After results → **Show Leaderboard**
   - Repeat or **End Game**

Use the **⚙ Admin** button (top right) to:
- Remove a player
- Skip or restart a round
- Reset all scores

### As Player (phone)

1. Open the app URL on your phone
2. **Join a Room** → enter room code + nickname
3. Follow what the host says on the TV

---

## Game Flow (State Machine)

```
lobby
  ↓ host presses "Start Game" (picks first unused prompt)
answer_submission
  ↓ host presses "End Submission"
voting
  ↓ host presses "Reveal Results" (scores awarded here: 100 pts/vote)
results
  ↓ host presses "Show Leaderboard"
leaderboard
  ↓ host presses "Next Round" → back to answer_submission
  ↓ host presses "End Game"
game_over
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (postgres_changes) |
| Deployment | Vercel |

### Architecture notes

- All writes go through Next.js **API routes** using the `service_role` key (bypasses RLS)
- All reads use the **anon key** client-side; RLS allows public read (game data is not sensitive)
- Two Realtime channels per browser tab: one for room-level events, one for the current round's answers/votes
- 15–40 players well within Supabase free tier Realtime limits

---

## Project Structure

```
src/
  app/
    page.tsx                     # Home: Join / Create Room
    host/[code]/page.tsx         # Host screen (PIN-gated)
    play/[code]/page.tsx         # Player screen (mobile-optimized)
    api/
      rooms/
        create/route.ts          # POST — create room
        join/route.ts            # POST — join room as player
        [code]/host/
          prompts/route.ts       # POST — import prompts (host)
          action/route.ts        # POST — all state transitions + admin
      rounds/
        [id]/
          answer/route.ts        # POST — submit answer
          vote/route.ts          # POST — submit vote
  hooks/
    useGameRoom.ts               # Supabase Realtime hook (all live state)
  lib/
    types.ts                     # TypeScript types for all DB tables
    supabase/
      client.ts                  # Browser Supabase client (anon key)
      server.ts                  # Server Supabase client (service_role)
supabase/
  migrations/
    001_initial_schema.sql       # Full DB schema — run once in SQL editor
```

---

## Known Limitations

- No automatic session persistence across browsers (uses `sessionStorage` — refresh on same tab is fine, but opening a new tab requires re-joining)
- No timer — host manually ends each phase (by design)
- Prompts can only be imported before the game starts (by design — simple is reliable)
- Host PIN is stored in the `rooms` table readable by anyone with the Supabase anon key — fine for a party, not for production
