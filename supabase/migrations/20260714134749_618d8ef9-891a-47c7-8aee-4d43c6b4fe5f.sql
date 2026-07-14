
ALTER TABLE public.supplement_categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.supplement_categories SET sort_order = 1 WHERE key = 'booster';
UPDATE public.supplement_categories SET sort_order = 2 WHERE key = 'metabolic';
UPDATE public.supplement_categories SET sort_order = 3 WHERE key = 'vitamin_mineral';

-- Prevent deleting a category still referenced by supplement_master.category
CREATE OR REPLACE FUNCTION public.prevent_delete_used_supplement_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supplement_master WHERE category = OLD.key) THEN
    RAISE EXCEPTION 'Cannot delete category "%": it is used by one or more supplements', OLD.label
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_used_supplement_category ON public.supplement_categories;
CREATE TRIGGER trg_prevent_delete_used_supplement_category
BEFORE DELETE ON public.supplement_categories
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_used_supplement_category();
