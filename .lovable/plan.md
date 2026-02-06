
# Plano: Criar Base de Demonstração Exercit Esportes

## Objetivo
Criar uma empresa fictícia completa (Exercit Esportes - academia/fitness) com:
- 1 Gestor com credenciais de teste
- 2 Vendedores com credenciais de teste  
- Base de dados rica para popular todos os KPIs do dashboard gerencial
- Trial ativo de 7 dias para apresentar para empresas

## Credenciais de Acesso (Teste)

| Perfil | Email | Senha |
|--------|-------|-------|
| Gestor | gestor@exercit.com | 123456 |
| Vendedor 1 | vendedor1@exercit.com | 123456 |
| Vendedor 2 | vendedor2@exercit.com | 123456 |

## Estrutura Funcional

### 1. Empresa e Usuários
- **Empresa**: Exercit Esportes
  - Segmento: Fitness e Suplementação
  - Plano: Free (Trial 7 dias com todas as funcionalidades)
  - is_active: true
  
- **Gestor**: Carlos Gerente
- **Vendedor 1**: Ana Vendedora  
- **Vendedor 2**: Pedro Vendedor

### 2. Base de Dados Rica (Dashboard Bonito)

Para popular todos os KPIs do dashboard do gestor, serão criados:

**Clientes e Leads (20+ registros)**
- Leads em diferentes status: pending, in_progress, won, lost
- Distribuição equilibrada entre os 2 vendedores
- Leads com temperaturas variadas (hot, warm, cold)

**Ciclos de Venda (25+ registros)**
- 5-6 ciclos pendentes (leads novos)
- 6-8 ciclos em progresso (negociações ativas)
- 8-10 ciclos ganhos (vendas fechadas)
- 4-5 ciclos perdidos (com motivos de perda)

**Mensagens e Conversas (50+ mensagens)**
- Conversas realistas de academia/suplementos
- Mensagens de entrada (cliente) e saída (vendedor)
- Histórico de até 30 dias para timeline

**Insights de IA (30+ registros)**
- Temperaturas: hot, warm, cold
- Sentimentos: positivo, negativo, neutro
- Objeções detectadas: preço, confiança, demora
- Sugestões de resposta

**Vendas Registradas (14+ registros)**
- Mix de ganhas e perdidas
- Motivos de perda variados

**Alertas Ativos (5-8 registros)**
- hot_lead, waiting_response, open_objection
- Severidades: info, warning, critical

### 3. Dados que Populam cada Componente

| Componente Dashboard | Dados Necessários |
|---------------------|-------------------|
| KPI Pendentes | Ciclos status='pending' |
| KPI Em Progresso | Ciclos status='in_progress' |
| KPI Ganhas | Sales status='won' (30 dias) |
| KPI Perdidas | Sales status='lost' (30 dias) |
| KPI Conversão | Cálculo ganhas/(ganhas+perdidas) |
| KPI Tempo Resp. | Diferença mensagens incoming/outgoing |
| KPI Leads Quentes | Insights temperature='hot' |
| Gráfico por Vendedor | Ciclos agrupados por seller_id |
| Gráfico Temperatura | Insights temperature agrupados |
| Ciclos em Risco | Sem resposta >30min ou objeção aberta |
| Objeções | Insights objection + lost_reason |
| Performance Vendedor | Ciclos e sales por vendedor |
| Timeline Vendas | Sales dos últimos 30 dias |
| Vendas Recentes | Últimas sales ordenadas por data |
| Auto-Close Metrics | Ciclos fechados automaticamente |
| Post-Sale Metrics | Ciclos cycle_type='post_sale' |

## Implementacao Tecnica

### Etapa 1: Atualizar Edge Function seed-demo-data

A funcao ja existe em `supabase/functions/seed-demo-data/index.ts`. Sera expandida para incluir:

1. Configurar empresa com plano Free e trial ativo
2. Aumentar quantidade de clientes (20+)
3. Criar ciclos variados com status distribuidos
4. Gerar 50+ mensagens realistas de academia
5. Inserir insights com temperaturas e objecoes
6. Criar registros de sales para timeline
7. Popular alertas ativos
8. Adicionar dados de post-sale e auto-close

### Etapa 2: Estrutura de Dados Expandida

```text
Empresa Exercit
    |
    +-- Gestor (gestor@exercit.com)
    |
    +-- Vendedor 1 (vendedor1@exercit.com)
    |       |-- 10 clientes
    |       |-- 12 ciclos (3 pending, 4 in_progress, 4 won, 1 lost)
    |       |-- 25 mensagens
    |       |-- 15 insights
    |
    +-- Vendedor 2 (vendedor2@exercit.com)
            |-- 10 clientes  
            |-- 13 ciclos (2 pending, 5 in_progress, 4 won, 2 lost)
            |-- 25 mensagens
            |-- 15 insights
```

### Etapa 3: Conversas Realistas de Academia

Exemplos de conversas que serao criadas:

**Lead Quente - Ganho de Massa**
- Cliente: "Preciso de whey e creatina para ganhar massa"
- Vendedor: "Temos o combo ideal! Whey Isolado + Creatina Creapure"
- Cliente: "Qual o preco do combo?"
- Vendedor: "R$189,90 com frete gratis. Parcela em 3x"
- Cliente: "Fechado! Como pago?"

**Lead Morno - Emagrecimento**
- Cliente: "Quero emagrecer, qual termogenico?"
- Vendedor: "Recomendo o Lipo 6 Black, muito eficaz"
- Cliente: "E caro ne... vou pensar"
- (Insight: objecao de preco detectada)

**Lead Frio - Pesquisa**
- Cliente: "Voces tem legging de academia?"
- Vendedor: "Sim! Varios modelos a partir de R$89"
- (Sem resposta ha 2 dias)

## Resultado Esperado

Apos executar o seed, o dashboard do gestor mostrara:

- **7 KPIs** com valores reais e variaveis
- **Grafico de distribuicao** por vendedor populado
- **Grafico de temperatura** com mix hot/warm/cold
- **Lista de riscos** com ciclos sem resposta
- **Grafico de objecoes** com preco, confianca, etc
- **Performance** comparando os 2 vendedores
- **Timeline** com vendas distribuidas nos 30 dias
- **Tabela vendas recentes** com registros

## Como Executar

Apos implementacao, chamar a edge function:

```bash
POST /functions/v1/seed-demo-data
Body: { "secret": "[ADMIN_CREATION_SECRET]" }
```

Ou adicionar botao na interface admin para executar.
