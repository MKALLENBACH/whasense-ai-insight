import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Wrapper for Supabase edge function calls with automatic token refresh on 401
 */
export async function invokeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  // First attempt
  const { data, error } = await supabase.functions.invoke<T>(functionName, options);

  // If we get a 401-like error, try to refresh the session and retry
  if (error && (error.message?.includes('401') || error.message?.includes('Invalid or expired token'))) {
    console.log('[supabaseApi] 401 detected, attempting session refresh...');
    
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !sessionData.session) {
      console.log('[supabaseApi] Session refresh failed, redirecting to login...');
      // Clear session and redirect to login
      await supabase.auth.signOut();
      window.location.href = '/login';
      return { data: null, error: new Error('Sessão expirada. Faça login novamente.') };
    }

    console.log('[supabaseApi] Session refreshed, retrying request...');
    // Retry the request with the new session
    const retryResult = await supabase.functions.invoke<T>(functionName, options);
    return retryResult;
  }

  return { data, error };
}

/**
 * Wrapper for fetch calls to edge functions with automatic token refresh on 401
 */
export async function fetchWithAuth<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  try {
    let response = await fetch(url, { ...options, headers });

    // If 401, try to refresh and retry
    if (response.status === 401) {
      console.log('[fetchWithAuth] 401 detected, attempting session refresh...');
      
      const { data: newSession, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession.session) {
        console.log('[fetchWithAuth] Session refresh failed, redirecting to login...');
        await supabase.auth.signOut();
        window.location.href = '/login';
        return { data: null, error: new Error('Sessão expirada. Faça login novamente.') };
      }

      console.log('[fetchWithAuth] Session refreshed, retrying request...');
      // Retry with new token
      const newHeaders: HeadersInit = {
        ...headers,
        'Authorization': `Bearer ${newSession.session.access_token}`,
      };
      response = await fetch(url, { ...options, headers: newHeaders });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        data: null, 
        error: new Error(errorData.error || `HTTP ${response.status}`) 
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error('Network error') 
    };
  }
}
