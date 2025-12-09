import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Image as ImageIcon, 
  FileText, 
  Film, 
  Music, 
  ExternalLink, 
  X,
  Play,
  Pause,
  Download,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface MessageBubbleProps {
  content: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  showAudioLabel?: boolean;
}

const MessageBubble = ({
  content,
  direction,
  timestamp,
  attachmentUrl,
  attachmentType,
  attachmentName,
  showAudioLabel = true,
}: MessageBubbleProps) => {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const isOutgoing = direction === "outgoing";
  const hasAttachment = !!attachmentUrl;

  const handleAudioToggle = (audioEl: HTMLAudioElement) => {
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play();
    }
    setIsPlaying(!isPlaying);
  };

  const renderAttachment = () => {
    if (!attachmentUrl) return null;

    switch (attachmentType) {
      case "image":
        return (
          <>
            <img
              src={attachmentUrl}
              alt={attachmentName || "Imagem"}
              className="max-w-full max-h-64 rounded-lg cursor-pointer object-cover"
              onClick={() => setImagePreviewOpen(true)}
            />
            <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
              <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-50 bg-background/80 hover:bg-background"
                  onClick={() => setImagePreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <img
                  src={attachmentUrl}
                  alt={attachmentName || "Imagem"}
                  className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
                />
              </DialogContent>
            </Dialog>
          </>
        );

      case "video":
        return (
          <video
            src={attachmentUrl}
            controls
            className="max-w-full max-h-64 rounded-lg"
          >
            Seu navegador não suporta vídeos.
          </video>
        );

      case "audio":
        const isClientAudio = !isOutgoing;
        const isTranscribing = content === "[Transcrevendo áudio...]" || content === "[Áudio - transcrição não disponível]";
        const hasRealAudio = attachmentUrl && !attachmentUrl.startsWith("simulated://");
        
        return (
          <div className={cn(
            "rounded-lg overflow-hidden min-w-[220px]",
            isOutgoing ? "bg-primary-foreground/10" : "bg-background"
          )}>
            {/* Audio label for client messages */}
            {isClientAudio && showAudioLabel && (
              <div className={cn(
                "flex items-center gap-1.5 px-3 pt-2 text-xs font-medium",
                "text-muted-foreground"
              )}>
                <Mic className="h-3 w-3" />
                <span>Mensagem de áudio do cliente</span>
              </div>
            )}
            
            {/* Audio player */}
            <div className="flex items-center gap-3 p-3">
              {hasRealAudio ? (
                <>
                  <audio
                    id={`audio-${attachmentUrl}`}
                    src={attachmentUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 rounded-full shrink-0",
                      isOutgoing 
                        ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" 
                        : "bg-primary/10 hover:bg-primary/20"
                    )}
                    onClick={() => {
                      const audio = document.getElementById(`audio-${attachmentUrl}`) as HTMLAudioElement;
                      if (audio) handleAudioToggle(audio);
                    }}
                  >
                    {isPlaying ? (
                      <Pause className={cn("h-5 w-5", isOutgoing ? "text-primary-foreground" : "text-primary")} />
                    ) : (
                      <Play className={cn("h-5 w-5", isOutgoing ? "text-primary-foreground" : "text-primary")} />
                    )}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <audio
                      src={attachmentUrl}
                      controls
                      className="w-full max-w-[200px] h-8"
                      style={{ 
                        filter: isOutgoing ? "invert(1) hue-rotate(180deg)" : "none",
                        opacity: 0.9
                      }}
                    />
                  </div>
                  {/* Download button for client audios */}
                  {isClientAudio && (
                    <a
                      href={attachmentUrl}
                      download={attachmentName || "audio.webm"}
                      className="shrink-0"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </>
              ) : (
                // Simulated audio (no real audio file)
                <div className="flex items-center gap-2 py-1">
                  <div className={cn(
                    "h-10 w-10 rounded-full shrink-0 flex items-center justify-center",
                    isOutgoing 
                      ? "bg-primary-foreground/20" 
                      : "bg-primary/10"
                  )}>
                    <Mic className={cn("h-5 w-5", isOutgoing ? "text-primary-foreground" : "text-primary")} />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full w-32 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/30 animate-pulse" />
                    </div>
                    <span className="text-xs text-muted-foreground">Áudio simulado</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Transcription */}
            {isTranscribing ? (
              <div className={cn(
                "px-3 pb-2 text-xs italic flex items-center gap-1.5",
                isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                Transcrevendo áudio...
              </div>
            ) : content && content !== "[Áudio - transcrição não disponível]" ? (
              <div className={cn(
                "px-3 pb-2 text-sm",
                isOutgoing ? "text-primary-foreground/90" : "text-foreground"
              )}>
                <span className="text-xs text-muted-foreground block mb-1">Transcrição:</span>
                "{content}"
              </div>
            ) : null}
          </div>
        );

      case "pdf":
        return (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg transition-colors",
              isOutgoing 
                ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                : "bg-background hover:bg-muted"
            )}
          >
            <FileText className="h-8 w-8 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachmentName || "Documento PDF"}</p>
              <p className="text-xs text-muted-foreground">Clique para abrir</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </a>
        );

      default:
        return (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg transition-colors",
              isOutgoing 
                ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                : "bg-background hover:bg-muted"
            )}
          >
            <Download className="h-6 w-6" />
            <span className="text-sm truncate">{attachmentName || "Arquivo"}</span>
          </a>
        );
    }
  };

  return (
    <div
      className={cn(
        "flex",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm space-y-2",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        {/* Attachment */}
        {hasAttachment && renderAttachment()}

        {/* Text content */}
        {content && (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            "text-[10px]",
            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {format(new Date(timestamp), "HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;
