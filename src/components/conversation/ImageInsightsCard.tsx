import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Image,
  FileText,
  ShoppingBag,
  Receipt,
  Table,
  Camera,
  User,
  AlertTriangle,
  Target,
  Thermometer,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageAnalysisData {
  description: string;
  ocr_text: string;
  detected_type: string;
  sentiment: string;
  objection: string;
  intention: string;
  temperature_adjustment: string;
  action_required: string;
  summary: string;
  detected_products?: string[];
}

interface ImageInsightsCardProps {
  imageUrl: string;
  analysisData: ImageAnalysisData;
  isSeller?: boolean;
}

const typeConfig: Record<string, { icon: typeof Image; label: string; color: string }> = {
  produto: { icon: ShoppingBag, label: "Produto", color: "bg-primary/10 text-primary" },
  comprovante: { icon: Receipt, label: "Comprovante", color: "bg-success/10 text-success" },
  documento: { icon: FileText, label: "Documento", color: "bg-info/10 text-info" },
  tabela: { icon: Table, label: "Tabela", color: "bg-warning/10 text-warning" },
  foto_ambiente: { icon: Camera, label: "Foto Ambiente", color: "bg-muted text-muted-foreground" },
  selfie: { icon: User, label: "Selfie", color: "bg-muted text-muted-foreground" },
  outro: { icon: Image, label: "Outro", color: "bg-muted text-muted-foreground" },
};

const objectionLabels: Record<string, string> = {
  preco: "Preço",
  prazo: "Prazo de entrega",
  confianca: "Confiança",
  concorrencia: "Concorrência",
  qualidade: "Qualidade",
  nenhuma: "Nenhuma",
};

const intentionLabels: Record<string, string> = {
  avaliando: "Avaliando",
  pronto_para_comprar: "Pronto para comprar",
  sem_intencao: "Sem intenção",
  duvida: "Dúvida",
};

const ImageInsightsCard = ({ imageUrl, analysisData, isSeller }: ImageInsightsCardProps) => {
  const typeInfo = typeConfig[analysisData.detected_type] || typeConfig.outro;
  const TypeIcon = typeInfo.icon;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-3 space-y-3">
        {/* Header with type badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Análise de Imagem</span>
          </div>
          <Badge className={cn("text-xs", typeInfo.color)}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {typeInfo.label}
          </Badge>
        </div>

        {/* Image preview */}
        <div className="relative w-full h-24 rounded-md overflow-hidden bg-muted">
          <img 
            src={imageUrl} 
            alt="Imagem analisada" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Descrição</p>
          <p className="text-sm">{analysisData.description}</p>
        </div>

        {/* OCR Text (if exists) */}
        {analysisData.ocr_text && analysisData.ocr_text.length > 0 && (
          <div className="bg-muted/50 rounded-md p-2">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Texto extraído (OCR)
            </p>
            <p className="text-xs font-mono whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
              {analysisData.ocr_text}
            </p>
          </div>
        )}

        {/* Detected products */}
        {analysisData.detected_products && analysisData.detected_products.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Produtos detectados</p>
            <div className="flex flex-wrap gap-1">
              {analysisData.detected_products.map((product, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Client-specific insights */}
        {!isSeller && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Intention */}
            {analysisData.intention && analysisData.intention !== "sem_intencao" && (
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-muted-foreground">Intenção:</span>
                <span className="font-medium">
                  {intentionLabels[analysisData.intention] || analysisData.intention}
                </span>
              </div>
            )}

            {/* Temperature adjustment */}
            {analysisData.temperature_adjustment && analysisData.temperature_adjustment !== "none" && (
              <div className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                <span className="text-muted-foreground">Temp:</span>
                {analysisData.temperature_adjustment === "increase" ? (
                  <span className="flex items-center text-success font-medium">
                    <ArrowUp className="h-3 w-3" /> Aumentou
                  </span>
                ) : (
                  <span className="flex items-center text-destructive font-medium">
                    <ArrowDown className="h-3 w-3" /> Diminuiu
                  </span>
                )}
              </div>
            )}

            {/* Objection */}
            {analysisData.objection && analysisData.objection !== "nenhuma" && (
              <div className="col-span-2 flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>Objeção: {objectionLabels[analysisData.objection] || analysisData.objection}</span>
              </div>
            )}
          </div>
        )}

        {/* Action required */}
        {analysisData.action_required && analysisData.action_required !== "nenhuma" && (
          <div className="bg-warning/10 border border-warning/20 rounded-md p-2">
            <p className="text-xs font-medium text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Ação recomendada
            </p>
            <p className="text-xs mt-1">
              {analysisData.action_required.replace(/_/g, " ")}
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Resumo:</strong> {analysisData.summary}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageInsightsCard;
