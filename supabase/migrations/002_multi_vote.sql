-- Allow multiple votes per player per round (up to MAX_VOTES_PER_PLAYER in code)
-- Drop the old one-vote-per-voter constraint and replace with one-vote-per-answer constraint.

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_round_id_voter_id_key;
ALTER TABLE votes ADD CONSTRAINT votes_round_id_voter_id_answer_id_key
  UNIQUE (round_id, voter_id, answer_id);
