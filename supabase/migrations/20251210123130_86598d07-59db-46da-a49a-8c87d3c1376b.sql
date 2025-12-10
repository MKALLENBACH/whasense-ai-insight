-- Add unique constraint for leaderboard upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leaderboard_unique_entry'
  ) THEN
    ALTER TABLE public.leaderboard 
    ADD CONSTRAINT leaderboard_unique_entry 
    UNIQUE (company_id, vendor_id, period, period_start);
  END IF;
END $$;