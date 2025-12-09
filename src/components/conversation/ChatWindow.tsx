import { useState } from "react";
import { Message, Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, MoreVertical, Phone, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onMarkSale: (status: "won" | "lost") => void;
}

const ChatWindow = ({ conversation, messages, onSendMessage, onMarkSale }: ChatWindowProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMarkSale = (status: "won" | "lost") => {
    onMarkSale(status);
    toast.success(status === "won" ? "Venda registrada com sucesso!" : "Venda perdida registrada");
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {conversation.contact.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold">{conversation.contact.name}</h3>
            <p className="text-sm text-muted-foreground">{conversation.contact.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LeadTemperatureBadge temperature={conversation.leadTemperature} size="sm" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleMarkSale("won")} className="text-success">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar como Venda Ganha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMarkSale("lost")} className="text-destructive">
                <XCircle className="h-4 w-4 mr-2" />
                Marcar como Venda Perdida
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.sender === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                message.sender === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card text-card-foreground rounded-bl-md border border-border"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={cn(
                  "text-[10px] mt-1",
                  message.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {format(message.timestamp, "HH:mm")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon" disabled={!inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
