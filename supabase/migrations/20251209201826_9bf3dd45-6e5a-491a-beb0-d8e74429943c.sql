-- Add CNPJ column to companies table
ALTER TABLE public.companies 
ADD COLUMN cnpj TEXT;