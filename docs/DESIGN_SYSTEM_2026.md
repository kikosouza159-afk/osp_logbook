# OSP Logbook — Design System 2026

## Objetivo
O OSP Logbook usa uma linguagem visual executiva para operação, estratégia e acompanhamento de incidentes. A interface prioriza leitura rápida, densidade informacional, hierarquia clara e consistência entre desktop, notebook e mobile.

## Identidade
- Laranja: `#FB5C28` — ação, destaque e ADA.
- Azul-escuro: `#000049` — estrutura, navegação e autoridade visual.
- Azul: `#345F99` — informação, Locator e estados intermediários.
- Branco: `#FFFFFF` — superfícies e contraste.
- Cinza: `#848484` — informação secundária.
- Títulos: Avenir / Avenir Next e fallbacks equivalentes.
- Texto: Asap e fallbacks de sistema.

## Princípios
1. **Executive first**: o usuário deve entender o estado da operação antes de ler detalhes.
2. **Semântica antes de decoração**: cores e ícones precisam indicar significado.
3. **Densidade controlada**: tabelas são compactas; formulários e decisões têm mais respiro.
4. **Uma fonte de verdade visual**: novos componentes devem reutilizar tokens e classes do Design System.
5. **Dark mode real**: contraste e superfícies são recalibrados, não apenas invertidos.
6. **Acessibilidade por padrão**: foco visível, navegação sem mouse, rótulos claros e suporte a reduced motion.

## Estrutura de navegação
A navegação lateral é organizada em:
- Monitoramento: Visão Geral, Checklist, Incidentes e Respostas.
- Gestão: Clientes e Analistas.
- Governança: Histórico, Guia de Uso e Configurações.

O modo recolhido funciona como rail de ícones. No mobile, a navegação vira uma grade compacta.

## Componentes

### Page header
Todo topo de página deve ter:
- título curto;
- subtítulo orientado à ação;
- no máximo duas ações principais;
- uso de `.page-head` para manter o tratamento visual global.

### KPI
Usar `KpiCard` para indicadores principais. A semântica visual é inferida pelo nome:
- aberto: danger;
- aguardando: warning;
- resolvido: success;
- Locator / tratativa: blue;
- ADA: orange;
- clientes: violet.

Evitar cores personalizadas por página quando uma semântica existente já resolve.

### Tabelas
- cabeçalho sticky;
- números com tabular figures;
- hover discreto;
- ações na última coluna;
- badges para status;
- cliente + produto sempre separados quando representam operações diferentes.

### Formulários
- campos obrigatórios explicitamente rotulados;
- foco com halo azul;
- ação principal laranja;
- ação destrutiva vermelha com confirmação;
- edição deve preservar histórico quando aplicável.

### Status
- Novo: índigo.
- Em análise / Em tratativa: azul.
- Aguardando: âmbar.
- Resolvido / Encerrado: verde.
- Alta / Crítica: laranja-vermelho / vermelho.

## Motion
Microinterações devem durar aproximadamente 160–240 ms e nunca impedir leitura. O Design System respeita `prefers-reduced-motion`.

## Responsividade
- Desktop: sidebar completa.
- Notebook: sidebar pode ser recolhida.
- Tablet: rail de navegação.
- Mobile: navegação compacta e cards em duas ou uma coluna conforme largura.
- Tabelas preservam scroll horizontal em vez de esmagar colunas.

## Regras de evolução
Antes de criar CSS novo:
1. Verificar se já existe um token ou componente equivalente.
2. Preferir classes semânticas reutilizáveis.
3. Não duplicar estilos de light/dark mode.
4. Não inserir cores aleatórias fora da identidade sem necessidade semântica.
5. Validar build, TypeScript e Render antes de concluir uma mudança.
