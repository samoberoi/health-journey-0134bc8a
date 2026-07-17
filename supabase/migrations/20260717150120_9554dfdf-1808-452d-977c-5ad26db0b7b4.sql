ALTER TABLE public.food_categories ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.food_filters ADD COLUMN IF NOT EXISTS image_url text;