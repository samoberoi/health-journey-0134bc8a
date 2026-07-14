DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Public-readable reference tables that need anon SELECT too
GRANT SELECT ON public.app_languages, public.app_settings, public.color_gauge_bands, public.color_gauge_modules,
  public.exercise_badges, public.exercise_categories, public.exercises,
  public.fasting_badges, public.fasting_protocols, public.fasting_stage_milestones, public.fasting_weekly_plans,
  public.food_categories, public.food_condition_rules, public.food_filters, public.food_item_tag_links, public.food_item_tags, public.food_items,
  public.global_streak_config, public.lab_parameters, public.medical_conditions,
  public.movement_badges, public.movement_config, public.movement_levels,
  public.notification_categories, public.notification_templates, public.package_pricing, public.packages,
  public.supplement_badges, public.supplement_categories, public.supplement_condition_rules, public.supplement_conditions, public.supplement_master,
  public.thyrocare_tests, public.video_categories, public.video_metadata, public.video_thumbnails, public.videos,
  public.community_post_categories
  TO anon;