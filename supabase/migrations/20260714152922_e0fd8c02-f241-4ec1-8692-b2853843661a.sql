ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS coach_packages text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill existing rows with their current coach_type
UPDATE public.coaches
SET coach_packages = ARRAY[coach_type::text]
WHERE (coach_packages IS NULL OR array_length(coach_packages,1) IS NULL)
  AND coach_type IS NOT NULL;