
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS external_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
