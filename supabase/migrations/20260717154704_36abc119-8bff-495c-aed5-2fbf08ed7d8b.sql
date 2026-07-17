
-- Chat messages -> notify recipient
CREATE OR REPLACE FUNCTION public.notify_chat_message_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _patient_id uuid; _coach_user_id uuid; _recipient uuid; _sender_name text;
BEGIN
  SELECT cc.patient_id, c.user_id INTO _patient_id, _coach_user_id
  FROM public.chat_conversations cc
  LEFT JOIN public.coaches c ON c.id = cc.coach_id
  WHERE cc.id = NEW.conversation_id;
  IF _patient_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_id = _patient_id THEN _recipient := _coach_user_id;
  ELSE _recipient := _patient_id; END IF;
  IF _recipient IS NULL OR _recipient = NEW.sender_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(trim(p.name), ''), 'Someone') INTO _sender_name
  FROM public.profiles p WHERE p.user_id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_recipient, COALESCE(_sender_name, 'New message') || ' sent you a message',
    left(COALESCE(NEW.message, ''), 140), 'chat_message', '💬',
    CASE WHEN NEW.sender_id = _patient_id THEN '/coach-dashboard?tab=messages' ELSE '/home?tab=messages' END);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_chat_message_recipient ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_message_recipient AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message_recipient();

-- Community comments
CREATE OR REPLACE FUNCTION public.notify_community_comment_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author_id uuid; _commenter_name text;
BEGIN
  SELECT user_id INTO _author_id FROM public.community_posts WHERE id = NEW.post_id;
  IF _author_id IS NULL OR _author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(trim(p.name), ''), 'Someone') INTO _commenter_name
  FROM public.profiles p WHERE p.user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_author_id, COALESCE(_commenter_name, 'Someone') || ' replied to your post',
    left(COALESCE(NEW.content, ''), 140), 'community_reply', '💬', '/home?tab=community');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_community_comment_author ON public.community_comments;
CREATE TRIGGER trg_notify_community_comment_author AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_community_comment_author();

-- Community likes
CREATE OR REPLACE FUNCTION public.notify_community_like_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author_id uuid; _liker_name text;
BEGIN
  SELECT user_id INTO _author_id FROM public.community_posts WHERE id = NEW.post_id;
  IF _author_id IS NULL OR _author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(trim(p.name), ''), 'Someone') INTO _liker_name
  FROM public.profiles p WHERE p.user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_author_id, COALESCE(_liker_name, 'Someone') || ' liked your post',
    'Tap to see the love on your feed.', 'community_like', '❤️', '/home?tab=community');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_community_like_author ON public.community_likes;
CREATE TRIGGER trg_notify_community_like_author AFTER INSERT ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_community_like_author();

-- Coach meetings
CREATE OR REPLACE FUNCTION public.notify_coach_meeting_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _coach_name text; _when text;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(trim(c.name), ''), 'Your coach') INTO _coach_name
  FROM public.coaches c WHERE c.id = NEW.coach_id;
  _when := to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI');
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (NEW.user_id, COALESCE(_coach_name, 'Your coach') || ' scheduled a meeting',
    'Scheduled for ' || _when || ' IST. Tap to view details.', 'coach_meeting', '📅', '/home?tab=consult');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_coach_meeting_user ON public.coach_meetings;
CREATE TRIGGER trg_notify_coach_meeting_user AFTER INSERT ON public.coach_meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_coach_meeting_user();

REVOKE ALL ON FUNCTION public.notify_chat_message_recipient() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_community_comment_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_community_like_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_coach_meeting_user() FROM PUBLIC, anon, authenticated;

-- Categories
INSERT INTO public.notification_categories (key, label, icon, color, sort_order)
VALUES
  ('exercise', 'Exercise',    '🏋️', '#EA580C', 8),
  ('health',   'Health',      '❤️', '#DC2626', 9),
  ('expiry',   'Subscription','⏰', '#B45309', 10),
  ('general',  'General',     '🔔', '#0F1A3D', 11)
ON CONFLICT (key) DO NOTHING;

-- Templates (message_variants is jsonb)
WITH cats AS (SELECT key, id FROM public.notification_categories)
INSERT INTO public.notification_templates
  (category_id, key, title, description, trigger_type, audience_filter, message_variants, icon, action_url, send_time_local, send_days, cooldown_hours, timezone, is_active)
VALUES
  ((SELECT id FROM cats WHERE key='general'), 'wake_up_morning', 'Good morning ☀️', 'Morning wake-up',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['Rise and shine — another shot at feeling better.','Good morning! Small steps today = big change tomorrow.','Fresh day, fresh start. Move, hydrate, breathe.']),
    '🌅', '/home', '06:30:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='movement'), 'move_morning', 'Morning walk', 'AM movement',
    'missed_action', '{"patient_users":true,"no_movement_started_today":true}'::jsonb,
    to_jsonb(ARRAY['A morning walk sets the tone. 10 minutes is enough.','Kick-start metabolism — step outside for a walk.']),
    '🚶', '/home?tab=movement', '07:30:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='movement'), 'move_afternoon', 'Afternoon steps', 'PM movement',
    'missed_action', '{"patient_users":true,"missed_movement_today":true}'::jsonb,
    to_jsonb(ARRAY['Halfway through the day — squeeze in a short walk.','Break the desk streak. A 5-minute walk resets glucose.']),
    '👟', '/home?tab=movement', '14:00:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='movement'), 'move_evening', 'Evening steps', 'Evening movement',
    'missed_action', '{"patient_users":true,"missed_movement_today":true}'::jsonb,
    to_jsonb(ARRAY['One evening stroll can undo a heavy day. Go.','Close your rings — evening walk time.']),
    '🌆', '/home?tab=movement', '18:30:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='movement'), 'move_goal_celebrate', 'Steps goal hit!', 'Celebrate',
    'share_prompt', '{"patient_users":true,"movement_goal_met_today":true}'::jsonb,
    to_jsonb(ARRAY['You crushed your steps goal today. Bravo!','Goal met — share it with your community.']),
    '🎉', '/home?tab=community', '19:30:00', ARRAY[1,2,3,4,5,6,7], 24, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='exercise'), 'exercise_morning', 'Morning workout', 'AM exercise',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['5 minutes of stretching + strength changes the day.','Wake the body up — a short workout is waiting.']),
    '🏋️', '/home?tab=exercise', '07:00:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='exercise'), 'exercise_afternoon', 'Midday moves', 'Mid exercise',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['Break the slump — 10 squats or a plank right now.','Reset your body: a couple of exercises now.']),
    '💪', '/home?tab=exercise', '15:00:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='exercise'), 'exercise_evening', 'Evening workout', 'PM exercise',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['Wind down strong. A short workout tonight helps sleep.','Evening workout = better sleep and glucose overnight.']),
    '🧗', '/home?tab=exercise', '19:00:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='food'), 'meal_breakfast', 'Log breakfast', 'Breakfast',
    'missed_action', '{"patient_users":true,"missed_meal_log_today":true}'::jsonb,
    to_jsonb(ARRAY['Snap your breakfast — what you eat first matters.','Log breakfast — protein first for stable glucose.']),
    '🍳', '/home?tab=diet', '09:00:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='food'), 'meal_lunch', 'Log lunch', 'Lunch',
    'missed_action', '{"patient_users":true,"missed_meal_log_today":true}'::jsonb,
    to_jsonb(ARRAY['Lunchtime — plate half veggies, quarter protein, quarter carbs.','Log lunch. Balanced plate = calm afternoon.']),
    '🥗', '/home?tab=diet', '13:00:00', ARRAY[1,2,3,4,5,6,7], 8, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='food'), 'meal_dinner', 'Log dinner', 'Dinner',
    'missed_action', '{"patient_users":true,"missed_meal_log_today":true}'::jsonb,
    to_jsonb(ARRAY['Close the day right — log dinner.','Light dinner tonight = deep sleep. Log it.']),
    '🍲', '/home?tab=diet', '20:00:00', ARRAY[1,2,3,4,5,6,7], 8, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='fasting'), 'fast_evening_start', 'Start your fast', 'Fasting',
    'reminder', '{"patient_users":true,"has_fasting_protocol":true,"missed_fasting_today":true}'::jsonb,
    to_jsonb(ARRAY['Your fasting window is starting — kitchen closed.','Time to fast. Water, herbal tea, sleep.']),
    '⏳', '/home?tab=fasting', '20:00:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='stress'), 'yoga_evening_calm', 'Evening yoga', 'Yoga',
    'missed_action', '{"patient_users":true,"missed_yoga_today":true}'::jsonb,
    to_jsonb(ARRAY['10 minutes of yoga now = calmer sleep tonight.','Breathe. Stretch. Reset.']),
    '🧘', '/home?tab=exercise', '21:00:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='supplements'), 'supp_night_reminder', 'Nightly supplements', 'Night supp',
    'missed_action', '{"patient_users":true,"has_supplements":true,"missed_supplement_today":true}'::jsonb,
    to_jsonb(ARRAY['Night supplements — do not skip.','Take your evening supplements before bed.']),
    '💊', '/home?tab=supplements', '22:00:00', ARRAY[1,2,3,4,5,6,7], 12, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='health'), 'log_weight_morning', 'Log your weight', 'Weight',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['Weigh in — same time daily is the honest number.','Quick weigh-in — 5 seconds, 30 days of data.']),
    '⚖️', '/home?tab=profile', '06:45:00', ARRAY[1,3,5], 24, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='health'), 'log_glucose_morning', 'Log fasting glucose', 'Glucose',
    'reminder', '{"patient_users":true,"all_active_users":true}'::jsonb,
    to_jsonb(ARRAY['Log your fasting glucose — trend beats one reading.','Morning glucose check-in.']),
    '🩸', '/home?tab=profile', '07:00:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='health'), 'log_bp_evening', 'Log blood pressure', 'BP',
    'reminder', '{"patient_users":true,"needs_bp_tracking":true}'::jsonb,
    to_jsonb(ARRAY['Evening BP check — 2 minutes, big picture.','Log your BP tonight.']),
    '❤️', '/home?tab=profile', '20:30:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

  ((SELECT id FROM cats WHERE key='expiry'), 'plan_expiring_15d', 'Your plan expires soon', '15d',
    'reminder', '{"patient_users":true,"expiring_in_15d":true}'::jsonb,
    to_jsonb(ARRAY['Your BBDO plan expires in ~2 weeks. Renew and stay on track.','Two weeks left on your plan — renew today.']),
    '⏰', '/plans', '10:00:00', ARRAY[1,2,3,4,5,6,7], 72, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='expiry'), 'plan_expiring_7d', 'Only a week left', '7d',
    'reminder', '{"patient_users":true,"expiring_in_7d":true}'::jsonb,
    to_jsonb(ARRAY['7 days left on your plan. Renew to keep coaching, diet, videos.','A week to expiry — renew and keep the streak alive.']),
    '⏰', '/plans', '10:00:00', ARRAY[1,2,3,4,5,6,7], 48, 'Asia/Kolkata', true),
  ((SELECT id FROM cats WHERE key='expiry'), 'plan_expiring_3d', 'Renew — 3 days left', '3d',
    'reminder', '{"patient_users":true,"expiring_in_3d":true}'::jsonb,
    to_jsonb(ARRAY['3 days left on your plan. Renew now.','Final stretch. Renew today to skip any interruption.']),
    '🚨', '/plans', '10:00:00', ARRAY[1,2,3,4,5,6,7], 24, 'Asia/Kolkata', true)
ON CONFLICT (key) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  message_variants = EXCLUDED.message_variants,
  send_time_local = EXCLUDED.send_time_local,
  audience_filter = EXCLUDED.audience_filter,
  updated_at = now();
