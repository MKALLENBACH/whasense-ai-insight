import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, Loader2, X, Image, FileText, Film, Music } from "lucide-react";
import { toast } from "sonner";
import AudioRecorder from "./AudioRecorder";

interface PendingFile {
  file: File;
  preview?: string;
  type: "image" | "video" | "audio" | "pdf" | "other";
}

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: { url: string; type: string; name: string }[]) => Promise<void>;
  onSendAudio?: (audioBlob: Blob) => Promise<void>;
  disabled?: boolean;
  companyId?: string;
  customerId: string;
  cycleId: string;
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
}

const ChatInput = ({ 
  onSendMessage, 
  onSendAudio,
  disabled, 
  companyId, 
  customerId, 
  cycleId, 
  initialMessage, 
  onMessageChange 
}: ChatInputProps) => {
  const [message, setMessage] = useState(initialMessage || "");
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // max-h-32 = 128px
    }
  };

  // Sync with external initialMessage when it changes (e.g., when suggestion is applied)
  useEffect(() => {
    if (initialMessage !== undefined && initialMessage !== message) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const getFileType = (file: File): PendingFile["type"] => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type === "application/pdf") return "pdf";
    return "other";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const newPendingFiles: PendingFile[] = files.map((file) => {
      const type = getFileType(file);
      let preview: string | undefined;
      
      if (type === "image") {
        preview = URL.createObjectURL(file);
      }
      
      return { file, preview, type };
    });
    
    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async (): Promise<{ url: string; type: string; name: string }[]> => {
    const uploadedFiles: { url: string; type: string; name: string }[] = [];

    for (const pending of pendingFiles) {
      const fileName = `${Date.now()}-${pending.file.name}`;
      const filePath = `${companyId}/${customerId}/${cycleId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("message_attachments")
        .upload(filePath, pending.file);

      if (error) {
        console.error("Upload error:", error);
        toast.error(`Erro ao fazer upload de ${pending.file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("message_attachments")
        .getPublicUrl(filePath);

      uploadedFiles.push({
        url: urlData.publicUrl,
        type: pending.type,
        name: pending.file.name,
      });
    }

    return uploadedFiles;
  };

  const handleSend = async () => {
    if ((!message.trim() && pendingFiles.length === 0) || isSending) return;

    setIsSending(true);
    
    try {
      let attachments: { url: string; type: string; name: string }[] = [];
      
      if (pendingFiles.length > 0) {
        setIsUploading(true);
        attachments = await uploadFiles();
        setIsUploading(false);
      }

      await onSendMessage(message.trim(), attachments.length > 0 ? attachments : undefined);
      
      // Cleanup
      pendingFiles.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setPendingFiles([]);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift/Ctrl = do nothing (don't send)
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      // Don't send - user must click button
    }
    // Shift+Enter or Ctrl+Enter = allow line break (default behavior)
  };

  const getFileIcon = (type: PendingFile["type"]) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4" />;
      case "video": return <Film className="h-4 w-4" />;
      case "audio": return <Music className="h-4 w-4" />;
      case "pdf": return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-4 border-t border-border space-y-3">
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((pending, index) => (
            <div
              key={index}
              className="relative bg-muted rounded-lg p-2 flex items-center gap-2 group"
            >
              {pending.type === "image" && pending.preview ? (
                <img
                  src={pending.preview}
                  alt={pending.file.name}
                  className="h-12 w-12 object-cover rounded"
                />
              ) : (
                <div className="h-12 w-12 bg-background rounded flex items-center justify-center">
                  {getFileIcon(pending.type)}
                </div>
              )}
              <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                {pending.file.name}
              </span>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* File upload button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
              className="shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Anexar arquivo</TooltipContent>
        </Tooltip>

        {/* Audio recorder */}
        {onSendAudio && (
          <AudioRecorder 
            onSendAudio={onSendAudio} 
            disabled={disabled || isSending} 
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,audio/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled || isSending}
            className="min-h-[44px] max-h-32 resize-none pr-20 overflow-y-auto"
            rows={1}
          />
          <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground pointer-events-none">
            Shift+Enter: nova linha
          </span>
        </div>

        {/* Send button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSend}
              disabled={disabled || isSending || (!message.trim() && pendingFiles.length === 0)}
              size="icon"
              className="shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar mensagem</TooltipContent>
        </Tooltip>
      </div>

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando arquivos...
        </div>
      )}
    </div>
  );
};

export default ChatInput;
