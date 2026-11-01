# Investigação de desempenho — Origine Pacotes

Medições de 01/11/2026, Windows, Node 24.14.1, Next.js 16.4.3. As alterações
anteriores de registro de uso foram preservadas. Os JSONs nesta pasta guardam
amostras e planos, sem nomes, chaves, tokens ou IDs de clientes reais.

## Evidências e correções

- O dashboard chamava loadUsageHistory sem limite e só depois aplicava slice(0,10).
  O helper consultava profissionais e, em seguida, páginas de mil usos em sequência,
  incluindo uma página vazia quando o total era múltiplo de mil.
- Clientes e registro de uso baixavam históricos da organização para calcular saldos
  em JavaScript, percorrendo os usos novamente para cada pacote. Agora clientes têm
  50 linhas por página; apenas seus IDs entram na RPC de saldo. O registro pesquisa
  clientes (20 por página) e só busca pacotes do cliente selecionado (20 por página).
- O portal agora pagina pacotes e histórico independentemente e consulta saldos no
  banco. O histórico parcial nunca é usado para calcular o saldo total.
- Novas RPCs de leitura SECURITY INVOKER preservam RLS e calculam a soma dos usos
  ativos na fonte de verdade existente. Não foi criado contador ou cache de saldo.
- O histórico tem filtro por cliente/organização, limite de página e nomes de
  cliente/pacote obtidos por relacionamentos já protegidos. Consultas independentes
  de histórico e profissionais executam em paralelo. Não há busca de todos os
  clientes/pacotes no dashboard para dar nome a dez lançamentos.
- Planos com RLS mostraram Seq Scan + Sort para o histórico completo e para a lista
  recente de clientes. Três índices novos suportam os filtros e ordenações reais.
  O índice parcial usage_package_idx já atendia à soma dos usos não estornados;
  ele foi mantido. Não há evidência de que essa soma seja o gargalo nesta amostra.
- Após uso/estorno, revalidatePath já devolve a tela atualizada na resposta da ação.
  Foi removido o router.refresh adicional nesses dois fluxos. Catálogo de tipos não
  exibe saldos de consumo; sua invalidação foi removida. As páginas de clientes,
  atendimentos, início, portal e relatórios continuam sendo invalidadas.
- O dashboard usa navegação do Next em vez de window.location.assign; a pesquisa
  de clientes usa next/form. O catálogo só tenta criar padrões quando está vazio,
  em vez de executar uma RPC de inicialização em toda abertura.
- O histórico de leitura do portal é renderizado no servidor. Registro e estorno
  conservam bloqueio imediato contra cliques duplicados, processamento visível e
  sucesso somente após confirmação. Nada foi alterado nas RPCs de escrita, seus
  bloqueios/idempotência, regras de validade ou registros financeiros.

## Tempos do PostgreSQL isolado

PGlite com todas as migrations, role authenticated e RLS: 1.000 clientes,
1.000 pacotes, 10.000 usos sintéticos (20% estornados). Mesmo banco e mesmas
consultas antes/depois dos índices; uma execução de aquecimento e sete amostras,
mediana em ms. Os planos completos estão em database-comparison.json.

| Consulta | Antes | Depois |
| --- | ---: | ---: |
| Dez usos recentes | 106,18 | 0,68 |
| Histórico de um cliente (até 21) | 1,77 | 0,52 |
| Clientes recentes (até 51) | 10,11 | 1,04 |
| Soma dos usos ativos de um pacote | 0,51 | 0,62 |
| RPC de consumo isolada | 2,74 | 1,18 |
| RPC de estorno isolada | 2,10 | 0,73 |

Após os índices, os planos usam service_usages_org_history_idx,
service_usages_client_history_idx e clients_org_recent_idx. A soma continua
usando usage_package_idx. As escritas do ensaio só ocorreram em fixtures locais,
com ROLLBACK por amostra. As RPCs de escrita não mudaram: sua variação não prova
uma melhoria causal. Há apenas uma conexão, sem medir contenção de locks.

## Helper e requisições

Snapshot do helper original medido antes da alteração; dados sintéticos fixos de
10.000 usos e atraso controlado de 30 ms por chamada, seis execuções por versão.
É um ensaio do helper real com API simulada, não o tempo de uma página publicada.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Mediana (ms) | 394,55 | 35,49 |
| Chamadas | 12 sequenciais | 2 em paralelo |
| Usos transferidos | 10.000 | 11 |
| Usos exibidos | 10 | 10 |


## HTTP local: desenvolvimento e build de produção

Seis fetches sequenciais por rota em loopback, mesma máquina e sem sessão; a tabela
usa a mediana das últimas cinco amostras. A primeira foi guardada separadamente
nos JSONs. O servidor dev já estava aberto; não se presume compilação fria.
Produção significa next start de build local, não a hospedagem publicada.

| Ambiente / rota | Antes (ms) | Depois (ms) | HTTP |
| --- | ---: | ---: | --- |
| development · /login | 80,55 | 86,91 | 200 |
| development · /clientes | 8,17 | 7,84 | 307 |
| development · /atendimentos/novo | 8,00 | 8,20 | 307 |
| development · /cliente | 7,55 | 7,47 | 307 |
| production · /login | 22,07 | 25,74 | 200 |
| production · /clientes | 3,51 | 3,77 | 307 |
| production · /atendimentos/novo | 2,53 | 2,44 | 307 |
| production · /cliente | 2,15 | 2,56 | 307 |

As rotas privadas devolveram 307 para login: estes tempos não medem clientes,
consumos ou autenticação de uma sessão válida. O login não foi otimizado; a
variação e a diferença entre dev/build não são evidência de ganho nessas telas.

## Supabase remoto: somente leituras

Amostra disponível: 3 clientes, 3 pacotes e 1 uso em uma organização. Acesso com
chave de servidor, que ignora RLS: não substitui um teste autenticado da aplicação.
Seis amostras intercaladas por consulta. Nenhum consumo/estorno real foi executado.

| Leitura | Consulta anterior (ms) | Consulta limitada (ms) |
| --- | ---: | ---: |
| Clientes | 439,38 | 241,99 |
| Histórico | 237,00 | 233,79 |


Com esse volume pequeno e a variação de rede, não se atribui ganho de produção
aos índices ainda não aplicados. EXPLAIN via PostgREST foi recusado com PGRST107.
A nova RPC de leitura retornou PGRST202 (não encontrada no schema cache remoto).
Não há conexão PostgreSQL administrativa nem sessão de usuário para medir planos
reais com RLS, autenticação, RPCs de escrita remotas, espera por locks ou a
navegação autenticada no navegador. O script de inspeção de índices e bloqueios
em supabase/verification/usage_performance_readonly.sql é somente leitura.

## JavaScript

Os arquivos JS de entrada do portal somavam 21526 bytes (6698 gzip); agora somam 24250 (7717 gzip). São entradas do manifest, sem os chunks gerais do runtime, HTML ou RSC; não são
uma medição de download ou execução no navegador. Apesar de remover a hidratação
do histórico somente de leitura, a navegação paginada com next/link adicionou
código: não houve redução líquida desses bytes. Não foi comprovado bloqueio por
JavaScript na produção; as otimizações principais são de consultas e requisições.

## Verificação e implantação

103 testes da aplicação e 40 verificações SQL isoladas aprovados. Build e tsc
passaram; lint sem erros, com dois avisos preexistentes em login/onboarding.
Um tsc executado junto com o build pegou a geração de tipos pela metade; sua
execução isolada depois do build passou. Não há evidência de erro de tipos no código.

A migration incremental 20261101110000_bounded_usage_reads.sql precisa ser
aplicada depois da migration anterior de uso, antes de publicar o novo código.
Ela só cria três índices e duas funções de leitura; não reseta o banco. Não houve
migration/deploy remoto nesta investigação.

Para diagnóstico posterior, habilite ORIGINE_PERF=1 somente no servidor. Os logs
origine-perf distinguem proxy/servidor, chamadas Auth, membership e RPCs de uso e
estorno, sem URLs com filtros, payloads ou credenciais. Eles medem o fetch até os
headers; os estágios Auth/RPC medem o await completo. Isso não identifica sozinho
o tempo de lock dentro do PostgreSQL. Sem a flag, a instrumentação fica desligada.

Reprodução (dependência de teste temporária, sem alterar package.json):

    npm install --prefix .tmp-usage-db --no-save --package-lock=false --cache .tmp-usage-db/npm-cache @electric-sql/pglite
    node performance/database.mjs
    node supabase/tests/simple_service_usage.mjs
    node performance/measure-loader.mjs before
    node performance/measure-loader.mjs after
    node performance/measure-local.mjs 3000 development-after
    node performance/measure-local.mjs 3114 production-after
    node performance/measure-assets.mjs after
    node performance/measure-remote.mjs

Os scripts de banco em memória nunca conectam ao Supabase. O script remoto só faz
leituras e necessita das variáveis já usadas no servidor. Os scripts de assets e
HTTP pressupõem build/servidor correspondente, sem tarefas pesadas em paralelo.
Não execute consumo real para medir. Concorrência entre conexões independentes
e testes autenticados na hospedagem continuam pendentes.
