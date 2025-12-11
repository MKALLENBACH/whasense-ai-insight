import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle, MessageCircle, HelpCircle, AlertTriangle, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WhatsAppTutorialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isTrialPlan, setIsTrialPlan] = useState(false);

  useEffect(() => {
    // Redirect sellers to /conversas
    if (user?.role === "vendedor") {
      toast.error("Acesso permitido apenas para gestores.");
      navigate("/conversas", { replace: true });
      return;
    }

    const fetchData = async () => {
      if (!user?.id) return;

      try {
        // Fetch tutorial video
        const { data: tutorialData } = await supabase
          .from("tutorial_videos")
          .select("video_url")
          .eq("key", "whatsapp_setup_video")
          .maybeSingle();

        if (tutorialData?.video_url) {
          setVideoUrl(tutorialData.video_url);
        }

        // Check if company is on trial plan
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("plan_id, free_start_date, free_end_date")
            .eq("id", profile.company_id)
            .maybeSingle();

          // Check if in trial period
          if (company?.free_start_date && company?.free_end_date) {
            const today = new Date();
            const endDate = new Date(company.free_end_date);
            if (today <= endDate) {
              setIsTrialPlan(true);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching tutorial data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, user?.role, navigate]);

  const handleVideoEnded = () => {
    setVideoCompleted(true);
  };

  const handleComplete = () => {
    toast.success("Etapa concluída! Agora você pode configurar seu WhatsApp da empresa.");
    navigate("/gestor/whatsapp");
  };

  const handleSupport = () => {
    window.open("https://wa.me/5551995087130", "_blank");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <PlayCircle className="h-7 w-7 text-primary" />
            Guia de Configuração do WhatsApp da Empresa
          </h1>
          <p className="text-muted-foreground mt-2">
            Assista ao vídeo tutorial para aprender a configurar o WhatsApp Business da sua empresa
          </p>
        </div>

        {/* Video Player */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tutorial em Vídeo</CardTitle>
            <CardDescription>
              Assista o vídeo completo para liberar a próxima etapa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {videoUrl ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  onEnded={handleVideoEnded}
                >
                  Seu navegador não suporta a reprodução de vídeos.
                </video>
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum vídeo foi configurado ainda pelo time da Whasense.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Entre em contato com o suporte para mais informações.
                  </p>
                </div>
              </div>
            )}

            {videoCompleted && (
              <Alert className="mt-4 border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Vídeo concluído! Agora você pode prosseguir para a configuração.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Button
            onClick={handleComplete}
            disabled={!videoCompleted && !!videoUrl}
            className="w-full h-12 text-base"
            size="lg"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Concluir e liberar conexão
          </Button>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Não conseguiu? Agende uma implementação com nosso time de especialistas.
            </p>
            <Button variant="outline" onClick={handleSupport}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Suporte
            </Button>
            
            {/* Trial Plan Notice - highlighted sub-message */}
            {isTrialPlan && (
              <div className="mt-4 p-4 rounded-lg border-2 border-primary bg-primary/10">
                <p className="text-sm font-medium text-primary flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Se estiver em período de teste, não se preocupe: adicionaremos dias extras após a conclusão da configuração.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
