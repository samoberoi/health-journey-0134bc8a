
-- Orphan storage cleanup: remove storage objects no longer referenced by DB rows.
-- Runs as SECURITY DEFINER; only callable by admins.

CREATE OR REPLACE FUNCTION public.cleanup_orphan_storage()
RETURNS TABLE(bucket text, deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Only admins may run this
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can run storage cleanup';
  END IF;

  -- 1) community-images: referenced via community_posts.image_url (path is /object/.../community-images/<path>)
  RETURN QUERY
  WITH refs AS (
    SELECT DISTINCT regexp_replace(image_url, '.*/community-images/', '') AS name
    FROM public.community_posts
    WHERE image_url IS NOT NULL AND image_url LIKE '%/community-images/%'
  ),
  del AS (
    DELETE FROM storage.objects o
    WHERE o.bucket_id = 'community-images'
      AND o.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM refs r WHERE split_part(r.name, '?', 1) = o.name)
    RETURNING 1
  )
  SELECT 'community-images'::text, count(*)::bigint FROM del;

  -- 2) avatars (video/exercise thumbnails + profile avatars + food taxonomy)
  RETURN QUERY
  WITH refs AS (
    SELECT DISTINCT regexp_replace(url, '.*/avatars/', '') AS name FROM (
      SELECT thumbnail_url AS url FROM public.video_thumbnails WHERE thumbnail_url LIKE '%/avatars/%'
      UNION ALL
      SELECT thumbnail_url FROM public.video_metadata WHERE thumbnail_url LIKE '%/avatars/%'
      UNION ALL
      SELECT thumbnail_url FROM public.exercises WHERE thumbnail_url LIKE '%/avatars/%'
      UNION ALL
      SELECT avatar_url FROM public.profiles WHERE avatar_url LIKE '%/avatars/%'
      UNION ALL
      SELECT image_url FROM public.food_categories WHERE image_url LIKE '%/avatars/%'
      UNION ALL
      SELECT image_url FROM public.food_filters WHERE image_url LIKE '%/avatars/%'
    ) s
  ),
  del AS (
    DELETE FROM storage.objects o
    WHERE o.bucket_id = 'avatars'
      AND o.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM refs r WHERE split_part(r.name, '?', 1) = o.name)
    RETURNING 1
  )
  SELECT 'avatars'::text, count(*)::bigint FROM del;

  -- 3) meal-photos: referenced by meal_photos.photo_url
  RETURN QUERY
  WITH refs AS (
    SELECT DISTINCT regexp_replace(photo_url, '.*/meal-photos/', '') AS name
    FROM public.meal_photos WHERE photo_url LIKE '%/meal-photos/%'
  ),
  del AS (
    DELETE FROM storage.objects o
    WHERE o.bucket_id = 'meal-photos'
      AND o.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM refs r WHERE split_part(r.name, '?', 1) = o.name)
    RETURNING 1
  )
  SELECT 'meal-photos'::text, count(*)::bigint FROM del;

  -- 4) plate-snapshots
  RETURN QUERY
  WITH refs AS (
    SELECT DISTINCT regexp_replace(snapshot_url, '.*/plate-snapshots/', '') AS name
    FROM public.user_plates WHERE snapshot_url LIKE '%/plate-snapshots/%'
  ),
  del AS (
    DELETE FROM storage.objects o
    WHERE o.bucket_id = 'plate-snapshots'
      AND o.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM refs r WHERE split_part(r.name, '?', 1) = o.name)
    RETURNING 1
  )
  SELECT 'plate-snapshots'::text, count(*)::bigint FROM del;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_storage() TO authenticated, service_role;
