
-- ============ EVENTS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_image_url text,
  mode text NOT NULL DEFAULT 'offline' CHECK (mode IN ('online','offline')),
  online_url text,
  venue_name text,
  venue_address text,
  venue_city text,
  venue_lat numeric,
  venue_lng numeric,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  organizer_type text NOT NULL DEFAULT 'bbdo' CHECK (organizer_type IN ('bbdo','coach','channel_partner','admin')),
  organizer_id uuid,
  organizer_name text NOT NULL,
  organizer_avatar_url text,
  is_paid boolean NOT NULL DEFAULT false,
  fee_inr integer NOT NULL DEFAULT 0 CHECK (fee_inr >= 0),
  currency text NOT NULL DEFAULT 'INR',
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  registered_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','cancelled','completed')),
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_status_starts_idx ON public.events(status, starts_at);
CREATE INDEX events_organizer_idx ON public.events(organizer_type, organizer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view published events"
  ON public.events FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Admins manage all events"
  ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Coaches can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(),'coach')
      OR public.has_role(auth.uid(),'channel_partner')
      OR public.has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY "Organizer can update own events"
  ON public.events FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Organizer can delete own events"
  ON public.events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============ REGISTRATIONS ============
CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','cancelled','attended','waitlisted')),
  payment_status text NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required','pending','paid','refunded')),
  amount_paid_inr integer NOT NULL DEFAULT 0,
  registered_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX event_registrations_user_idx ON public.event_registrations(user_id, status);
CREATE INDEX event_registrations_event_idx ON public.event_registrations(event_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own registrations"
  ON public.event_registrations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid())
  );

CREATE POLICY "Users register themselves"
  ON public.event_registrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own registrations"
  ON public.event_registrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete registrations"
  ON public.event_registrations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.events_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_touch_updated_at();

CREATE TRIGGER event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.events_touch_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_event_registered_count(_event_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.events
  SET registered_count = COALESCE((
    SELECT COUNT(*) FROM public.event_registrations
    WHERE event_id = _event_id AND status IN ('registered','attended')
  ),0)
  WHERE id = _event_id;
$$;

CREATE OR REPLACE FUNCTION public.event_registrations_sync_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_event_registered_count(OLD.event_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_event_registered_count(NEW.event_id);
  IF TG_OP = 'UPDATE' AND OLD.event_id <> NEW.event_id THEN
    PERFORM public.recompute_event_registered_count(OLD.event_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER event_registrations_count_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.event_registrations_sync_count();

-- ============ REGISTER RPC (capacity-safe) ============
CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _e public.events%ROWTYPE;
  _reg public.event_registrations;
  _new_status text;
  _pay_status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;

  SELECT * INTO _e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF _e.status <> 'published' THEN RAISE EXCEPTION 'Event is not open for registration'; END IF;

  -- capacity check (null = unlimited)
  IF _e.capacity IS NOT NULL AND _e.registered_count >= _e.capacity THEN
    _new_status := 'waitlisted';
  ELSE
    _new_status := 'registered';
  END IF;

  _pay_status := CASE WHEN _e.is_paid AND _e.fee_inr > 0 THEN 'pending' ELSE 'not_required' END;

  INSERT INTO public.event_registrations(event_id, user_id, status, payment_status)
  VALUES (_event_id, _uid, _new_status, _pay_status)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = CASE WHEN public.event_registrations.status = 'cancelled' THEN EXCLUDED.status
                      ELSE public.event_registrations.status END,
        cancelled_at = NULL
  RETURNING * INTO _reg;

  RETURN _reg;
END; $$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_event_registration(_event_id uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _reg public.event_registrations;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  UPDATE public.event_registrations
     SET status = 'cancelled', cancelled_at = now()
   WHERE event_id = _event_id AND user_id = _uid
   RETURNING * INTO _reg;
  RETURN _reg;
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_event_registration(uuid) TO authenticated;
