CREATE POLICY "Coaches can view assigned patients' Apple Health snapshots"
ON public.apple_health_snapshots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coach_assignments ca
    WHERE ca.user_id = apple_health_snapshots.user_id
      AND ca.coach_id = auth.uid()
      AND ca.is_active = true
  )
);