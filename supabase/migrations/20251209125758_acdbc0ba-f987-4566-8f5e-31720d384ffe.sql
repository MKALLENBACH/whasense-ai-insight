-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('seller', 'manager');

-- Create enum for message direction
CREATE TYPE public.message_direction AS ENUM ('incoming', 'outgoing');

-- Create enum for sale status
CREATE TYPE public.sale_status AS ENUM ('won', 'lost');

-- Create enum for lead temperature
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create customers table (for tracking customer info)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  direction message_direction NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create insights table
CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  sentiment TEXT,
  intention TEXT,
  objection TEXT,
  temperature lead_temperature,
  suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  status sale_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for customers
CREATE POLICY "Sellers can view their customers" ON public.customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      WHERE messages.customer_id = customers.id 
      AND messages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can create customers" ON public.customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Managers can view all customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- RLS Policies for messages
CREATE POLICY "Sellers can view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert own messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Managers can view all messages" ON public.messages
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- RLS Policies for insights
CREATE POLICY "Sellers can view insights of own messages" ON public.insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      WHERE messages.id = insights.message_id 
      AND messages.seller_id = auth.uid()
    )
  );

CREATE POLICY "System can insert insights" ON public.insights
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Managers can view all insights" ON public.insights
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- RLS Policies for sales
CREATE POLICY "Sellers can view own sales" ON public.sales
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert own sales" ON public.sales
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own sales" ON public.sales
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Managers can view all sales" ON public.sales
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;