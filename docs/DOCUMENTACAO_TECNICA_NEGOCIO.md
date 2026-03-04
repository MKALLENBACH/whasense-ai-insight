# Documentação Técnica de Negócio — Whasense

> **Versão:** 1.0 | **Data:** Março 2026  
> **Objetivo:** Apresentar de forma clara e completa todas as funcionalidades, regras de negócio, integrações e arquitetura do Whasense para alinhamento entre sócios.

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Proposta de Valor](#2-proposta-de-valor)
3. [Perfis de Usuário](#3-perfis-de-usuário)
4. [Módulos Funcionais](#4-módulos-funcionais)
5. [Regras de Negócio](#5-regras-de-negócio)
6. [Integrações Externas](#6-integrações-externas)
7. [Funções de Backend (Edge Functions)](#7-funções-de-backend-edge-functions)
8. [Modelo de Dados](#8-modelo-de-dados)
9. [Fluxo de Onboarding](#9-fluxo-de-onboarding)
10. [Planos e Monetização](#10-planos-e-monetização)
11. [Segurança e Multi-Tenancy](#11-segurança-e-multi-tenancy)
12. [Métricas de Negócio (Admin)](#12-métricas-de-negócio-admin)
13. [Stack Tecnológica](#13-stack-tecnológica)
14. [Glossário](#14-glossário)

---

## 1. Visão Geral do Produto

O **Whasense** é uma plataforma SaaS (Software como Serviço) de **inteligência em vendas via WhatsApp**. A plataforma conecta-se ao WhatsApp Business da empresa cliente e utiliza Inteligência Artificial para:

- **Analisar conversas em tempo real** — cada mensagem recebida é processada por IA
- **Classificar leads automaticamente** — temperatura (quente/morno/frio), sentimento, intenção de compra
- **Sugerir respostas** — a IA recomenda o que o vendedor deve responder
- **Detectar objeções** — identifica quando o cliente levanta barreiras à compra
- **Fornecer dashboards estratégicos** — visão gerencial completa de toda a operação de vendas

**Público-alvo:** Empresas de qualquer porte que utilizam WhatsApp como canal de vendas e possuem equipes de vendedores.

**Problema que resolve:** Falta de visibilidade sobre conversas, baixa taxa de conversão, tempo de resposta lento, objeções mal tratadas e ausência de indicadores de performance para gestores.

---

## 2. Proposta de Valor

| Dor do mercado | Solução Whasense |
|---|---|
| Vendedor não sabe priorizar leads | IA classifica temperatura automaticamente |
| Gestor não tem visibilidade | Dashboard em tempo real com KPIs |
| Objeções passam despercebidas | Detecção automática + sugestão de resposta |
| Sem histórico organizado | Cliente 360° com timeline completa |
| Vendedores sem motivação | Gamificação com pontos, badges e ranking |
| Follow-up esquecido | Automação de follow-up por IA |
| Difícil medir performance | Métricas por vendedor, por período, por tipo |

---

## 3. Perfis de Usuário

O sistema possui **3 perfis** com permissões distintas:

### 3.1. Vendedor (`seller`)

O vendedor é o usuário operacional que atende os leads no dia a dia.

**O que ele faz:**
- Puxa leads do **Inbox Pai** (fila central de leads não atribuídos)
- Visualiza suas conversas na tela **Meus Leads**
- Conversa com clientes no **Chat** com painel de IA ao lado
- Recebe **alertas** sobre leads quentes, objeções abertas e clientes sem resposta
- Registra **vendas** (ganhas ou perdidas) com motivo
- Acompanha sua **performance pessoal** (KPIs, funil, conversão)
- Vê sua posição no **ranking de gamificação** (pontos e badges)
- Grava e envia **áudios** que são transcritos e analisados pela IA

**O que ele NÃO faz:**
- Não gerencia outros vendedores
- Não configura o sistema
- Não acessa dados de outros vendedores
- Não controla planos ou pagamentos

### 3.2. Gestor / Manager (`manager`)

O gestor é o administrador da empresa cliente dentro do Whasense.

**O que ele faz:**
- Acessa o **Dashboard Gerencial** com visão completa da operação
- **Cria e gerencia vendedores** (ativar, desativar, editar)
- Define **metas** de vendas (mensais, semanais, trimestrais)
- Configura **follow-ups automáticos** (tempo de espera, habilitação)
- Configura a **integração com WhatsApp** (token, número, webhook)
- Acessa o **Cliente 360°** — visão consolidada de empresas-clientes
- Configura **regras operacionais** (distribuição de leads, limites por vendedor)
- Gerencia o **plano e pagamentos** da empresa via Stripe
- Visualiza **performance individual** de cada vendedor
- Reatribui leads entre vendedores
- Acessa **histórico completo** de ciclos de venda

**O que ele NÃO faz:**
- Não gerencia outras empresas (apenas a sua)
- Não acessa o painel administrativo do Whasense
- Não edita scripts de IA globais

### 3.3. Admin Whasense (`admin`)

O admin é o perfil interno da equipe Whasense. É quem opera a plataforma como um todo.

**O que ele faz:**
- Acessa o **Painel Administrativo** com visão de todas as empresas
- Monitora **saúde do sistema** (filas, erros, latência)
- Gerencia **planos e preços** (criar, editar, ativar/desativar)
- Configura **scripts de IA** (persona, tom de voz, frases proibidas, playbook)
- Cria e gerencia **gestores** de empresas
- Monitora **métricas financeiras** (MRR, ARR, inadimplência)
- Visualiza **histórico de pagamentos** de todas as empresas
- Configura **webhooks** e integrações globais
- Gerencia **tutoriais** de WhatsApp para clientes
- Monitora **uso do sistema** por empresa (mensagens, análises de IA)

---

## 4. Módulos Funcionais

### 4.1. Inbox Pai

**O que é:** Ponto central de entrada de todos os leads novos. Quando um cliente envia uma mensagem pelo WhatsApp pela primeira vez, ele cai aqui.

**Como funciona:**
- Leads novos chegam automaticamente via webhook do WhatsApp
- O lead fica **sem vendedor atribuído** até ser "puxado"
- Vendedores veem a lista de leads disponíveis e clicam para puxar para si
- O gestor pode configurar a **ordenação** do inbox (por data, por quantidade de mensagens)
- O gestor pode definir se a distribuição é **livre** (vendedor escolhe) ou **controlada**
- Existe um **limite máximo de leads ativos** por vendedor (configurável)

**Regras:**
- A IA **não analisa** mensagens enquanto o lead está no Inbox Pai (economia de recursos)
- Análise de IA começa apenas **após atribuição** a um vendedor
- Leads no inbox mostram: nome, telefone, última mensagem, data de entrada

### 4.2. Conversas / Meus Leads

**O que é:** Lista de todas as conversas atribuídas ao vendedor logado.

**Informações exibidas por conversa:**
- Nome do cliente e telefone
- Última mensagem trocada
- Data/hora da última interação
- **Temperatura do lead** (🔴 quente / 🟡 morno / 🔵 frio) — calculada pela IA
- **Status do ciclo** (pendente, em progresso, ganho, perdido)
- Indicador de **lead incompleto** (sem dados cadastrais preenchidos)
- Contador de mensagens não lidas

**Filtros disponíveis:** Por temperatura, por status, busca por nome/telefone

### 4.3. Chat Individual

**O que é:** Tela principal de conversa entre vendedor e cliente, com painel lateral de inteligência artificial.

**Área de conversa (esquerda):**
- Histórico completo de mensagens (texto, áudio, imagem, documento)
- Indicação de direção (mensagem recebida vs enviada)
- Divisor visual entre ciclos de venda
- Input de texto + botão de gravação de áudio
- Indicação visual de anexos (imagem, documento, vídeo)

**Painel de IA (direita):**
- **Temperatura do lead** — indicador visual com explicação
- **Sentimento atual** — como o cliente está se sentindo (positivo, neutro, negativo, frustrado)
- **Intenção de compra** — percentual estimado pela IA
- **Objeções detectadas** — lista de barreiras identificadas nas mensagens
- **Sugestões de resposta** — frases recomendadas pela IA para o vendedor usar
- **Próxima ação** — o que a IA recomenda que o vendedor faça

**Funcionalidades extras:**
- Reatribuir lead para outro vendedor (modal)
- Vincular lead a um cliente/empresa (Cliente 360°)
- Registrar venda (ganho ou perda) com modal de detalhes
- Ver histórico de ciclos anteriores daquele cliente
- Painel de ciclo concluído (quando o ciclo já foi fechado)

### 4.4. Análise de IA

**O que é:** Sistema de processamento inteligente que analisa cada mensagem recebida.

**Tipos de análise:**
1. **Texto** — Analisa conteúdo escrito para extrair sentimento, intenção, objeções e temperatura
2. **Áudio** — Transcreve áudios e analisa o conteúdo transcrito
3. **Imagem** — Analisa imagens enviadas pelo cliente (produtos, orçamentos, prints)

**Arquitetura de processamento:**
- Mensagens são enfileiradas em uma **fila de processamento** (`processing_queue`)
- A fila garante que o sistema suporta **alto volume** (10.000+ mensagens/dia)
- Cada item na fila tem **prioridade** e **tentativas** (retry automático em caso de falha)
- Modelos de IA utilizados: **Google Gemini** e **OpenAI GPT**

**Resultado da análise (salvo na tabela `insights`):**
- `temperature` — quente, morno ou frio
- `sentiment` — positivo, neutro, negativo, frustrado, animado
- `intention` — intenção de compra detectada
- `objection` — objeção identificada (ex: "preço alto", "preciso pensar")
- `suggestion` — resposta sugerida pela IA
- `next_action` — próxima ação recomendada

### 4.5. Dashboard Gerencial

**O que é:** Painel estratégico do gestor com visão completa da operação de vendas.

**KPIs principais (cards no topo):**
1. Total de leads ativos
2. Leads quentes (precisam de atenção imediata)
3. Vendas ganhas no período
4. Vendas perdidas no período
5. Taxa de conversão (%)
6. Tempo médio de resposta
7. Total de mensagens processadas

**Gráficos e análises:**
1. **Distribuição de leads por temperatura** — pizza/barra mostrando quente/morno/frio
2. **Leads em risco** — ciclos sem atividade há muito tempo
3. **Objeções mais comuns** — ranking das objeções mais detectadas pela IA
4. **Performance por vendedor** — comparativo de vendas, leads e conversão
5. **Timeline de vendas** — evolução de vendas ao longo do tempo
6. **Conversão mensal** — gráfico de tendência
7. **Métricas pós-venda** — acompanhamento após fechamento
8. **Auto-close** — ciclos fechados automaticamente por inatividade

### 4.6. Dashboard do Vendedor

**O que é:** Painel pessoal do vendedor com seus próprios números.

**Conteúdo:**
- KPIs pessoais (leads ativos, vendas, conversão, tempo de resposta)
- **Prioridades do dia** — leads que precisam de atenção imediata
- Funil de vendas pessoal
- Gráfico de conversão mensal
- Progresso em relação às metas definidas pelo gestor

### 4.7. Alertas

**O que é:** Sistema de notificações automáticas que avisa o vendedor sobre situações importantes.

**Tipos de alerta:**
| Tipo | Descrição | Severidade |
|---|---|---|
| `hot_lead` | Lead classificado como quente pela IA | Alta |
| `open_objection` | Objeção detectada e não tratada | Média |
| `no_response` | Cliente sem resposta há X horas | Alta |
| `stale_cycle` | Ciclo sem atividade há muito tempo | Média |
| `opportunity` | Oportunidade de venda identificada pela IA | Baixa |

**Funcionamento:**
- Alertas são gerados automaticamente pela edge function `calculate-alerts`
- Vendedor vê os alertas na tela dedicada
- Cada alerta tem link direto para a conversa relacionada
- Alertas expiram ou são resolvidos automaticamente

### 4.8. Cliente 360°

**O que é:** Visão consolidada de uma **empresa-cliente** (não de um lead individual). Agrupa todos os compradores, ciclos e interações de uma mesma empresa.

**Hierarquia:**
```
Empresa Cliente (ex: Academia FitMax)
  └── Comprador 1 (João - Gerente)
  │     └── Lead/Customer → Ciclos de venda → Mensagens
  └── Comprador 2 (Maria - Diretora)
        └── Lead/Customer → Ciclos de venda → Mensagens
```

**Informações exibidas:**
- **Header** — Nome da empresa, CNPJ, segmento, notas
- **KPIs consolidados** — Qtd compradores, ciclos totais, vendas ganhas, temperatura média
- **Lista de compradores** — Todos os contatos daquela empresa com status individual
- **Timeline macro** — Integra mensagens, insights, objeções, follow-ups e eventos de todos os compradores
- **Ciclos de venda** — Histórico completo de todos os ciclos (pendentes + encerrados)
- **Objeções recorrentes** — Análise das objeções mais comuns naquela empresa
- **Tendências de emoção/temperatura** — Evolução ao longo do tempo
- **Financeiro** — Histórico de vendas e valores
- **Resumo IA** — Resumo estratégico gerado por IA sobre o relacionamento com a empresa

**Quem acessa:**
- **Gestor** — Vê tudo de todos os compradores
- **Vendedor** — Vê apenas dados dos compradores que ele atende

### 4.9. Ciclos de Venda

**O que é:** Cada interação comercial com um lead é organizada em **ciclos**. Um mesmo cliente pode ter múltiplos ciclos ao longo do tempo.

**Tipos de ciclo:**
- `pre_sale` — Fase de prospecção e negociação
- `post_sale` — Pós-venda (recompra, suporte, upsell)

**Status do ciclo:**
```
pending → in_progress → won (venda ganha)
                      → lost (venda perdida)
                      → closed (fechado automaticamente)
                      → relocated (lead reatribuído)
```

**Informações do ciclo:**
- Data de início (primeira mensagem)
- Data de encerramento
- Vendedor responsável
- Status final
- Resumo da venda (se ganho)
- Motivo da perda (se perdido) — com análise de IA via `loss-reason`
- Última atividade

**Regra importante:** Quando um ciclo é encerrado (ganho ou perdido), um **novo ciclo** pode ser aberto automaticamente se o cliente enviar novas mensagens.

### 4.10. Gestão de Vendedores

**O que é:** Módulo para o gestor administrar sua equipe de vendedores.

**Funcionalidades:**
- **Criar vendedor** — Nome, email, senha temporária. O sistema envia email de boas-vindas
- **Ativar/Desativar** — Vendedores desativados não conseguem logar
- **Editar dados** — Nome, email
- **Reenviar convite** — Reenviar email de boas-vindas
- **Limites por plano** — Cada plano tem um número máximo de vendedores

**Restrições:**
- Ao criar vendedor, verifica se o limite do plano foi atingido
- Se atingiu, mostra modal de upgrade de plano
- Vendedor desativado mantém seus leads e histórico

### 4.11. Metas e Gamificação

**O que é:** Sistema de metas configuráveis + gamificação com pontos e badges para motivar vendedores.

**Metas:**
- Gestor define metas com: tipo (vendas, leads, conversão), período (semanal/mensal/trimestral), valor alvo
- Cada vendedor tem progresso individual em relação à meta
- Status da meta: `active`, `completed`, `failed`

**Gamificação:**
- **Pontos** — Vendedores ganham pontos por ações (venda fechada, lead quente convertido, resposta rápida)
- **Badges** — Conquistas especiais (ex: "Closer Master", "Resposta Relâmpago", "Rei do Mês")
- **Leaderboard** — Ranking semanal e mensal dos vendedores com mais pontos
- Edge function `award-points` calcula e distribui pontos automaticamente
- Edge function `calculate-gamification` atualiza rankings

### 4.12. Follow-ups Automáticos

**O que é:** Mensagens automáticas enviadas quando o cliente não responde há um período configurável.

**Como funciona:**
1. Gestor ativa follow-ups nas **Configurações da Empresa**
2. Define o **tempo de espera** (ex: 24h sem resposta)
3. A IA gera uma mensagem de follow-up personalizada baseada no contexto da conversa
4. A mensagem é enviada automaticamente via WhatsApp
5. Cada vendedor pode ter follow-ups habilitados/desabilitados individualmente

**Controles:**
- Habilitação global (empresa) + individual (vendedor)
- Configuração de delay (horas)
- Edge function `generate-followups` gera o conteúdo
- Apenas funciona se o plano da empresa permitir (feature `canUseFollowups`)

### 4.13. Integração WhatsApp

**O que é:** Conexão com a **WhatsApp Cloud API** (API oficial da Meta/Facebook).

**Arquitetura:**
```
WhatsApp do cliente → Meta Cloud API → Webhook Whasense → Processamento
                                                        ↓
Resposta do vendedor → API de envio → Meta Cloud API → WhatsApp do cliente
```

**Configuração (feita pelo gestor):**
1. Cadastrar **Phone Number ID** (número do WhatsApp Business)
2. Cadastrar **WABA ID** (WhatsApp Business Account ID)
3. Inserir **Permanent Token** (token de acesso da Meta)
4. Gerar **Verification Token** (para validação do webhook)
5. Configurar a **URL do webhook** no painel da Meta

**Webhook global:**
- Existe um **ÚNICO webhook** para toda a plataforma Whasense
- O webhook identifica qual empresa é dona do número que recebeu a mensagem
- Roteia a mensagem para a empresa correta baseado no `phone_number_id` ou `waba_id`

**Tipos de mensagem suportados:**
- Texto, imagem (com caption), áudio, vídeo, documento, sticker, localização, contato compartilhado, botões interativos

### 4.14. Configurações Operacionais

**O que é:** Painel de configurações que o gestor usa para definir regras de operação.

**Opções configuráveis:**
| Configuração | Descrição |
|---|---|
| Método de distribuição | Manual (vendedor puxa) ou automático |
| Puxada livre | Se vendedores podem puxar leads livremente |
| Max leads por vendedor | Limite de leads ativos simultâneos |
| Ordenação do inbox | Como os leads aparecem no Inbox Pai |
| IA após atribuição | Se a IA analisa apenas após lead ser atribuído |
| Gestor pode reatribuir | Se o gestor pode mover leads entre vendedores |
| Gestor pode mover leads | Se o gestor pode transferir leads |
| Notificar perda | Se o gestor é notificado quando um lead é perdido |
| Aprovação obrigatória | Se ações precisam de aprovação do gestor |

### 4.15. Financeiro / Planos

**O que é:** Sistema de planos, assinaturas e pagamentos integrado com Stripe.

**Planos disponíveis:**

| Plano | Preço Mensal | Vendedores | Funcionalidades |
|---|---|---|---|
| Free/Trial | R$ 0 | 1 | Básico (limitado no tempo) |
| Starter | R$ X | 3 | Dashboard básico |
| Pro | R$ X | 10 | + Gamificação |
| Premium | R$ X | 25 | + Follow-ups automáticos |
| Enterprise | R$ X | Ilimitado | + Cliente 360° + tudo |

**Funcionalidades bloqueadas por plano:**
- `canAccessFullDashboard` — Dashboard completo (a partir do Starter)
- `canUseGamification` — Metas e gamificação (a partir do Pro)
- `canUseFollowups` — Follow-ups automáticos (a partir do Premium)
- `canAccess360` — Cliente 360° (apenas Enterprise)

**Fluxo de pagamento:**
1. Gestor acessa página de planos
2. Seleciona plano (mensal ou anual)
3. Redirecionado para **Stripe Checkout**
4. Após pagamento, webhook do Stripe atualiza o plano no sistema
5. Gestor pode gerenciar assinatura no **Stripe Customer Portal**

**Controles financeiros:**
- Verificação periódica de status da assinatura (`check-subscription`)
- Bloqueio de funcionalidades se inadimplente
- Expiração automática de trials (`expire-free-trials`)
- Histórico de pagamentos armazenado (`payment_history`)

### 4.16. Histórico de Ciclos

**O que é:** Tela que lista todos os ciclos de venda encerrados (ganhos + perdidos + fechados).

**Informações:**
- Cliente, vendedor, tipo de ciclo
- Data de início e encerramento
- Status final
- Resumo ou motivo de perda
- Modal com detalhes completos ao clicar

**Filtros:** Por período, por vendedor, por status, por tipo

### 4.17. Painel Administrativo (Admin Whasense)

**O que é:** Painel exclusivo da equipe Whasense para operar a plataforma.

**Sub-módulos:**

| Módulo | Descrição |
|---|---|
| **Dashboard Admin** | KPIs globais: empresas ativas, MRR, total de leads, uso do sistema |
| **Empresas** | Lista de todas as empresas clientes com status, plano, vendedores |
| **Detalhes da Empresa** | Visão completa de uma empresa específica |
| **Gestores** | Lista de todos os gestores de todas as empresas |
| **Scripts de IA** | Configuração dos prompts e regras da IA (persona, tom, playbook) |
| **Planos** | CRUD de planos com preços, limites e features |
| **Monitor** | Monitoramento em tempo real de filas e processamento |
| **Saúde do Sistema** | Métricas de infraestrutura, erros, latência |
| **Pagamentos** | Histórico de pagamentos de todas as empresas |
| **Webhook** | Configuração e monitoramento de webhooks |
| **Tutorial WhatsApp** | Gestão dos vídeos tutoriais para clientes |

---

## 5. Regras de Negócio

### 5.1. Ciclo de Vida de um Lead

```
1. Cliente envia mensagem no WhatsApp
2. Meta Cloud API dispara webhook para Whasense
3. Webhook identifica a empresa pelo número
4. Se lead novo: cria customer + ciclo → vai para Inbox Pai
5. Se lead existente: associa ao customer e ciclo existente
6. Vendedor puxa lead do Inbox Pai
7. IA começa a analisar mensagens (após atribuição)
8. Vendedor conversa com o cliente
9. IA gera insights em tempo real (temperatura, sentimento, objeções)
10. Vendedor registra venda (ganho) ou perda
11. Ciclo é encerrado
12. Se cliente voltar a enviar mensagem, novo ciclo é aberto
```

### 5.2. Controle de Acesso por Plano

O sistema usa um componente chamado **PlanGate** que verifica se a empresa tem acesso a determinada funcionalidade baseado no plano contratado:

- Se tem acesso → mostra o conteúdo normalmente
- Se não tem acesso → mostra modal de upgrade com o plano necessário

Isso garante que funcionalidades premium não sejam acessadas sem pagamento, mas o usuário sempre sabe o que está perdendo.

### 5.3. Multi-Tenancy

Cada empresa cliente é completamente isolada das demais:

- Toda tabela possui `company_id` para identificar a empresa
- Políticas de segurança (RLS) garantem que nenhum dado vaze entre empresas
- Um vendedor da Empresa A **jamais** vê dados da Empresa B
- O admin Whasense é o único que acessa dados de todas as empresas

### 5.4. Processamento Assíncrono

Para suportar alto volume (10.000+ mensagens/dia):

- Mensagens não são analisadas em tempo real pelo webhook (seria lento demais)
- São enfileiradas na `processing_queue` com prioridade
- Um processador (`queue-processor`) consome a fila em lotes
- Cada item tem até 3 tentativas antes de ser marcado como falha
- Empresas com planos maiores têm **prioridade** na fila

---

## 6. Integrações Externas

### 6.1. WhatsApp Cloud API (Meta)

- **Finalidade:** Receber e enviar mensagens de WhatsApp
- **Tipo:** API REST + Webhooks
- **Dados necessários:** Phone Number ID, WABA ID, Access Token
- **Webhook:** Único endpoint global que roteia para a empresa correta

### 6.2. Stripe

- **Finalidade:** Pagamentos, assinaturas e gestão financeira
- **Funcionalidades:** Checkout, Customer Portal, Webhooks de pagamento
- **Eventos monitorados:** Pagamento confirmado, assinatura cancelada, trial expirado

### 6.3. Inteligência Artificial (Gemini / GPT)

- **Finalidade:** Análise de mensagens, geração de sugestões, follow-ups
- **Modelos utilizados:** Google Gemini 2.5 Flash, OpenAI GPT-5 Mini
- **Uso:** Análise de texto, áudio (transcrição + análise), imagem, geração de follow-ups, resumos 360°

### 6.4. Resend

- **Finalidade:** Envio de emails transacionais
- **Uso:** Email de boas-vindas para vendedores, confirmação de conta, reset de senha

---

## 7. Funções de Backend (Edge Functions)

O sistema possui **35+ funções serverless** que executam a lógica de negócio:

### Análise e IA
| Função | Descrição |
|---|---|
| `analyze-message` | Analisa uma mensagem de texto com IA |
| `analyze-audio` | Transcreve e analisa áudio |
| `analyze-image` | Analisa imagem enviada pelo cliente |
| `enqueue-analysis` | Enfileira mensagem para análise assíncrona |
| `queue-processor` | Processa a fila de análises pendentes |
| `client-360-summary` | Gera resumo IA do relacionamento com cliente |
| `loss-reason` | Analisa motivo de perda de venda |
| `manager-insights` | Gera insights gerenciais por IA |
| `seller-performance-insights` | Análise de performance individual |

### WhatsApp
| Função | Descrição |
|---|---|
| `whatsapp-cloud-webhook` | Webhook global que recebe mensagens da Meta |
| `whatsapp-cloud-connect` | Conecta empresa ao WhatsApp Cloud API |
| `whatsapp-cloud-send` | Envia mensagem via WhatsApp Cloud API |
| `whatsapp-webhook` | Webhook alternativo (legado) |
| `whatsapp-session` | Gerencia sessões WhatsApp |
| `whatsapp-manager` | Operações administrativas de WhatsApp |

### Gestão de Usuários
| Função | Descrição |
|---|---|
| `create-seller` | Cria conta de vendedor + envia email |
| `send-seller-welcome` | Envia email de boas-vindas |
| `resend-seller-welcome` | Reenvia convite |
| `update-seller-email` | Atualiza email do vendedor |
| `create-admin` | Cria conta de admin |
| `update-admin-credentials` | Atualiza credenciais do admin |
| `force-update-email` | Força atualização de email |

### Vendas e Ciclos
| Função | Descrição |
|---|---|
| `register-sale` | Registra venda (ganho/perda) e fecha ciclo |
| `pull-lead` | Vendedor puxa lead do Inbox Pai |
| `link-customer-client` | Vincula lead a um cliente 360° |
| `list-conversations` | Lista conversas do vendedor |
| `list-inbox-pai` | Lista leads do Inbox Pai |
| `conversation-history` | Retorna histórico de mensagens |

### Automação
| Função | Descrição |
|---|---|
| `auto-close-cycles` | Fecha ciclos inativos automaticamente |
| `auto-simulate` | Simula interações para testes |
| `generate-followups` | Gera mensagens de follow-up por IA |
| `calculate-alerts` | Calcula e cria alertas automáticos |
| `calculate-gamification` | Atualiza pontos e rankings |
| `award-points` | Distribui pontos por ações |
| `aggregate-analytics` | Agrega métricas diárias |

### Financeiro
| Função | Descrição |
|---|---|
| `create-checkout` | Cria sessão de checkout Stripe |
| `create-trial-checkout` | Cria checkout para trial |
| `check-subscription` | Verifica status da assinatura |
| `customer-portal` | Redireciona para portal do Stripe |
| `stripe-webhook` | Recebe eventos do Stripe |
| `expire-free-trials` | Expira trials vencidos |

### Admin
| Função | Descrição |
|---|---|
| `admin-operations` | Operações administrativas diversas |
| `ai-scripts` | CRUD de scripts de IA |
| `seed-demo-data` | Popula dados de demonstração |

---

## 8. Modelo de Dados

### Diagrama de Relações (Simplificado)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   plans      │────▶│  companies   │────▶│  profiles    │
│ (planos)     │     │ (empresas)   │     │ (usuários)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │                      │
                    ┌──────┴───────┐              │
                    │              │              │
              ┌─────▼────┐  ┌─────▼────┐   ┌─────▼────┐
              │ clients  │  │customers │   │user_roles│
              │(empresas │  │ (leads)  │   │ (papéis) │
              │ clientes)│  └────┬─────┘   └──────────┘
              └────┬─────┘       │
                   │        ┌────┴─────┐
              ┌────▼────┐   │          │
              │ buyers  │   │  ┌───────▼──────┐
              │(contatos│   │  │  sale_cycles  │
              │ pessoas)│   │  │ (ciclos venda)│
              └─────────┘   │  └───────────────┘
                            │
                     ┌──────▼──────┐
                     │  messages   │───▶┌──────────┐
                     │ (mensagens) │    │ insights │
                     └─────────────┘    │ (IA)     │
                                        └──────────┘
```

### Tabelas Principais

| Tabela | Descrição | Registros típicos |
|---|---|---|
| `companies` | Empresas clientes do Whasense | 1 por empresa |
| `profiles` | Usuários (gestores + vendedores) | N por empresa |
| `user_roles` | Papéis dos usuários (seller/manager/admin) | 1 por usuário |
| `plans` | Planos de assinatura | 5 globais |
| `customers` | Leads/clientes (quem envia mensagem) | Milhares por empresa |
| `clients` | Empresas-clientes (para 360°) | Dezenas por empresa |
| `buyers` | Compradores individuais dentro de clients | N por client |
| `messages` | Mensagens do WhatsApp | Milhões global |
| `insights` | Análises de IA por mensagem | 1 por mensagem |
| `sale_cycles` | Ciclos de venda | N por customer |
| `sales` | Registro final de venda (ganho/perda) | N por empresa |
| `alerts` | Alertas automáticos | N por vendedor |
| `goals` | Metas definidas pelo gestor | N por empresa |
| `goal_vendors` | Progresso de vendedores em metas | N por meta |
| `gamification_points` | Pontos ganhos | N por vendedor |
| `achievements` | Badges conquistados | N por vendedor |
| `leaderboard` | Ranking por período | N por empresa |
| `company_settings` | Configurações da empresa | 1 por empresa |
| `company_whatsapp_settings` | Config WhatsApp | 1 por empresa |
| `company_subscriptions` | Assinatura ativa | 1 por empresa |
| `company_limits` | Limites de uso (rate limiting) | 1 por empresa |
| `processing_queue` | Fila de processamento IA | Variável |
| `analytics_daily_company` | Métricas diárias empresa | 1 por dia |
| `analytics_daily_seller` | Métricas diárias vendedor | 1 por dia por vendedor |
| `ai_scripts` | Scripts de IA por empresa | 1 por empresa |
| `default_ai_script` | Script de IA padrão global | 1 global |
| `payment_history` | Histórico de pagamentos | N por empresa |

---

## 9. Fluxo de Onboarding

### Passo a passo: Do zero até vendedores atendendo

```
1. TRIAL
   └── Gestor acessa a landing page e clica "Começar Trial"
   
2. CADASTRO
   └── Preenche: nome, email, senha, nome da empresa
   └── Recebe email de confirmação
   
3. PRIMEIRO ACESSO
   └── Logado automaticamente como Gestor
   └── Vê banner de trial com dias restantes
   
4. CONFIGURAR WHATSAPP
   └── Acessa Configurações > WhatsApp
   └── Insere tokens da Meta (Phone Number ID, WABA ID, Token)
   └── Configura webhook no painel da Meta
   └── Testa conexão
   
5. CRIAR VENDEDORES
   └── Acessa menu Vendedores
   └── Cria vendedores com nome e email
   └── Vendedores recebem email de boas-vindas com senha temporária
   
6. CONFIGURAR OPERAÇÃO
   └── Define regras de distribuição (livre vs controlada)
   └── Define limites por vendedor
   └── Habilita/desabilita follow-ups
   
7. PRIMEIROS LEADS
   └── Clientes enviam mensagens no WhatsApp
   └── Leads aparecem no Inbox Pai
   └── Vendedores puxam leads
   └── IA começa a analisar
   
8. UPGRADE
   └── Trial expira após X dias
   └── Gestor escolhe plano pago
   └── Pagamento via Stripe
   └── Funcionalidades premium desbloqueadas
```

---

## 10. Planos e Monetização

### Estrutura de Planos

| | Free/Trial | Starter | Pro | Premium | Enterprise |
|---|---|---|---|---|---|
| **Vendedores** | 1 | 3 | 10 | 25 | Ilimitado |
| **Dashboard completo** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Gamificação** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Follow-ups IA** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Cliente 360°** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Preço mensal** | R$ 0 | R$ X | R$ X | R$ X | R$ X |
| **Preço anual** | - | R$ X | R$ X | R$ X | R$ X |

### Modelo de Receita

- **Recorrência mensal (MRR)** — Principal fonte de receita
- **Planos anuais** — Desconto para compromisso anual (melhora retenção)
- **Upsell natural** — Empresas crescem e precisam de mais vendedores/funcionalidades
- **Trial como porta de entrada** — Gestor testa gratuitamente antes de pagar

---

## 11. Segurança e Multi-Tenancy

### Isolamento de Dados

- **Row Level Security (RLS):** Cada tabela tem políticas que garantem que um usuário só vê dados da sua empresa
- **company_id obrigatório:** Toda query filtra automaticamente pela empresa do usuário logado
- **Roles separadas:** Papéis de usuário são armazenados em tabela separada (`user_roles`), não no perfil
- **Security Definer Functions:** Funções especiais que verificam permissões sem criar loops recursivos

### Autenticação

- Login por email + senha
- Verificação de email obrigatória (não usa auto-confirm)
- Recuperação de senha por email
- Sessões gerenciadas por tokens JWT
- Admin tem login separado

### Proteções Adicionais

- Rate limiting por empresa (`company_limits`)
- Throttling em caso de uso abusivo
- Tokens de API nunca expostos no frontend
- Webhook com verificação de token

---

## 12. Métricas de Negócio (Admin)

O painel admin fornece as seguintes métricas de negócio:

### Financeiras
- **MRR (Monthly Recurring Revenue)** — Receita recorrente mensal
- **ARR (Annual Recurring Revenue)** — MRR × 12
- **Churn rate** — Taxa de cancelamento de assinaturas
- **Inadimplência** — Empresas com pagamento atrasado
- **Receita por plano** — Distribuição de receita por tipo de plano

### Operacionais
- **Empresas ativas** — Total de empresas usando o sistema
- **Total de vendedores** — Soma de todos os vendedores de todas as empresas
- **Total de leads processados** — Volume de leads na plataforma
- **Mensagens/dia** — Volume de mensagens processadas diariamente
- **Análises de IA/dia** — Volume de processamento de IA
- **Tempo médio na fila** — Latência do processamento

### Saúde do Sistema
- **Uptime** — Disponibilidade do sistema
- **Erros na fila** — Items que falharam no processamento
- **Tamanho da fila** — Backlog de processamento
- **Latência média** — Tempo de resposta das edge functions

---

## 13. Stack Tecnológica

### Frontend
- **React 18** com TypeScript
- **Vite** (build tool)
- **Tailwind CSS** (estilização)
- **shadcn/ui** (componentes de interface)
- **TanStack React Query** (gerenciamento de estado e cache)
- **Recharts** (gráficos e visualizações)
- **React Router** (navegação)

### Backend
- **Supabase** (PostgreSQL + Auth + Realtime + Storage)
- **Edge Functions** (Deno/TypeScript — lógica serverless)
- **Row Level Security** (segurança a nível de banco)

### Integrações
- **WhatsApp Cloud API** (Meta)
- **Stripe** (pagamentos)
- **Google Gemini / OpenAI GPT** (inteligência artificial)
- **Resend** (emails transacionais)

### Infraestrutura
- Hospedagem: **Lovable Cloud**
- Banco de dados: **PostgreSQL** (via Supabase)
- CDN e deploy: Automático via Lovable
- Edge Functions: Deploy automático

---

## 14. Glossário

| Termo | Significado |
|---|---|
| **Lead** | Potencial cliente que enviou mensagem pelo WhatsApp |
| **Customer** | Registro de um lead no sistema (tabela `customers`) |
| **Client** | Empresa-cliente (para visão 360°) |
| **Buyer** | Pessoa individual dentro de um Client |
| **Ciclo de venda** | Uma tentativa de venda com início e fim |
| **Inbox Pai** | Fila central de leads não atribuídos |
| **Temperatura** | Classificação do lead pela IA (quente/morno/frio) |
| **Insight** | Análise gerada pela IA para uma mensagem |
| **Follow-up** | Mensagem automática de acompanhamento |
| **RLS** | Row Level Security — política de acesso a nível de linha no banco |
| **Edge Function** | Função serverless que executa lógica no backend |
| **Webhook** | URL que recebe notificações automáticas de sistemas externos |
| **MRR** | Monthly Recurring Revenue — receita recorrente mensal |
| **ARR** | Annual Recurring Revenue — receita recorrente anual |
| **SaaS** | Software as a Service — software vendido como assinatura |
| **Multi-tenant** | Arquitetura onde múltiplas empresas compartilham a mesma infraestrutura |
| **WABA** | WhatsApp Business Account |
| **PlanGate** | Componente que bloqueia funcionalidades por plano |
| **Gamificação** | Sistema de pontos, badges e ranking para engajar vendedores |

---

> **Documento gerado em Março/2026**  
> **Whasense — Inteligência em Vendas via WhatsApp**
