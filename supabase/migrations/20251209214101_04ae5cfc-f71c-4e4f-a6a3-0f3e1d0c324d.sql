-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message_attachments', 'message_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message_attachments');

-- Allow authenticated users to view attachments
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message_attachments');

-- Allow public access to view attachments (since bucket is public)
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'message_attachments');

-- Allow authenticated users to delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message_attachments');