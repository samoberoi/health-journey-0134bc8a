
CREATE TABLE public.food_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.food_conditions TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.food_conditions TO authenticated;
GRANT ALL ON public.food_conditions TO service_role;

ALTER TABLE public.food_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_conditions readable"
  ON public.food_conditions FOR SELECT
  USING (true);

CREATE POLICY "food_conditions admin manage"
  ON public.food_conditions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_food_conditions_updated_at
  BEFORE UPDATE ON public.food_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.food_conditions (key, label, emoji, sort_order) VALUES
  ('hypothyroid',     'Hypothyroidism',   '🦋', 10),
  ('hyperthyroid',    'Hyperthyroidism',  '🦋', 20),
  ('pcos',            'PCOS',             '🌸', 30),
  ('ckd',             'Kidney Disease',   '🫘', 40),
  ('uric_acid',       'High Uric Acid',   '🧪', 50),
  ('fatty_liver',     'Fatty Liver',      '🫀', 60),
  ('iron_deficiency', 'Iron Deficiency',  '🩸', 70)
ON CONFLICT (key) DO NOTHING;
