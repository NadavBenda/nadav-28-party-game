-- ============================================================
-- Party Game Schema - Run this once in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TYPES
-- ============================================================

create type game_state as enum (
  'lobby',
  'answer_submission',
  'voting',
  'results',
  'leaderboard',
  'game_over'
);

-- ============================================================
-- ROOMS
-- ============================================================

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,         -- 5-char join code
  host_pin    text not null,                -- PIN to access host screen
  state       game_state not null default 'lobby',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PLAYERS
-- ============================================================

create table players (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  nickname    text not null,
  score       integer not null default 0,
  is_active   boolean not null default true,  -- false = removed by host
  joined_at   timestamptz not null default now(),
  unique (room_id, nickname)
);

-- ============================================================
-- PROMPTS  (bulk-imported by host before game starts)
-- ============================================================

create table prompts (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  text         text not null,
  order_index  integer not null,             -- display order
  used         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (room_id, order_index)
);

-- ============================================================
-- ROUNDS  (one per prompt played)
-- ============================================================

create table rounds (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  prompt_id     uuid references prompts(id),
  prompt_text   text not null,               -- snapshot so edits don't break history
  round_number  integer not null,
  state         game_state not null default 'answer_submission',
  created_at    timestamptz not null default now()
);

-- Index for the common query: "current round for this room"
create index rounds_room_id_idx on rounds(room_id);

-- ============================================================
-- ANSWERS
-- ============================================================

create table answers (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  text         text not null,
  submitted_at timestamptz not null default now(),
  unique (round_id, player_id)              -- one answer per player per round
);

-- ============================================================
-- VOTES
-- ============================================================

create table votes (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds(id) on delete cascade,
  voter_id     uuid not null references players(id) on delete cascade,
  answer_id    uuid not null references answers(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (round_id, voter_id)               -- one vote per player per round
);

-- ============================================================
-- REALTIME  (enable Supabase Realtime for these tables)
-- ============================================================

alter table rooms    replica identity full;
alter table players  replica identity full;
alter table prompts  replica identity full;
alter table rounds   replica identity full;
alter table answers  replica identity full;
alter table votes    replica identity full;

-- Add tables to the supabase_realtime publication
-- (Supabase creates this publication by default; just add tables)
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table prompts;
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table votes;

-- ============================================================
-- ROW LEVEL SECURITY
-- We keep RLS simple: all reads are public (anyone with the
-- room code can see the room's data). Writes go through
-- Next.js server actions using the service role key, which
-- bypasses RLS entirely.
-- ============================================================

alter table rooms    enable row level security;
alter table players  enable row level security;
alter table prompts  enable row level security;
alter table rounds   enable row level security;
alter table answers  enable row level security;
alter table votes    enable row level security;

-- Allow anyone to read any row (game data is not sensitive)
create policy "public read rooms"    on rooms    for select using (true);
create policy "public read players"  on players  for select using (true);
create policy "public read prompts"  on prompts  for select using (true);
create policy "public read rounds"   on rounds   for select using (true);
create policy "public read answers"  on answers  for select using (true);
create policy "public read votes"    on votes    for select using (true);
