CREATE OR REPLACE FUNCTION public.dispatch_health_alert_native_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _url text := 'https://ogmhspwsvzvwqoavlxjn.functions.supabase.co/send-health-push';
  _anon_key text := 'sb_publishable_poMI4GzypzM-3Y4znIJDEA_ocG6BARb';
BEGIN
  IF NEW.type <> 'health_alert' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id::text,
      'backendDispatch', true
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_health_alert_native_push() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_health_alert_native_push() TO service_role;