-- Create table for system tutorial videos
CREATE TABLE public.tutorial_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  video_url TEXT,
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

-- Admins can manage tutorial videos
CREATE POLICY "Admins can manage tutorial_videos"
ON public.tutorial_videos
FOR ALL
USING (is_admin(auth.uid()));

-- Anyone authenticated can view tutorial videos
CREATE POLICY "Authenticated users can view tutorial_videos"
ON public.tutorial_videos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default record for WhatsApp tutorial
INSERT INTO public.tutorial_videos (key, title, description)
VALUES ('whatsapp_setup_video', 'Tutorial de Configuração do WhatsApp', 'Vídeo explicativo sobre como conectar o WhatsApp da empresa');