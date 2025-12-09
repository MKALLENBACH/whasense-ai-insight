-- Create enum for session status
CREATE TYPE public.whatsapp_session_status AS ENUM ('connected', 'disconnected', 'pending', 'expired');

-- Create whatsapp_sessions table
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  session_data JSONB,
  status whatsapp_session_status NOT NULL DEFAULT 'disconnected',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own session
CREATE POLICY "Sellers can view own session"
ON public.whatsapp_sessions
FOR SELECT
USING (auth.uid() = seller_id);

-- Sellers can insert their own session
CREATE POLICY "Sellers can insert own session"
ON public.whatsapp_sessions
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own session
CREATE POLICY "Sellers can update own session"
ON public.whatsapp_sessions
FOR UPDATE
USING (auth.uid() = seller_id);

-- Sellers can delete their own session
CREATE POLICY "Sellers can delete own session"
ON public.whatsapp_sessions
FOR DELETE
USING (auth.uid() = seller_id);

-- Managers can view all sessions from their company
CREATE POLICY "Managers can view company sessions"
ON public.whatsapp_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid()
    AND p2.user_id = whatsapp_sessions.seller_id
  )
);

-- Managers can update sessions from their company (for force reconnect)
CREATE POLICY "Managers can update company sessions"
ON public.whatsapp_sessions
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid()
    AND p2.user_id = whatsapp_sessions.seller_id
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add phone_number column to customers if not exists (for webhook matching)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- Update customers RLS to allow webhook inserts
CREATE POLICY "System can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (true);