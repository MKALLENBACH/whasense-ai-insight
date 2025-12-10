import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  temporaryPassword: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    
    const { email, name, temporaryPassword }: WelcomeEmailRequest = await req.json();

    if (!email || !name || !temporaryPassword) {
      throw new Error("Missing required fields: email, name, or temporaryPassword");
    }

    logStep("Sending welcome email", { email, name });

    const loginUrl = "https://whasense.lovable.app/login";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Whasense <onboarding@resend.dev>",
        to: [email],
        subject: "Bem-vindo ao Whasense! Suas credenciais de acesso",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bem-vindo ao Whasense</title>
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 32px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⚡ Whasense</h1>
                        <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Inteligência em vendas via WhatsApp</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 32px;">
                        <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">Olá, ${name}! 👋</h2>
                        
                        <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                          Sua conta Whasense está pronta! Abaixo estão suas credenciais de acesso:
                        </p>
                        
                        <!-- Credentials Box -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="color: #52525b; margin: 0 0 8px 0; font-size: 14px;">
                                <strong style="color: #18181b;">Email:</strong> ${email}
                              </p>
                              <p style="color: #52525b; margin: 0; font-size: 14px;">
                                <strong style="color: #18181b;">Senha temporária:</strong> 
                                <code style="background-color: #e4e4e7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code>
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Warning -->
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                          <p style="color: #92400e; margin: 0; font-size: 14px;">
                            ⚠️ <strong>Por segurança</strong>, você deverá alterar sua senha no primeiro acesso.
                          </p>
                        </div>
                        
                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td align="center">
                              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Acessar Whasense →
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Trial Info -->
                        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                          <p style="color: #8b5cf6; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">
                            🎁 Seu período de teste de 7 dias começou!
                          </p>
                          <p style="color: #71717a; margin: 0; font-size: 14px;">
                            Aproveite todas as funcionalidades premium durante este período.
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f4f4f5; padding: 24px 32px; text-align: center;">
                        <p style="color: #71717a; margin: 0; font-size: 12px;">
                          © 2024 Whasense. Todos os direitos reservados.
                        </p>
                        <p style="color: #a1a1aa; margin: 8px 0 0 0; font-size: 12px;">
                          Precisa de ajuda? Entre em contato pelo WhatsApp: (51) 99508-7130
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
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
