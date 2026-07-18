DELETE FROM public.device_push_tokens d
USING public.device_push_tokens newer
WHERE d.user_id = newer.user_id
  AND d.platform = newer.platform
  AND (
    newer.updated_at > d.updated_at
    OR (newer.updated_at = d.updated_at AND newer.id > d.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_one_per_user_platform
ON public.device_push_tokens (user_id, platform);

DROP TRIGGER IF EXISTS trg_dispatch_health_alert_native_push ON public.notifications;
DROP TRIGGER IF EXISTS trg_dispatch_app_notification_native_push ON public.notifications;

CREATE TRIGGER trg_dispatch_app_notification_native_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_app_notification_native_push();