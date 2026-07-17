
CREATE POLICY "Users can read plate-snapshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'plate-snapshots');

CREATE POLICY "Users can insert their own plate-snapshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own plate-snapshots"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own plate-snapshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);
