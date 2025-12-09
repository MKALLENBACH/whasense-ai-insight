-- Create ai_scripts table for company-specific AI configurations
CREATE TABLE public.ai_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  script_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  ai_persona TEXT,
  sales_playbook TEXT,
  forbidden_phrases TEXT,
  recommended_phrases TEXT,
  tone_of_voice TEXT,
  product_context TEXT,
  objection_handling TEXT,
  closing_techniques TEXT,
  opening_messages TEXT,
  example_responses TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create default_ai_script table for fallback script
CREATE TABLE public.default_ai_script (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_name TEXT NOT NULL DEFAULT 'Script Padrão Whasense',
  ai_persona TEXT,
  sales_playbook TEXT,
  forbidden_phrases TEXT,
  recommended_phrases TEXT,
  tone_of_voice TEXT,
  product_context TEXT,
  objection_handling TEXT,
  closing_techniques TEXT,
  opening_messages TEXT,
  example_responses TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_ai_script ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_scripts (admin only)
CREATE POLICY "Admins can view all ai_scripts"
  ON public.ai_scripts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert ai_scripts"
  ON public.ai_scripts FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update ai_scripts"
  ON public.ai_scripts FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete ai_scripts"
  ON public.ai_scripts FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for default_ai_script (admin only)
CREATE POLICY "Admins can view default_ai_script"
  ON public.default_ai_script FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert default_ai_script"
  ON public.default_ai_script FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update default_ai_script"
  ON public.default_ai_script FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete default_ai_script"
  ON public.default_ai_script FOR DELETE
  USING (is_admin(auth.uid()));

-- System policies for edge functions to read scripts
CREATE POLICY "System can read ai_scripts"
  ON public.ai_scripts FOR SELECT
  USING (true);

CREATE POLICY "System can read default_ai_script"
  ON public.default_ai_script FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_ai_scripts_updated_at
  BEFORE UPDATE ON public.ai_scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_ai_script_updated_at
  BEFORE UPDATE ON public.default_ai_script
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default script
INSERT INTO public.default_ai_script (
  script_name,
  ai_persona,
  sales_playbook,
  forbidden_phrases,
  recommended_phrases,
  tone_of_voice,
  product_context,
  objection_handling,
  closing_techniques,
  opening_messages,
  example_responses
) VALUES (
  'Script Padrão Whasense',
  'Você é um assistente de vendas profissional, consultivo e atencioso. Seu objetivo é entender as necessidades do cliente e oferecer soluções adequadas.',
  '1. Saudação cordial e apresentação
2. Identificar necessidade do cliente
3. Fazer perguntas consultivas
4. Apresentar soluções relevantes
5. Lidar com objeções
6. Fechar a venda
7. Confirmar próximos passos',
  'Nunca use: "infelizmente", "não posso", "impossível", linguagem negativa, gírias excessivas, promessas que não pode cumprir.',
  'Use frequentemente: "excelente escolha", "perfeito para você", "vou te ajudar", "entendo perfeitamente", "ótima pergunta".',
  'Profissional, amigável, consultivo. Transmita confiança sem ser arrogante. Seja empático e atencioso.',
  'Produto/serviço genérico. Adapte conforme contexto da conversa.',
  'Técnica Feel-Felt-Found: Entendo como você se sente, outros clientes sentiram o mesmo, e descobriram que...',
  'Pergunte sobre próximos passos, ofereça opções claras, crie senso de urgência moderado sem pressão excessiva.',
  'Olá! Tudo bem? Como posso te ajudar hoje?',
  'Cliente: Está caro.
Resposta: Entendo sua preocupação com o investimento. Muitos clientes tinham a mesma dúvida e perceberam que o valor se paga rapidamente pelos benefícios. Posso explicar melhor como isso funciona?'
);