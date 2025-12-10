import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-SELLER-WELCOME] ${step}${detailsStr}`);
};

interface SellerWelcomeRequest {
  email: string;
  name: string;
  temporaryPassword: string;
  companyName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { email, name, temporaryPassword, companyName }: SellerWelcomeRequest = await req.json();

    if (!email || !name || !temporaryPassword) {
      throw new Error("Missing required fields: email, name, or temporaryPassword");
    }

    logStep("Sending seller welcome email", { email, name, companyName });

    const loginUrl = "https://whasense-ai-insight.lovable.app/login";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Whasense <onboarding@resend.dev>",
        to: [email],
        subject: `Bem-vindo à equipe ${companyName || 'Whasense'} - Suas credenciais de acesso`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Logo -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #6366f1; margin: 0; font-size: 28px;">⚡ Whasense</h1>
                  <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Inteligência em Vendas via WhatsApp</p>
                </div>

                <!-- Welcome -->
                <h2 style="color: #1e293b; margin-bottom: 20px; font-size: 22px;">
                  Olá, ${name}! 👋
                </h2>

                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Você foi adicionado como <strong>vendedor</strong> na equipe <strong>${companyName || 'sua empresa'}</strong> no Whasense!
                </p>

                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                  Utilize as credenciais abaixo para acessar a plataforma:
                </p>

                <!-- Credentials Box -->
                <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                  <div style="margin-bottom: 15px;">
                    <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                    <p style="color: #1e293b; font-size: 16px; margin: 0; font-weight: 600;">${email}</p>
                  </div>
                  <div>
                    <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Senha Temporária</p>
                    <p style="color: #1e293b; font-size: 18px; margin: 0; font-family: monospace; background-color: #fef3c7; padding: 8px 12px; border-radius: 4px; display: inline-block;">${temporaryPassword}</p>
                  </div>
                </div>

                <!-- Important Notice -->
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                  <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                    ⚠️ Importante: Você será solicitado a alterar sua senha no primeiro acesso.
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <a href="${loginUrl}" style="display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Acessar Whasense →
                  </a>
                </div>

                <!-- What's next -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                  <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 15px;">O que você pode fazer no Whasense:</h3>
                  <ul style="color: #475569; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                    <li>Receber análises inteligentes de conversas</li>
                    <li>Obter sugestões de respostas em tempo real</li>
                    <li>Acompanhar temperatura e intenção dos leads</li>
                    <li>Gerenciar seu funil de vendas</li>
                  </ul>
                </div>

              </div>

              <!-- Footer -->
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  Este é um email automático. Por favor, não responda.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
                  Precisa de ajuda? WhatsApp: (51) 99508-7130
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
                  © 2025 Whasense. Todos os direitos reservados.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      logStep("Resend API error", { status: res.status, body: errorBody });
      throw new Error(`Resend API error: ${res.status} - ${errorBody}`);
    }

    const emailResponse = await res.json();
    logStep("Email sent successfully", { emailResponse });

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error sending email", { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);