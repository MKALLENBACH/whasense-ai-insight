-- Add attachment columns to messages table
ALTER TABLE public.messages 
ADD COLUMN attachment_url TEXT,
ADD COLUMN attachment_type TEXT,
ADD COLUMN attachment_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.attachment_url IS 'URL do anexo no storage';
COMMENT ON COLUMN public.messages.attachment_type IS 'Tipo do anexo: image, video, audio, pdf, other';
COMMENT ON COLUMN public.messages.attachment_name IS 'Nome original do arquivo anexado';