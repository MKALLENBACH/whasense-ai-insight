import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bot,
  Building2,
  Plus,
  Save,
  Trash2,
  Copy,
  Download,
  Upload,
  Loader2,
  FileText,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Company {
  id: string;
  name: string;
  is_active: boolean;
}

interface AIScript {
  id: string;
  company_id: string;
  script_name: string;
  is_active: boolean;
  ai_persona: string | null;
  sales_playbook: string | null;
  forbidden_phrases: string | null;
  recommended_phrases: string | null;
  tone_of_voice: string | null;
  product_context: string | null;
  objection_handling: string | null;
  closing_techniques: string | null;
  opening_messages: string | null;
  example_responses: string | null;
  created_at: string;
  updated_at: string;
}

const emptyScript: Omit<AIScript, "id" | "company_id" | "created_at" | "updated_at"> = {
  script_name: "",
  is_active: false,
  ai_persona: "",
  sales_playbook: "",
  forbidden_phrases: "",
  recommended_phrases: "",
  tone_of_voice: "",
  product_context: "",
  objection_handling: "",
  closing_techniques: "",
  opening_messages: "",
  example_responses: "",
};

const AdminAIScriptsPage = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<AIScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<AIScript | null>(null);
  const [defaultScript, setDefaultScript] = useState<AIScript | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [activeTab, setActiveTab] = useState("companies");

  useEffect(() => {
    fetchCompanies();
    fetchDefaultScript();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchScriptsForCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, is_active")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDefaultScript = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/default");
      if (error) throw error;
      setDefaultScript(data.script);
    } catch (error) {
      console.error("Error fetching default script:", error);
    }
  };

  const fetchScriptsForCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/by-company", {
        body: {},
      });
      
      // Use query params approach
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-scripts/by-company?companyId=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      setScripts(result.scripts || []);
      setSelectedScript(null);
    } catch (error) {
      console.error("Error fetching scripts:", error);
      toast.error("Erro ao carregar scripts");
    }
  };

  const handleCreateScript = async () => {
    if (!selectedCompanyId || !newScriptName.trim()) {
      toast.error("Selecione uma empresa e informe o nome do script");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/create", {
        body: {
          companyId: selectedCompanyId,
          scriptName: newScriptName,
          isActive: scripts.length === 0,
        },
      });

      if (error) throw error;

      toast.success("Script criado com sucesso");
      setNewScriptName("");
      fetchScriptsForCompany(selectedCompanyId);
    } catch (error) {
      console.error("Error creating script:", error);
      toast.error("Erro ao criar script");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveScript = async () => {
    if (!selectedScript) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/update", {
        body: {
          id: selectedScript.id,
          scriptName: selectedScript.script_name,
          isActive: selectedScript.is_active,
          aiPersona: selectedScript.ai_persona,
          salesPlaybook: selectedScript.sales_playbook,
          forbiddenPhrases: selectedScript.forbidden_phrases,
          recommendedPhrases: selectedScript.recommended_phrases,
          toneOfVoice: selectedScript.tone_of_voice,
          productContext: selectedScript.product_context,
          objectionHandling: selectedScript.objection_handling,
          closingTechniques: selectedScript.closing_techniques,
          openingMessages: selectedScript.opening_messages,
          exampleResponses: selectedScript.example_responses,
        },
      });

      if (error) throw error;

      toast.success("Script salvo com sucesso");
      if (selectedCompanyId) {
        fetchScriptsForCompany(selectedCompanyId);
      }
    } catch (error) {
      console.error("Error saving script:", error);
      toast.error("Erro ao salvar script");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDefaultScript = async () => {
    if (!defaultScript) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/update-default", {
        body: {
          id: defaultScript.id,
          scriptName: defaultScript.script_name,
          aiPersona: defaultScript.ai_persona,
          salesPlaybook: defaultScript.sales_playbook,
          forbiddenPhrases: defaultScript.forbidden_phrases,
          recommendedPhrases: defaultScript.recommended_phrases,
          toneOfVoice: defaultScript.tone_of_voice,
          productContext: defaultScript.product_context,
          objectionHandling: defaultScript.objection_handling,
          closingTechniques: defaultScript.closing_techniques,
          openingMessages: defaultScript.opening_messages,
          exampleResponses: defaultScript.example_responses,
        },
      });

      if (error) throw error;

      toast.success("Script padrão salvo com sucesso");
    } catch (error) {
      console.error("Error saving default script:", error);
      toast.error("Erro ao salvar script padrão");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm("Tem certeza que deseja excluir este script?")) return;

    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/delete", {
        body: { id: scriptId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Script excluído");
      setSelectedScript(null);
      if (selectedCompanyId) {
        fetchScriptsForCompany(selectedCompanyId);
      }
    } catch (error) {
      console.error("Error deleting script:", error);
      toast.error("Erro ao excluir script");
    }
  };

  const handleCloneScript = async (scriptId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-scripts/clone", {
        body: { sourceId: scriptId },
      });

      if (error) throw error;

      toast.success("Script clonado com sucesso");
      if (selectedCompanyId) {
        fetchScriptsForCompany(selectedCompanyId);
      }
    } catch (error) {
      console.error("Error cloning script:", error);
      toast.error("Erro ao clonar script");
    }
  };

  const handleExportScript = (script: AIScript) => {
    const exportData = {
      script_name: script.script_name,
      ai_persona: script.ai_persona,
      sales_playbook: script.sales_playbook,
      forbidden_phrases: script.forbidden_phrases,
      recommended_phrases: script.recommended_phrases,
      tone_of_voice: script.tone_of_voice,
      product_context: script.product_context,
      objection_handling: script.objection_handling,
      closing_techniques: script.closing_techniques,
      opening_messages: script.opening_messages,
      example_responses: script.example_responses,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.script_name.replace(/\s+/g, "_")}_script.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Script exportado");
  };

  const handleImportScript = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompanyId) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke("ai-scripts/create", {
        body: {
          companyId: selectedCompanyId,
          scriptName: importData.script_name || "Script Importado",
          isActive: false,
          aiPersona: importData.ai_persona,
          salesPlaybook: importData.sales_playbook,
          forbiddenPhrases: importData.forbidden_phrases,
          recommendedPhrases: importData.recommended_phrases,
          toneOfVoice: importData.tone_of_voice,
          productContext: importData.product_context,
          objectionHandling: importData.objection_handling,
          closingTechniques: importData.closing_techniques,
          openingMessages: importData.opening_messages,
          exampleResponses: importData.example_responses,
        },
      });

      if (error) throw error;

      toast.success("Script importado com sucesso");
      fetchScriptsForCompany(selectedCompanyId);
    } catch (error) {
      console.error("Error importing script:", error);
      toast.error("Erro ao importar script");
    }

    event.target.value = "";
  };

  const updateSelectedScript = (field: keyof AIScript, value: string | boolean) => {
    if (selectedScript) {
      setSelectedScript({ ...selectedScript, [field]: value });
    }
  };

  const updateDefaultScriptField = (field: keyof AIScript, value: string) => {
    if (defaultScript) {
      setDefaultScript({ ...defaultScript, [field]: value });
    }
  };

  const ScriptEditor = ({ script, onChange, onSave, isSaving }: {
    script: AIScript;
    onChange: (field: keyof AIScript, value: string | boolean) => void;
    onSave: () => void;
    isSaving: boolean;
  }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Input
            value={script.script_name}
            onChange={(e) => onChange("script_name", e.target.value)}
            className="bg-slate-700 border-slate-600 text-white w-64"
            placeholder="Nome do script"
          />
          {"is_active" in script && (
            <div className="flex items-center gap-2">
              <Switch
                checked={script.is_active}
                onCheckedChange={(checked) => onChange("is_active", checked)}
              />
              <Label className="text-slate-300">Script Ativo</Label>
            </div>
          )}
        </div>
        <Button onClick={onSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-700">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="text-slate-300">Persona do Vendedor (AI Persona)</Label>
            <Textarea
              value={script.ai_persona || ""}
              onChange={(e) => onChange("ai_persona", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[120px]"
              placeholder="Defina a personalidade e papel do assistente de vendas..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Playbook de Vendas</Label>
            <Textarea
              value={script.sales_playbook || ""}
              onChange={(e) => onChange("sales_playbook", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[150px]"
              placeholder="Etapas do processo de vendas, técnicas usadas..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Tom de Voz</Label>
            <Textarea
              value={script.tone_of_voice || ""}
              onChange={(e) => onChange("tone_of_voice", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[80px]"
              placeholder="Formal, informal, técnico, amigável..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Contexto de Produtos/Serviços</Label>
            <Textarea
              value={script.product_context || ""}
              onChange={(e) => onChange("product_context", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[150px]"
              placeholder="Descreva os produtos/serviços da empresa..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-300">Frases Recomendadas</Label>
            <Textarea
              value={script.recommended_phrases || ""}
              onChange={(e) => onChange("recommended_phrases", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[100px]"
              placeholder="Frases e expressões que devem ser usadas..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Frases Proibidas</Label>
            <Textarea
              value={script.forbidden_phrases || ""}
              onChange={(e) => onChange("forbidden_phrases", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[100px]"
              placeholder="Palavras e expressões que nunca devem ser usadas..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Como Lidar com Objeções</Label>
            <Textarea
              value={script.objection_handling || ""}
              onChange={(e) => onChange("objection_handling", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[120px]"
              placeholder="Técnicas para contornar objeções comuns..."
            />
          </div>

          <div>
            <Label className="text-slate-300">Técnicas de Fechamento</Label>
            <Textarea
              value={script.closing_techniques || ""}
              onChange={(e) => onChange("closing_techniques", e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[100px]"
              placeholder="Como conduzir para o fechamento da venda..."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Label className="text-slate-300">Mensagens de Abertura Recomendadas</Label>
          <Textarea
            value={script.opening_messages || ""}
            onChange={(e) => onChange("opening_messages", e.target.value)}
            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[100px]"
            placeholder="Exemplos de como iniciar conversas..."
          />
        </div>

        <div>
          <Label className="text-slate-300">Exemplos de Respostas Ideais</Label>
          <Textarea
            value={script.example_responses || ""}
            onChange={(e) => onChange("example_responses", e.target.value)}
            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[100px]"
            placeholder="Exemplos de diálogos ideais..."
          />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="h-7 w-7 text-orange-500" />
            AI Scripts
          </h1>
          <p className="text-slate-400">Configure o comportamento da IA para cada empresa</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="companies" className="data-[state=active]:bg-orange-600">
              <Building2 className="h-4 w-4 mr-2" />
              Por Empresa
            </TabsTrigger>
            <TabsTrigger value="default" className="data-[state=active]:bg-orange-600">
              <FileText className="h-4 w-4 mr-2" />
              Script Padrão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Company Selection */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Empresas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => setSelectedCompanyId(company.id)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedCompanyId === company.id
                              ? "bg-orange-600 text-white"
                              : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{company.name}</span>
                            {!company.is_active && (
                              <Badge variant="destructive" className="text-xs">Inativa</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Scripts Panel */}
              <div className="lg:col-span-3">
                {selectedCompanyId ? (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-white">
                            Scripts de {companies.find((c) => c.id === selectedCompanyId)?.name}
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            {scripts.length} script(s) configurado(s)
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportScript}
                            className="hidden"
                            id="import-script"
                          />
                          <label htmlFor="import-script">
                            <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-1" />
                                Importar
                              </span>
                            </Button>
                          </label>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                                <Plus className="h-4 w-4 mr-1" />
                                Novo Script
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-800 border-slate-700">
                              <DialogHeader>
                                <DialogTitle className="text-white">Criar Novo Script</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-slate-300">Nome do Script</Label>
                                  <Input
                                    value={newScriptName}
                                    onChange={(e) => setNewScriptName(e.target.value)}
                                    className="bg-slate-700 border-slate-600 text-white mt-1"
                                    placeholder="Ex: Script Principal"
                                  />
                                </div>
                                <Button
                                  onClick={handleCreateScript}
                                  disabled={isCreating}
                                  className="w-full bg-orange-600 hover:bg-orange-700"
                                >
                                  {isCreating ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                  )}
                                  Criar Script
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {scripts.length === 0 ? (
                        <div className="text-center py-12">
                          <Bot className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                          <p className="text-slate-400">Nenhum script configurado</p>
                          <p className="text-slate-500 text-sm">
                            Esta empresa usará o script padrão do Whasense
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Script List */}
                          <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-700">
                            {scripts.map((script) => (
                              <button
                                key={script.id}
                                onClick={() => setSelectedScript(script)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                  selectedScript?.id === script.id
                                    ? "bg-orange-600 text-white"
                                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                                }`}
                              >
                                {script.is_active && (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                )}
                                <span>{script.script_name}</span>
                              </button>
                            ))}
                          </div>

                          {/* Script Editor */}
                          {selectedScript && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCloneScript(selectedScript.id)}
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  Clonar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExportScript(selectedScript)}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Exportar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteScript(selectedScript.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Excluir
                                </Button>
                              </div>

                              <ScriptEditor
                                script={selectedScript}
                                onChange={updateSelectedScript}
                                onSave={handleSaveScript}
                                isSaving={isSaving}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">Selecione uma empresa para gerenciar seus scripts</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="default" className="mt-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Script Padrão do Whasense</CardTitle>
                <CardDescription className="text-slate-400">
                  Este script é usado quando uma empresa não tem script próprio configurado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {defaultScript ? (
                  <ScriptEditor
                    script={defaultScript}
                    onChange={updateDefaultScriptField}
                    onSave={handleSaveDefaultScript}
                    isSaving={isSaving}
                  />
                ) : (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAIScriptsPage;
