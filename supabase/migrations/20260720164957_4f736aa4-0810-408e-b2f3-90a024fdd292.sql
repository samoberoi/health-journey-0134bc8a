
ALTER TABLE public.supplement_master
  ADD COLUMN IF NOT EXISTS veg_type text NOT NULL DEFAULT 'both'
  CHECK (veg_type IN ('veg','non_veg','both'));

UPDATE public.supplement_master SET veg_type = 'non_veg' WHERE name ILIKE 'Omega 3 - NV';
UPDATE public.supplement_master SET veg_type = 'veg'     WHERE name ILIKE 'Omega 3 VEGETARIAN' OR name ILIKE 'Omega 3 - Veg/Vegan';
