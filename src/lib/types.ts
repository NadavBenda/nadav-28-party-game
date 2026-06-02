// ============================================================
// Shared TypeScript types mirroring the Supabase schema
// ============================================================

export type GameState =
  | 'lobby'
  | 'answer_submission'
  | 'voting'
  | 'results'
  | 'leaderboard'
  | 'game_over';

export interface Room {
  id: string;
  code: string;
  host_pin: string;
  state: GameState;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  is_active: boolean;
  joined_at: string;
}

export interface Prompt {
  id: string;
  room_id: string;
  text: string;
  order_index: number;
  used: boolean;
  created_at: string;
}

export interface Round {
  id: string;
  room_id: string;
  prompt_id: string | null;
  prompt_text: string;
  round_number: number;
  state: GameState;
  created_at: string;
}

export interface Answer {
  id: string;
  round_id: string;
  player_id: string;
  text: string;
  submitted_at: string;
}

export interface Vote {
  id: string;
  round_id: string;
  voter_id: string;
  answer_id: string;
  submitted_at: string;
}

// Enriched types used in UI
export interface AnswerWithVotes extends Answer {
  vote_count: number;
  player_nickname: string;
}

export interface PlayerWithRank extends Player {
  rank: number;
}
