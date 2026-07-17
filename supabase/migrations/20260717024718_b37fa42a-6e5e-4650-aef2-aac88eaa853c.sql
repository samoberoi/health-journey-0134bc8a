CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_health_alert_native_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _project_ref text := 'ogmhspwsvzvwqoavlxjn';
  _url text := 'https://ogmhspwsvzvwqoavlxjn.functions.supabase.co/send-health-push';
  _anon_key text := 'sb_publishable_poMI4GzypzM-3Y4znIJDEA_ocG6BARb';
  _user_jwt text;
BEGIN
  IF NEW.type <> 'health_alert' THEN
    RETURN NEW;
  END IF;

  SELECT encode(
    convert_to(
      json_build_object('alg', 'HS256', 'typ', 'JWT')::text,
      'UTF8'
    ),
    'base64'
  ) INTO _user_jwt;

  PERFORM extensions.net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'title', NEW.title,
      'body', NEW.body,
      'actionUrl', COALESCE(NEW.action_url, '/home?tab=profile'),
      'userId', NEW.user_id::text,
      'backendDispatch', true
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_health_alert_native_push ON public.notifications;
CREATE TRIGGER trg_dispatch_health_alert_native_push
AFTER INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.type = 'health_alert')
EXECUTE FUNCTION public.dispatch_health_alert_native_push();

REVOKE ALL ON FUNCTION public.dispatch_health_alert_native_push() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_health_alert_native_push() TO service_role;