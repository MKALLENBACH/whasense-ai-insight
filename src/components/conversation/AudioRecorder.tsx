import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Mic, Square, Play, Pause, Send, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSendAudio: (blob: Blob) => Promise<void>;
  disabled?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSendAudio, disabled }) => {
  const {
    recordingState,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
    error,
  } = useAudioRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    setIsSending(true);
    try {
      await onSendAudio(audioBlob);
      clearRecording();
    } catch (err) {
      console.error("Error sending audio:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Idle state - show mic button
  if (recordingState === "idle") {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <div className="flex items-center gap-1 text-destructive text-xs">
            <AlertCircle className="h-3 w-3" />
            <span className="max-w-[200px] truncate">{error}</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={startRecording}
          disabled={disabled}
          className="shrink-0 hover:bg-primary/10 hover:text-primary"
          title="Gravar áudio"
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Recording state
  if (recordingState === "recording") {
    return (
      <div className="flex items-center gap-3 bg-destructive/10 rounded-full px-4 py-2 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">REC</span>
        </div>
        <span className="text-sm font-mono tabular-nums">{formatTime(recordingTime)}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={stopRecording}
            className="h-8 w-8 bg-destructive hover:bg-destructive/90"
            title="Parar gravação"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Stopped state - review audio
  if (recordingState === "stopped" && audioUrl) {
    return (
      <div className="flex items-center gap-3 bg-muted rounded-full px-4 py-2">
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePlayPause}
          className="h-8 w-8"
          title={isPlaying ? "Pausar" : "Ouvir"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {formatTime(recordingTime)}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearRecording}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Descartar"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={handleSend}
            disabled={isSending}
            className="h-8 w-8 bg-primary hover:bg-primary/90"
            title="Enviar áudio"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default AudioRecorder;
