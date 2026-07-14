CREATE TABLE IF NOT EXISTS public.supplement_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplement_categories TO anon, authenticated;
GRANT ALL ON public.supplement_categories TO service_role;
ALTER TABLE public.supplement_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can view supplement_categories" ON public.supplement_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage supplement_categories" ON public.supplement_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.supplement_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplement_conditions TO anon, authenticated;
GRANT ALL ON public.supplement_conditions TO service_role;
ALTER TABLE public.supplement_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can view supplement_conditions" ON public.supplement_conditions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage supplement_conditions" ON public.supplement_conditions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Simple RPC stubs for admin category/condition rename/delete used by AdminSupplements.tsx
CREATE OR REPLACE FUNCTION public.rename_supplement_category(old_key text, new_key text, new_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_categories SET key = new_key, label = new_label WHERE key = old_key; END; $$;

CREATE OR REPLACE FUNCTION public.delete_supplement_category(cat_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_categories SET is_active = false WHERE key = cat_key; END; $$;

CREATE OR REPLACE FUNCTION public.rename_supplement_condition(old_key text, new_key text, new_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_conditions SET key = new_key, label = new_label WHERE key = old_key; END; $$;

CREATE OR REPLACE FUNCTION public.delete_supplement_condition(cond_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_conditions SET is_active = false WHERE key = cond_key; END; $$;

REVOKE ALL ON FUNCTION public.rename_supplement_category(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_supplement_category(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rename_supplement_condition(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_supplement_condition(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_supplement_category(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_supplement_condition(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_condition(text) TO authenticated;