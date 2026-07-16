
CREATE OR REPLACE FUNCTION public.pnl_compute(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(source text, ref_id uuid, occurred_at timestamp with time zone, user_id uuid, label text, gross numeric, gst numeric, net numeric, coach_cost numeric, partner_cost numeric, hyperrevamp_cost numeric, margin numeric, meta jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cfg public.pnl_rate_config%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO _cfg FROM public.pnl_rate_config ORDER BY created_at ASC LIMIT 1;
  IF _cfg.id IS NULL THEN
    INSERT INTO public.pnl_rate_config DEFAULT VALUES RETURNING * INTO _cfg;
  END IF;

  RETURN QUERY
  SELECT
    'subscription'::text, s.id, s.created_at, s.user_id,
    COALESCE(s.plan_name, s.plan_id, 'Subscription')::text,
    COALESCE(s.plan_price, 0)::numeric,
    ROUND(COALESCE(s.plan_price,0)::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct), 2),
    ROUND(COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct), 2),
    ROUND((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      * COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct) / 100.0, 2),
    0::numeric,
    ROUND((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct)) * _cfg.hyperrevamp_pct / 100.0, 2),
    ROUND(
      (COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      - ((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct)) * _cfg.hyperrevamp_pct / 100.0)
      - ((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
          * COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct) / 100.0), 2),
    jsonb_build_object('plan_id', s.plan_id, 'status', s.status,
      'coach_pct', COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct),
      'hyperrevamp_pct', _cfg.hyperrevamp_pct, 'gst_pct', _cfg.gst_pct)
  FROM public.subscriptions s
  LEFT JOIN LATERAL (
    SELECT ca.coach_id FROM public.coach_assignments ca
    WHERE ca.user_id = s.user_id
    ORDER BY ca.is_active DESC, ca.assigned_at DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN public.coaches c ON c.id = a.coach_id
  LEFT JOIN public.commission_models cm ON cm.id = c.commission_model_id
  WHERE s.created_at >= _from AND s.created_at < _to
    AND COALESCE(s.status, 'active') <> 'cancelled'

  UNION ALL

  SELECT
    'yoga'::text, y.id, y.created_at, y.user_id,
    COALESCE(cpp.name, 'Yoga Package')::text,
    COALESCE(y.price_inr, 0)::numeric,
    ROUND(COALESCE(y.price_inr,0)::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct), 2),
    ROUND(COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct), 2),
    0::numeric,
    ROUND((COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100.0, 2),
    0::numeric,
    ROUND(
      (COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      - ((COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
          * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100.0), 2),
    jsonb_build_object('partner_id', y.partner_id, 'package_id', y.package_id,
      'partner_pct', COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct),
      'gst_pct', _cfg.gst_pct, 'payment_status', y.payment_status)
  FROM public.yoga_bookings y
  LEFT JOIN public.channel_partner_packages cpp ON cpp.id = y.package_id
  WHERE y.created_at >= _from AND y.created_at < _to
    AND COALESCE(y.payment_status, 'paid') IN ('paid','completed','success')

  UNION ALL

  SELECT
    'event'::text,
    er.id,
    COALESCE(er.registered_at, er.created_at),
    er.user_id,
    COALESCE(e.title, 'Event')::text,
    COALESCE(er.amount_paid_inr, 0)::numeric,
    ROUND(COALESCE(er.amount_paid_inr,0)::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct), 2),
    ROUND(COALESCE(er.amount_paid_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct), 2),
    0::numeric,
    0::numeric,
    ROUND((COALESCE(er.amount_paid_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct)) * _cfg.hyperrevamp_pct / 100.0, 2),
    ROUND(
      (COALESCE(er.amount_paid_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      - ((COALESCE(er.amount_paid_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct)) * _cfg.hyperrevamp_pct / 100.0), 2),
    jsonb_build_object(
      'event_id', e.id,
      'event_title', e.title,
      'organizer_type', e.organizer_type,
      'organizer_name', e.organizer_name,
      'mode', e.mode,
      'hyperrevamp_pct', _cfg.hyperrevamp_pct,
      'gst_pct', _cfg.gst_pct,
      'payment_status', er.payment_status
    )
  FROM public.event_registrations er
  JOIN public.events e ON e.id = er.event_id
  WHERE COALESCE(er.registered_at, er.created_at) >= _from
    AND COALESCE(er.registered_at, er.created_at) < _to
    AND er.payment_status = 'paid'
    AND COALESCE(er.amount_paid_inr, 0) > 0

  ORDER BY 3 DESC;
END;
$function$;
