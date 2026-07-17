GRANT SELECT ON public.diet_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_types TO authenticated;
GRANT ALL ON public.diet_types TO service_role;