import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Video, Trash2, ExternalLink, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminTutorialWhatsAppPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tutorialId, setTutorialId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/admin/login");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.role !== "admin") {
        navigate("/admin/login");
        return;
      }

      // Fetch existing tutorial video
      const { data: tutorial } = await supabase
        .from("tutorial_videos")
        .select("*")
        .eq("key", "whatsapp_setup_video")
        .maybeSingle();

      if (tutorial) {
        setTutorialId(tutorial.id);
        setVideoUrl(tutorial.video_url || "");
      }

      setLoading(false);
    };

    checkAdminAndFetch();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("video/")) {
        toast.error("Por favor, selecione um arquivo de vídeo válido");
        return;
      }
      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error("O arquivo deve ter no máximo 100MB");
        return;
      }
      setVideoFile(file);
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }

    setUploading(true);
    try {
      const fileExt = videoFile.name.split(".").pop();
      const fileName = `whatsapp_tutorial_${Date.now()}.${fileExt}`;
      const filePath = `tutorials/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("message_attachments")
        .upload(filePath, videoFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("message_attachments")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setVideoUrl(publicUrl);

      // Update database
      const { error: updateError } = await supabase
        .from("tutorial_videos")
        .update({
          video_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "whatsapp_setup_video");

      if (updateError) throw updateError;

      toast.success("Vídeo enviado com sucesso!");
      setVideoFile(null);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao enviar vídeo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveUrl = async () => {
    if (!videoUrl.trim()) {
      toast.error("Digite uma URL válida");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tutorial_videos")
        .update({
          video_url: videoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "whatsapp_setup_video");

      if (error) throw error;

      toast.success("URL do vídeo salva com sucesso!");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Erro ao salvar URL");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!confirm("Tem certeza que deseja remover o vídeo?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tutorial_videos")
        .update({
          video_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "whatsapp_setup_video");

      if (error) throw error;

      setVideoUrl("");
      toast.success("Vídeo removido com sucesso!");
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error(error.message || "Erro ao remover vídeo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-7 w-7 text-primary" />
            Tutorial WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Configure o vídeo tutorial que será exibido para gestores ao configurar o WhatsApp
          </p>
        </div>

        {/* Current Video Preview */}
        {videoUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vídeo Atual</CardTitle>
              <CardDescription>
                Prévia do vídeo configurado para o tutorial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                >
                  Seu navegador não suporta a reprodução de vídeos.
                </video>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(videoUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveVideo}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover vídeo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload New Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enviar Novo Vídeo</CardTitle>
            <CardDescription>
              Faça upload de um arquivo de vídeo (máximo 100MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-file">Arquivo de Vídeo</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {videoFile && (
                <p className="text-sm text-muted-foreground">
                  Arquivo selecionado: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)}MB)
                </p>
              )}
            </div>
            <Button onClick={handleUpload} disabled={!videoFile || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Vídeo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Or Set URL Manually */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ou Definir URL Manualmente</CardTitle>
            <CardDescription>
              Cole a URL direta de um vídeo hospedado externamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">URL do Vídeo</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://exemplo.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button onClick={handleSaveUrl} disabled={!videoUrl.trim() || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar URL
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            O vídeo configurado aqui será exibido para todos os gestores na página de tutorial do WhatsApp.
            Certifique-se de que o vídeo explica claramente como configurar a integração.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  );
}
