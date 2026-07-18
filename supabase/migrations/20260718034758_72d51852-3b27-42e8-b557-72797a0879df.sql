
CREATE TABLE IF NOT EXISTS public.user_breath_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.user_breath_sessions TO authenticated;
GRANT ALL ON public.user_breath_sessions TO service_role;

ALTER TABLE public.user_breath_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own breath sessions"
  ON public.user_breath_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all breath sessions"
  ON public.user_breath_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_breath_sessions_user_time
  ON public.user_breath_sessions(user_id, session_at DESC);
