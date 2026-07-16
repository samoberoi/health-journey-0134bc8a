CREATE OR REPLACE FUNCTION public.create_health_log_alert_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev_weight numeric;
  _delta numeric;
  _title text;
  _body text;
  _level text;
  _glucose numeric;
BEGIN
  IF NEW.log_type = 'bp' AND NEW.bp_systolic IS NOT NULL AND NEW.bp_diastolic IS NOT NULL THEN
    IF NEW.bp_systolic >= 180 OR NEW.bp_diastolic >= 120 THEN
      _level := 'critical';
      _title := 'Critical BP alert';
      _body := format('Very high BP: %s/%s mmHg', NEW.bp_systolic, NEW.bp_diastolic);
    ELSIF NEW.bp_systolic >= 140 OR NEW.bp_diastolic >= 90 THEN
      _level := 'alert';
      _title := 'High BP alert';
      _body := format('High BP: %s/%s mmHg', NEW.bp_systolic, NEW.bp_diastolic);
    ELSIF NEW.bp_systolic <= 90 OR NEW.bp_diastolic <= 60 THEN
      _level := 'alert';
      _title := 'Low BP alert';
      _body := format('Low BP: %s/%s mmHg', NEW.bp_systolic, NEW.bp_diastolic);
    END IF;
  ELSIF NEW.log_type = 'weight' AND NEW.weight_kg IS NOT NULL THEN
    SELECT hl.weight_kg INTO _prev_weight
    FROM public.health_logs hl
    WHERE hl.user_id = NEW.user_id
      AND hl.log_type = 'weight'
      AND hl.id <> NEW.id
      AND hl.weight_kg IS NOT NULL
    ORDER BY hl.logged_at DESC, hl.created_at DESC
    LIMIT 1;

    IF _prev_weight IS NOT NULL THEN
      _delta := NEW.weight_kg - _prev_weight;
      IF abs(_delta) >= 10 THEN
        _level := 'critical';
        _title := 'Critical weight change';
        _body := format('Weight %s %s kg (%s → %s)', CASE WHEN _delta > 0 THEN 'up' ELSE 'down' END, round(abs(_delta), 1), _prev_weight, NEW.weight_kg);
      ELSIF abs(_delta) >= 2 THEN
        _level := 'alert';
        _title := 'Weight change alert';
        _body := format('Weight %s %s kg (%s → %s)', CASE WHEN _delta > 0 THEN 'up' ELSE 'down' END, round(abs(_delta), 1), _prev_weight, NEW.weight_kg);
      END IF;
    ELSIF NEW.weight_kg >= 150 OR NEW.weight_kg <= 35 THEN
      _level := 'alert';
      _title := 'Weight alert';
      _body := format('Weight logged: %s kg', NEW.weight_kg);
    END IF;
  ELSIF NEW.log_type = 'diabetes' THEN
    _glucose := COALESCE(NEW.glucose_morning, NEW.glucose_evening);
    IF _glucose IS NOT NULL THEN
      IF _glucose >= 250 THEN
        _level := 'critical';
        _title := 'Critical glucose alert';
        _body := format('Very high glucose: %s mg/dL', _glucose);
      ELSIF _glucose <= 54 THEN
        _level := 'critical';
        _title := 'Critical glucose alert';
        _body := format('Very low glucose: %s mg/dL', _glucose);
      ELSIF _glucose >= 180 THEN
        _level := 'alert';
        _title := 'High glucose alert';
        _body := format('High glucose: %s mg/dL', _glucose);
      ELSIF _glucose <= 70 THEN
        _level := 'alert';
        _title := 'Low glucose alert';
        _body := format('Low glucose: %s mg/dL', _glucose);
      ELSIF _glucose >= 140 THEN
        _level := 'alert';
        _title := 'Elevated glucose alert';
        _body := format('Elevated glucose: %s mg/dL', _glucose);
      END IF;
    END IF;
  END IF;

  IF _level IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (NEW.user_id, _title, _body, 'health_alert', CASE WHEN _level = 'critical' THEN '🚨' ELSE '⚠️' END, '/home?tab=profile');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_health_logs_alert_notification ON public.health_logs;
CREATE TRIGGER trg_health_logs_alert_notification
AFTER INSERT ON public.health_logs
FOR EACH ROW
EXECUTE FUNCTION public.create_health_log_alert_notification();

CREATE OR REPLACE FUNCTION public.create_profile_health_alert_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_weight numeric;
  _new_weight numeric;
  _delta numeric;
  _old_sys numeric;
  _old_dia numeric;
  _new_sys numeric;
  _new_dia numeric;
  _title text;
  _body text;
  _level text;
  _new_clinical jsonb;
  _old_clinical jsonb;
BEGIN
  _old_weight := OLD.weight;
  _new_weight := NEW.weight;

  IF _new_weight IS NOT NULL AND _new_weight IS DISTINCT FROM _old_weight THEN
    IF _old_weight IS NOT NULL THEN
      _delta := _new_weight - _old_weight;
      IF abs(_delta) >= 10 THEN
        _level := 'critical';
        _title := 'Critical weight change';
        _body := format('Weight %s %s kg (%s → %s)', CASE WHEN _delta > 0 THEN 'up' ELSE 'down' END, round(abs(_delta), 1), _old_weight, _new_weight);
      ELSIF abs(_delta) >= 2 THEN
        _level := 'alert';
        _title := 'Weight change alert';
        _body := format('Weight %s %s kg (%s → %s)', CASE WHEN _delta > 0 THEN 'up' ELSE 'down' END, round(abs(_delta), 1), _old_weight, _new_weight);
      END IF;
    ELSIF _new_weight >= 150 OR _new_weight <= 35 THEN
      _level := 'alert';
      _title := 'Weight alert';
      _body := format('Weight logged: %s kg', _new_weight);
    END IF;
  END IF;

  IF _level IS NULL THEN
    _new_clinical := COALESCE(NEW.clinical::jsonb, '{}'::jsonb);
    _old_clinical := COALESCE(OLD.clinical::jsonb, '{}'::jsonb);

    IF (_new_clinical ->> 'systolicBP') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      _new_sys := (_new_clinical ->> 'systolicBP')::numeric;
    END IF;
    IF (_new_clinical ->> 'diastolicBP') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      _new_dia := (_new_clinical ->> 'diastolicBP')::numeric;
    END IF;
    IF (_old_clinical ->> 'systolicBP') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      _old_sys := (_old_clinical ->> 'systolicBP')::numeric;
    END IF;
    IF (_old_clinical ->> 'diastolicBP') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      _old_dia := (_old_clinical ->> 'diastolicBP')::numeric;
    END IF;

    IF _new_sys IS NOT NULL AND _new_dia IS NOT NULL AND (_new_sys IS DISTINCT FROM _old_sys OR _new_dia IS DISTINCT FROM _old_dia) THEN
      IF _new_sys >= 180 OR _new_dia >= 120 THEN
        _level := 'critical';
        _title := 'Critical BP alert';
        _body := format('Very high BP: %s/%s mmHg', _new_sys, _new_dia);
      ELSIF _new_sys >= 140 OR _new_dia >= 90 THEN
        _level := 'alert';
        _title := 'High BP alert';
        _body := format('High BP: %s/%s mmHg', _new_sys, _new_dia);
      ELSIF _new_sys <= 90 OR _new_dia <= 60 THEN
        _level := 'alert';
        _title := 'Low BP alert';
        _body := format('Low BP: %s/%s mmHg', _new_sys, _new_dia);
      END IF;
    END IF;
  END IF;

  IF _level IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (NEW.user_id, _title, _body, 'health_alert', CASE WHEN _level = 'critical' THEN '🚨' ELSE '⚠️' END, '/home?tab=profile');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_health_alert_notification ON public.profiles;
CREATE TRIGGER trg_profiles_health_alert_notification
AFTER UPDATE OF weight, clinical ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_health_alert_notification();