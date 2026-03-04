

# Documentação Técnica de Negócio — Whasense

Vou criar um documento completo em `docs/DOCUMENTACAO_TECNICA_NEGOCIO.md` com toda a documentação funcional do sistema para apresentar aos sócios.

---

## Conteúdo do Documento

### Visão Geral
O **Whasense** é uma plataforma SaaS de inteligência em vendas via WhatsApp. Analisa conversas em tempo real usando IA, classifica leads, sugere respostas, detecta objeções e fornece dashboards estratégicos.

**Público-alvo:** Empresas que usam WhatsApp como canal de vendas.

---

### 3 Perfis de Usuário

**Vendedor** — Atende leads, vê insights IA em tempo real, registra vendas, acompanha performance e gamificação.

**Gestor (Manager)** — Dashboard gerencial, gerencia equipe, define metas, configura follow-ups e WhatsApp, controla plano e pagamentos, acessa Cliente 360°.

**Admin Whasense (interno)** — Gerencia todas as empresas, planos, preços, scripts de IA, monitora saúde do sistema e métricas financeiras (MRR/ARR).

---

### 17 Módulos Funcionais Documentados

1. **Inbox Pai** — Ponto central de entrada de leads. Vendedores puxam leads para sua fila.
2. **Conversas / Meus Leads** — Lista de conversas atribuídas com temperatura, status e última mensagem.
3. **Chat Individual** — Conversa + painel lateral de IA (temperatura, sentimento, objeções, sugestões).
4. **Análise de IA** — Processamento assíncrono de texto, áudio e imagem com fila e retry.
5. **Dashboard Gerencial** — 7 KPIs + 8 gráficos/análises (distribuição, riscos, objeções, performance, timeline).
6. **Dashboard Vendedor** — KPIs pessoais, prioridades do dia, funil de vendas, conversão mensal.
7. **Alertas** — Notificações automáticas (lead quente, sem resposta, objeção aberta) com severidade.
8. **Cliente 360°** — Visão consolidada empresa-cliente com compradores, ciclos, objeções, resumo IA.
9. **Ciclos de Venda** — Multi-ciclo por cliente (pre_sale, post_sale) com status pending→won/lost.
10. **Gestão de Vendedores** — Criar, ativar/desativar, editar, controlar limites por plano.
11. **Metas e Gamificação** — Metas configuráveis + pontos + badges + leaderboard.
12. **Follow-ups Automáticos** — Mensagens de follow-up geradas por IA quando cliente não responde.
13. **Integração WhatsApp** — Via Cloud API (Meta) com webhook bidirecional.
14. **Configurações Operacionais** — Distribuição de leads, limites, regras de IA.
15. **Financeiro** — 5 planos (Free→Enterprise), Stripe, portal do cliente, bloqueio por inadimplência.
16. **Histórico de Ciclos** — Todos os ciclos encerrados com filtros e detalhes.
17. **Painel Admin** — 10 sub-módulos (dashboard, empresas, gestores, IA, planos, monitor, saúde, pagamentos, webhook, tutorial).

---

### Regras de Negócio Documentadas
- Controle de acesso por plano (bloqueio progressivo)
- Ciclo de vida completo de um lead (webhook → inbox → vendedor → IA → ciclo → venda)
- Segurança (RLS, multi-tenant, roles separadas)
- Processamento assíncrono com fila (10.000+ leads/dia)

### Integrações
- WhatsApp Cloud API, Stripe, IA (Gemini/GPT), Resend (emails)

### 30+ Edge Functions documentadas
- Cada função listada com sua descrição funcional

### Modelo de Dados Simplificado
- Diagrama ASCII mostrando relações entre as 20+ tabelas

### Fluxo de Onboarding (8 passos)
- Do trial até vendedores atendendo leads

### Métricas de Negócio (Admin)
- MRR, ARR, churn, inadimplência, uso do sistema

---

## Implementação

Criar o arquivo `docs/DOCUMENTACAO_TECNICA_NEGOCIO.md` com todo o conteúdo acima expandido em ~500 linhas de documentação clara e organizada, sem jargão técnico desnecessário, focada em fazer sócios entenderem cada funcionalidade.

