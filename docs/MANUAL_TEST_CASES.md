# Casos de Teste Manual - Whasense

## Índice
1. [Autenticação](#1-autenticação)
2. [Conversas](#2-conversas)
3. [Ciclos de Venda](#3-ciclos-de-venda)
4. [Dashboard](#4-dashboard)
5. [Gestão de Vendedores](#5-gestão-de-vendedores)
6. [Planos e Pagamentos](#6-planos-e-pagamentos)

---

## 1. Autenticação

### 1.1 Login de Vendedor
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Vendedor cadastrado com empresa ativa |

**Passos:**
1. Acessar `/` (página inicial)
2. Inserir email válido do vendedor
3. Inserir senha correta
4. Clicar em "Entrar"

**Resultado Esperado:**
- Redirecionamento para `/conversas`
- Toast de sucesso exibido
- Sidebar mostra menu de vendedor (Conversas, Meu Dashboard, Alertas)

---

### 1.2 Login de Gestor
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-002 |
| **Prioridade** | Alta |
| **Pré-condições** | Gestor cadastrado com empresa ativa |

**Passos:**
1. Acessar `/`
2. Inserir email do gestor
3. Inserir senha correta
4. Clicar em "Entrar"

**Resultado Esperado:**
- Redirecionamento para `/dashboard`
- Sidebar mostra menu de gestor (Dashboard, Conversas, Vendedores, etc.)

---

### 1.3 Login com Empresa Inativa
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-003 |
| **Prioridade** | Alta |
| **Pré-condições** | Usuário com empresa marcada como `is_active = false` |

**Passos:**
1. Acessar `/`
2. Inserir credenciais válidas
3. Clicar em "Entrar"

**Resultado Esperado:**
- Vendedor: Login bloqueado, mensagem de erro
- Gestor: Redirecionamento para `/financeiro` com acesso restrito

---

### 1.4 Login com Limite de Vendedores Excedido
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-004 |
| **Prioridade** | Alta |
| **Pré-condições** | Empresa com mais vendedores ativos que o plano permite |

**Passos:**
1. Vendedor tenta login
2. Gestor tenta login

**Resultado Esperado:**
- Vendedor: Login bloqueado
- Gestor: Login permitido, modal de aviso exibido, sidebar restrita

---

### 1.5 Login Admin Whasense
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-005 |
| **Prioridade** | Alta |
| **Pré-condições** | Admin cadastrado com role `admin` |

**Passos:**
1. Acessar `/admin/login`
2. Inserir credenciais de admin
3. Clicar em "Entrar"

**Resultado Esperado:**
- Redirecionamento para `/admin/dashboard`
- Acesso completo ao painel administrativo

---

### 1.6 Esqueci Minha Senha
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-006 |
| **Prioridade** | Média |
| **Pré-condições** | Email cadastrado no sistema |

**Passos:**
1. Acessar `/`
2. Clicar em "Esqueci minha senha"
3. Inserir email cadastrado
4. Clicar em "Enviar link"

**Resultado Esperado:**
- Toast de sucesso informando envio do email
- Email recebido com link de recuperação

---

### 1.7 Redefinir Senha
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-007 |
| **Prioridade** | Média |
| **Pré-condições** | Link de recuperação válido recebido por email |

**Passos:**
1. Clicar no link do email
2. Inserir nova senha (mín. 6 caracteres)
3. Confirmar nova senha
4. Clicar em "Redefinir senha"

**Resultado Esperado:**
- Toast de sucesso
- Redirecionamento automático para página inicial do role

---

### 1.8 Troca de Senha Obrigatória (Primeiro Acesso)
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-008 |
| **Prioridade** | Alta |
| **Pré-condições** | Usuário com `requires_password_change = true` |

**Passos:**
1. Fazer login com credenciais temporárias
2. Sistema redireciona para `/alterar-senha`

**Resultado Esperado:**
- Página de alteração obrigatória exibida
- Após alterar, redirecionamento para página principal

---

### 1.9 Logout
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-009 |
| **Prioridade** | Alta |
| **Pré-condições** | Usuário logado |

**Passos:**
1. Clicar no botão de logout na sidebar
2. Confirmar logout

**Resultado Esperado:**
- Redirecionamento para `/`
- Sessão encerrada
- Cache limpo

---

### 1.10 Tentativa de Login com Credenciais Inválidas
| Campo | Valor |
|-------|-------|
| **ID** | AUTH-010 |
| **Prioridade** | Alta |
| **Pré-condições** | Nenhuma |

**Passos:**
1. Acessar `/`
2. Inserir email inexistente ou senha incorreta
3. Clicar em "Entrar"

**Resultado Esperado:**
- Mensagem de erro genérica (sem revelar se email existe)
- Permanece na página de login

---

## 2. Conversas

### 2.1 Listar Conversas Pendentes
| Campo | Valor |
|-------|-------|
| **ID** | CONV-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Vendedor logado com conversas em andamento |

**Passos:**
1. Acessar `/conversas`
2. Verificar aba "Pendente" selecionada

**Resultado Esperado:**
- Lista de conversas com status `pending` ou `in_progress`
- Cards mostram: nome, última mensagem, temperatura, sentimento
- Indicadores de alerta visíveis (mensagens não respondidas, leads quentes)

---

### 2.2 Listar Conversas Concluídas
| Campo | Valor |
|-------|-------|
| **ID** | CONV-002 |
| **Prioridade** | Média |
| **Pré-condições** | Vendedor com vendas ganhas/perdidas |

**Passos:**
1. Acessar `/conversas`
2. Clicar na aba "Concluída"

**Resultado Esperado:**
- Lista de conversas com status `won` ou `lost`
- Badge de status visível (verde para ganho, vermelho para perdido)
- Sem indicadores de alerta

---

### 2.3 Listar Conversas Pós-Venda
| Campo | Valor |
|-------|-------|
| **ID** | CONV-003 |
| **Prioridade** | Média |
| **Pré-condições** | Ciclos marcados como pós-venda existem |

**Passos:**
1. Acessar `/conversas`
2. Clicar na aba "Pós-venda"

**Resultado Esperado:**
- Lista de ciclos com `cycle_type = post_sale`
- Sem métricas de conversão aplicadas

---

### 2.4 Buscar Conversas
| Campo | Valor |
|-------|-------|
| **ID** | CONV-004 |
| **Prioridade** | Média |
| **Pré-condições** | Conversas existentes |

**Passos:**
1. Acessar `/conversas`
2. Digitar nome ou telefone no campo de busca

**Resultado Esperado:**
- Lista filtrada em tempo real
- Resultados correspondem ao termo buscado

---

### 2.5 Abrir Chat de Conversa
| Campo | Valor |
|-------|-------|
| **ID** | CONV-005 |
| **Prioridade** | Alta |
| **Pré-condições** | Conversa existente |

**Passos:**
1. Clicar em um card de conversa na lista

**Resultado Esperado:**
- Redirecionamento para `/chat/:conversationId`
- Histórico de mensagens carregado
- Painel de insights AI visível (para vendedor)

---

### 2.6 Enviar Mensagem de Texto
| Campo | Valor |
|-------|-------|
| **ID** | CONV-006 |
| **Prioridade** | Alta |
| **Pré-condições** | Chat aberto |

**Passos:**
1. Digitar mensagem no campo de texto
2. Clicar no botão "Enviar"

**Resultado Esperado:**
- Mensagem aparece no chat como `outgoing`
- Análise de IA disparada automaticamente
- Timestamp atualizado

---

### 2.7 Enviar Mensagem com Quebra de Linha
| Campo | Valor |
|-------|-------|
| **ID** | CONV-007 |
| **Prioridade** | Baixa |
| **Pré-condições** | Chat aberto |

**Passos:**
1. Digitar texto
2. Pressionar Shift+Enter para nova linha
3. Continuar digitando
4. Clicar em "Enviar"

**Resultado Esperado:**
- Mensagem enviada com múltiplas linhas preservadas
- Enter sozinho NÃO envia a mensagem

---

### 2.8 Enviar Anexo (Imagem)
| Campo | Valor |
|-------|-------|
| **ID** | CONV-008 |
| **Prioridade** | Alta |
| **Pré-condições** | Chat aberto |

**Passos:**
1. Clicar no ícone de anexo
2. Selecionar imagem (jpg, png, webp)
3. Confirmar envio

**Resultado Esperado:**
- Imagem aparece no chat com preview
- Análise de visão AI disparada
- Insights de imagem exibidos no painel

---

### 2.9 Gravar e Enviar Áudio
| Campo | Valor |
|-------|-------|
| **ID** | CONV-009 |
| **Prioridade** | Alta |
| **Pré-condições** | Chat aberto, permissão de microfone |

**Passos:**
1. Clicar no ícone de microfone
2. Gravar áudio (máx. 2 minutos)
3. Clicar em "Parar"
4. Clicar em "Enviar" ou "Descartar"

**Resultado Esperado:**
- Player de áudio aparece no chat
- Transcrição gerada e armazenada
- Análise de sentimento/intenção realizada

---

### 2.10 Visualizar Insights de IA (Vendedor)
| Campo | Valor |
|-------|-------|
| **ID** | CONV-010 |
| **Prioridade** | Alta |
| **Pré-condições** | Chat com mensagens analisadas |

**Passos:**
1. Abrir chat de conversa
2. Verificar painel lateral de insights

**Resultado Esperado:**
- Exibe: sentimento, temperatura, intenção de compra
- Exibe: objeções detectadas, sugestão de resposta
- Exibe: próxima ação recomendada

---

### 2.11 Visualizar Insights de IA (Gestor)
| Campo | Valor |
|-------|-------|
| **ID** | CONV-011 |
| **Prioridade** | Alta |
| **Pré-condições** | Gestor logado, chat aberto |

**Passos:**
1. Acessar `/conversas` como gestor
2. Abrir chat de qualquer vendedor

**Resultado Esperado:**
- Painel mostra: resumo, timeline, objeções críticas
- NÃO mostra: sugestões de resposta, próximas ações
- Nome do vendedor visível no header

---

### 2.12 Vincular Conversa a Cliente Existente
| Campo | Valor |
|-------|-------|
| **ID** | CONV-012 |
| **Prioridade** | Média |
| **Pré-condições** | Lead incompleto (sem cliente vinculado) |

**Passos:**
1. Na lista de conversas, clicar em "Vincular empresa"
2. Selecionar cliente existente ou criar novo
3. Confirmar

**Resultado Esperado:**
- Conversa atualizada com `client_id`
- Buyer criado automaticamente
- Dados disponíveis no Client 360

---

### 2.13 Atualização em Tempo Real
| Campo | Valor |
|-------|-------|
| **ID** | CONV-013 |
| **Prioridade** | Alta |
| **Pré-condições** | Chat aberto em duas sessões |

**Passos:**
1. Abrir chat em navegador A
2. Abrir mesmo chat em navegador B
3. Enviar mensagem de A

**Resultado Esperado:**
- Mensagem aparece em B sem refresh
- Lista de conversas atualizada em ambos

---

## 3. Ciclos de Venda

### 3.1 Registrar Venda Ganha
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Conversa com ciclo em andamento |

**Passos:**
1. Abrir chat da conversa
2. Clicar em "Registrar venda"
3. Selecionar "Ganha"
4. Preencher resumo/valor (opcional)
5. Confirmar

**Resultado Esperado:**
- Ciclo atualizado para `status = won`
- Conversa movida para aba "Concluída"
- Dashboard atualizado com nova venda
- Alertas removidos

---

### 3.2 Registrar Venda Perdida
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-002 |
| **Prioridade** | Alta |
| **Pré-condições** | Conversa com ciclo em andamento |

**Passos:**
1. Abrir chat da conversa
2. Clicar em "Registrar venda"
3. Selecionar "Perdida"
4. Informar motivo da perda
5. Confirmar

**Resultado Esperado:**
- Ciclo atualizado para `status = lost`
- Motivo armazenado em `lost_reason`
- IA analisa motivo para categorização

---

### 3.3 Gestor Edita Status de Venda
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-003 |
| **Prioridade** | Média |
| **Pré-condições** | Gestor logado, venda registrada pelo vendedor |

**Passos:**
1. Acessar `/historico` ou ciclo específico
2. Clicar em "Editar"
3. Alterar status ou motivo
4. Salvar

**Resultado Esperado:**
- Status atualizado
- Vendedor NÃO consegue editar (apenas visualiza)

---

### 3.4 Novo Ciclo para Lead Recontactado
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-004 |
| **Prioridade** | Alta |
| **Pré-condições** | Lead com ciclo fechado (won/lost) |

**Passos:**
1. Lead envia nova mensagem (simulado ou real)

**Resultado Esperado:**
- Novo ciclo criado automaticamente
- Histórico do ciclo anterior preservado
- Conversa reaparece na aba "Pendente"

---

### 3.5 Marcar Ciclo como Pós-Venda
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-005 |
| **Prioridade** | Média |
| **Pré-condições** | Ciclo em andamento |

**Passos:**
1. Abrir chat
2. Clicar em opções do ciclo
3. Selecionar "Marcar como pós-venda"

**Resultado Esperado:**
- Ciclo atualizado para `cycle_type = post_sale`
- Conversa movida para aba "Pós-venda"
- IA ajusta comportamento para suporte

---

### 3.6 Visualizar Histórico de Ciclos
| Campo | Valor |
|-------|-------|
| **ID** | CYCLE-006 |
| **Prioridade** | Média |
| **Pré-condições** | Cliente com múltiplos ciclos |

**Passos:**
1. Acessar `/historico` ou Client 360
2. Selecionar cliente
3. Visualizar lista de ciclos

**Resultado Esperado:**
- Todos os ciclos listados cronologicamente
- Status, datas, resumos visíveis
- Possibilidade de expandir detalhes

---

## 4. Dashboard

### 4.1 Dashboard do Gestor - Carregamento
| Campo | Valor |
|-------|-------|
| **ID** | DASH-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Gestor logado |

**Passos:**
1. Acessar `/dashboard`

**Resultado Esperado:**
- KPIs carregam: leads pendentes, em andamento, ganhos, perdidos
- Taxa de conversão calculada corretamente
- Tempo médio de resposta exibido
- Leads quentes em destaque

---

### 4.2 Dashboard do Vendedor - Carregamento
| Campo | Valor |
|-------|-------|
| **ID** | DASH-002 |
| **Prioridade** | Alta |
| **Pré-condições** | Vendedor logado |

**Passos:**
1. Acessar `/dashboard-vendedor`

**Resultado Esperado:**
- KPIs pessoais: meus leads, minhas vendas
- Lista de prioridades do dia
- Ciclos em risco (>24h sem atividade)
- Funil de vendas por estágio AI

---

### 4.3 Atualização em Tempo Real do Dashboard
| Campo | Valor |
|-------|-------|
| **ID** | DASH-003 |
| **Prioridade** | Alta |
| **Pré-condições** | Dashboard aberto |

**Passos:**
1. Abrir dashboard
2. Em outra aba, registrar uma venda
3. Voltar ao dashboard

**Resultado Esperado:**
- Métricas atualizadas automaticamente (sem refresh)
- Venda aparece na lista de vendas recentes

---

### 4.4 Filtros de Período
| Campo | Valor |
|-------|-------|
| **ID** | DASH-004 |
| **Prioridade** | Média |
| **Pré-condições** | Dados em diferentes períodos |

**Passos:**
1. No dashboard, alterar filtro de período
2. Selecionar: Hoje, Esta semana, Este mês, Personalizado

**Resultado Esperado:**
- Todas as métricas recalculadas para o período
- Gráficos atualizados

---

### 4.5 Comparativo de Vendedores (Gestor)
| Campo | Valor |
|-------|-------|
| **ID** | DASH-005 |
| **Prioridade** | Média |
| **Pré-condições** | Empresa com múltiplos vendedores |

**Passos:**
1. Acessar dashboard do gestor
2. Visualizar seção de performance dos vendedores

**Resultado Esperado:**
- Ranking de vendedores por vendas
- Gráfico comparativo de conversão
- Tempo de resposta por vendedor

---

## 5. Gestão de Vendedores

### 5.1 Criar Novo Vendedor
| Campo | Valor |
|-------|-------|
| **ID** | SELL-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Gestor logado, limite não atingido |

**Passos:**
1. Acessar `/gestor/vendedores`
2. Clicar em "Novo vendedor"
3. Preencher: nome, email, senha temporária
4. Confirmar

**Resultado Esperado:**
- Vendedor criado com `role = seller`
- Email de boas-vindas enviado
- `requires_password_change = true`
- Contador de vendedores atualizado

---

### 5.2 Criar Vendedor com Limite Atingido
| Campo | Valor |
|-------|-------|
| **ID** | SELL-002 |
| **Prioridade** | Alta |
| **Pré-condições** | Empresa no limite de vendedores do plano |

**Passos:**
1. Acessar `/gestor/vendedores`
2. Tentar criar novo vendedor

**Resultado Esperado:**
- Botão "Novo vendedor" desabilitado
- Mensagem indicando limite atingido
- Link para upgrade de plano

---

### 5.3 Editar Vendedor
| Campo | Valor |
|-------|-------|
| **ID** | SELL-003 |
| **Prioridade** | Média |
| **Pré-condições** | Vendedor existente |

**Passos:**
1. Acessar `/gestor/vendedores`
2. Clicar em "Editar" no vendedor
3. Alterar nome ou email
4. Salvar

**Resultado Esperado:**
- Dados atualizados
- Se email alterado, verificação enviada

---

### 5.4 Desativar Vendedor
| Campo | Valor |
|-------|-------|
| **ID** | SELL-004 |
| **Prioridade** | Alta |
| **Pré-condições** | Vendedor ativo |

**Passos:**
1. Acessar `/gestor/vendedores`
2. Toggle de status para "Inativo"

**Resultado Esperado:**
- `is_active = false` no profile
- Vendedor perde acesso ao login
- Dados históricos preservados
- Contador de ativos decrementado

---

### 5.5 Reativar Vendedor
| Campo | Valor |
|-------|-------|
| **ID** | SELL-005 |
| **Prioridade** | Média |
| **Pré-condições** | Vendedor inativo, limite permite |

**Passos:**
1. Toggle de status para "Ativo"

**Resultado Esperado:**
- Se dentro do limite: vendedor reativado
- Se excede limite: erro, ação bloqueada

---

## 6. Planos e Pagamentos

### 6.1 Visualizar Plano Atual
| Campo | Valor |
|-------|-------|
| **ID** | PAY-001 |
| **Prioridade** | Alta |
| **Pré-condições** | Gestor logado |

**Passos:**
1. Acessar `/financeiro`

**Resultado Esperado:**
- Nome do plano atual exibido
- Preço e período de cobrança
- Data do próximo vencimento
- Limite de vendedores e uso atual

---

### 6.2 Upgrade de Plano
| Campo | Valor |
|-------|-------|
| **ID** | PAY-002 |
| **Prioridade** | Alta |
| **Pré-condições** | Plano atual inferior ao Enterprise |

**Passos:**
1. Acessar `/financeiro`
2. Clicar em "Alterar plano"
3. Selecionar plano superior
4. Preencher dados de pagamento (Stripe)
5. Confirmar

**Resultado Esperado:**
- Redirecionamento para Stripe Checkout
- Após sucesso: plano atualizado imediatamente
- Novos limites aplicados

---

### 6.3 Downgrade de Plano
| Campo | Valor |
|-------|-------|
| **ID** | PAY-003 |
| **Prioridade** | Alta |
| **Pré-condições** | Plano atual superior, vendedores dentro do limite do novo |

**Passos:**
1. Acessar `/financeiro`
2. Selecionar plano inferior
3. Confirmar

**Resultado Esperado:**
- Mudança agendada para fim do período atual
- Se vendedores excedem limite: bloqueio até desativar

---

### 6.4 Cancelar Assinatura
| Campo | Valor |
|-------|-------|
| **ID** | PAY-004 |
| **Prioridade** | Alta |
| **Pré-condições** | Assinatura ativa |

**Passos:**
1. Acessar `/financeiro`
2. Clicar em "Cancelar assinatura"
3. Modal exibe instruções de contato via WhatsApp

**Resultado Esperado:**
- Modal com número do suporte exibido
- Link para WhatsApp funcional

---

### 6.5 Free Trial - Período Válido
| Campo | Valor |
|-------|-------|
| **ID** | PAY-005 |
| **Prioridade** | Alta |
| **Pré-condições** | Empresa com Free Trial ativo |

**Passos:**
1. Login como gestor ou vendedor
2. Usar sistema normalmente

**Resultado Esperado:**
- Acesso completo a todas as funcionalidades
- Vendedores ilimitados
- AI funcional

---

### 6.6 Free Trial - Expiração Próxima
| Campo | Valor |
|-------|-------|
| **ID** | PAY-006 |
| **Prioridade** | Alta |
| **Pré-condições** | Free Trial com 1 dia ou menos restante |

**Passos:**
1. Login como gestor

**Resultado Esperado:**
- Modal de aviso exibido automaticamente
- Dias restantes e data de expiração mostrados
- Botão "Escolher plano" leva a `/financeiro`

---

### 6.7 Free Trial - Expirado
| Campo | Valor |
|-------|-------|
| **ID** | PAY-007 |
| **Prioridade** | Alta |
| **Pré-condições** | `free_end_date` passou |

**Passos:**
1. Tentar login como vendedor
2. Tentar login como gestor

**Resultado Esperado:**
- Vendedor: login bloqueado
- Gestor: acesso apenas a `/financeiro`
- AI completamente bloqueada

---

### 6.8 Pagamento Falhou - Período de Graça
| Campo | Valor |
|-------|-------|
| **ID** | PAY-008 |
| **Prioridade** | Alta |
| **Pré-condições** | Invoice não pago, <7 dias de atraso |

**Passos:**
1. Verificar status da assinatura

**Resultado Esperado:**
- Status: `past_due`
- Acesso mantido temporariamente
- Alerta exibido na interface

---

### 6.9 Inadimplência - Acesso Bloqueado
| Campo | Valor |
|-------|-------|
| **ID** | PAY-009 |
| **Prioridade** | Alta |
| **Pré-condições** | Invoice não pago, 7+ dias |

**Passos:**
1. Tentar login

**Resultado Esperado:**
- Status: `inactive_due_payment`
- Comportamento igual a empresa inativa
- Apenas gestor acessa `/financeiro`

---

### 6.10 Reembolso Processado
| Campo | Valor |
|-------|-------|
| **ID** | PAY-010 |
| **Prioridade** | Alta |
| **Pré-condições** | Stripe processa reembolso |

**Passos:**
1. Admin processa reembolso no Stripe
2. Webhook recebido

**Resultado Esperado:**
- Empresa IMEDIATAMENTE marcada como cancelada
- Plano alterado para Inativo
- Acesso bloqueado instantaneamente
- Reembolso registrado no histórico com valor negativo

---

## Checklist de Regressão Rápida

Após cada deploy, executar:

- [ ] AUTH-001: Login vendedor funciona
- [ ] AUTH-002: Login gestor funciona
- [ ] CONV-005: Abrir chat funciona
- [ ] CONV-006: Enviar mensagem funciona
- [ ] CYCLE-001: Registrar venda funciona
- [ ] DASH-001: Dashboard carrega
- [ ] PAY-001: Página financeiro carrega

---

## Ambientes de Teste

| Ambiente | URL | Uso |
|----------|-----|-----|
| Preview | `*.lovableproject.com` | Desenvolvimento |
| Produção | `*.lovable.app` ou custom | Produção |

## Credenciais de Teste

Ver dados de teste disponíveis na página de login (ambiente de desenvolvimento).

---

*Última atualização: 2025-12-10*
