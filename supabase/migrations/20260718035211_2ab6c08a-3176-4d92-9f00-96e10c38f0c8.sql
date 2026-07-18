
CREATE TABLE IF NOT EXISTS public.user_breath_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_breath_sessions_user_at_idx
  ON public.user_breath_sessions (user_id, session_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_breath_sessions TO authenticated;
GRANT ALL ON public.user_breath_sessions TO service_role;

ALTER TABLE public.user_breath_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own breath sessions" ON public.user_breath_sessions;
CREATE POLICY "Users read own breath sessions"
  ON public.user_breath_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own breath sessions" ON public.user_breath_sessions;
CREATE POLICY "Users insert own breath sessions"
  ON public.user_breath_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own breath sessions" ON public.user_breath_sessions;
CREATE POLICY "Users delete own breath sessions"
  ON public.user_breath_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
