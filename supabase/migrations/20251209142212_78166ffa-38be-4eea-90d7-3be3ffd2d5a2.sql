-- Remove a política que permite vendedores atualizarem suas próprias vendas
DROP POLICY IF EXISTS "Sellers can update own sales" ON public.sales;

-- Criar política que permite APENAS gestores atualizarem vendas da empresa
CREATE POLICY "Only managers can update sales"
ON public.sales
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager') 
  AND company_id = get_user_company(auth.uid())
);