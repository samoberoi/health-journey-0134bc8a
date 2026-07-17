
WITH new_urls(video_id, url) AS (VALUES
  ('anulom-vilom',     'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/anulom-vilom/rehost-1752750000000.jpg'),
  ('chandra-bhedi',    'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/chandra-bhedi/rehost-1752750000000.jpg'),
  ('bhujangasana',     'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/bhujangasana/rehost-1752750000000.jpg'),
  ('dhanurasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/dhanurasana/rehost-1752750000000.jpg'),
  ('jalandhar-bandha', 'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/jalandhar-bandha/rehost-1752750000000.jpg'),
  ('kapalbhati',       'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/kapalbhati/rehost-1752750000000.jpg'),
  ('leg-oblique',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/leg-oblique/rehost-1752750000000.jpg'),
  ('makarasana',       'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/makarasana/rehost-1752750000000.jpg'),
  ('mandukasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/mandukasana/rehost-1752750000000.jpg'),
  ('nadi-shodhan-1',   'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/nadi-shodhan-1/rehost-1752750000000.jpg'),
  ('nadi-shodhan-2',   'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/nadi-shodhan-2/rehost-1752750000000.jpg'),
  ('surya-bhedi',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/surya-bhedi/rehost-1752750000000.jpg'),
  ('trikonasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/trikonasana/rehost-1752750000000.jpg'),
  ('vakrasana',        'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/vakrasana/rehost-1752750000000.jpg')
)
UPDATE public.video_thumbnails vt
SET thumbnail_url = n.url, updated_at = now()
FROM new_urls n
WHERE vt.video_id = n.video_id;

WITH new_urls(video_id, url) AS (VALUES
  ('anulom-vilom',     'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/anulom-vilom/rehost-1752750000000.jpg'),
  ('chandra-bhedi',    'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/chandra-bhedi/rehost-1752750000000.jpg'),
  ('bhujangasana',     'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/bhujangasana/rehost-1752750000000.jpg'),
  ('dhanurasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/dhanurasana/rehost-1752750000000.jpg'),
  ('jalandhar-bandha', 'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/jalandhar-bandha/rehost-1752750000000.jpg'),
  ('kapalbhati',       'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/kapalbhati/rehost-1752750000000.jpg'),
  ('leg-oblique',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/leg-oblique/rehost-1752750000000.jpg'),
  ('makarasana',       'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/makarasana/rehost-1752750000000.jpg'),
  ('mandukasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/mandukasana/rehost-1752750000000.jpg'),
  ('nadi-shodhan-1',   'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/nadi-shodhan-1/rehost-1752750000000.jpg'),
  ('nadi-shodhan-2',   'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/nadi-shodhan-2/rehost-1752750000000.jpg'),
  ('surya-bhedi',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/surya-bhedi/rehost-1752750000000.jpg'),
  ('trikonasana',      'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/trikonasana/rehost-1752750000000.jpg'),
  ('vakrasana',        'https://ogmhspwsvzvwqoavlxjn.supabase.co/storage/v1/object/public/avatars/video-thumbnails/vakrasana/rehost-1752750000000.jpg')
)
UPDATE public.video_metadata vm
SET thumbnail_url = n.url, updated_at = now()
FROM new_urls n
WHERE vm.video_id = n.video_id;
