CREATE TABLE public.diet_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  dot_color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.diet_types TO anon, authenticated;
GRANT ALL ON public.diet_types TO service_role;

ALTER TABLE public.diet_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active diet types"
  ON public.diet_types FOR SELECT
  USING (true);

CREATE POLICY "Admins manage diet types"
  ON public.diet_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_diet_types_updated_at
  BEFORE UPDATE ON public.diet_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.diet_types (slug, label, description, dot_color, display_order) VALUES
  ('veg',        'Vegetarian',      'Plant-based + dairy. No meat, fish or eggs.', 'bg-emerald-600', 10),
  ('vegan',      'Vegan',           '100% plant-based. No dairy, eggs or honey.',  'bg-emerald-500', 20),
  ('jain',       'Jain',            'Vegetarian, no root vegetables.',             'bg-amber-500',   30),
  ('eggitarian', 'Eggitarian',      'Vegetarian who also eats eggs.',              'bg-yellow-500',  40),
  ('non_veg',    'Non-vegetarian',  'Includes meat, fish and eggs.',               'bg-rose-600',    50);
