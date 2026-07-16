REVOKE ALL ON FUNCTION public.create_health_log_alert_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_profile_health_alert_notification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_health_log_alert_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_profile_health_alert_notification() TO service_role;