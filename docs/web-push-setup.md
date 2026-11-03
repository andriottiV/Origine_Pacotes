# Web Push — configuração e operação

## Onde ativar

No portal /cliente, na área **Notificações**. O pedido de permissão só ocorre ao
clicar em **Ativar notificações**. A permissão é por navegador/perfil/aparelho.
Desativar remove a assinatura daquele aparelho; as quatro preferências são por
cliente e valem em todos os aparelhos. Elas começam ativadas no primeiro consentimento.
O recurso é opcional: uma indisponibilidade de push não bloqueia a consulta do portal.

Suporte é detectado pelas APIs do navegador, em HTTPS (ou localhost para testes).
No iPhone/iPad, use iOS/iPadOS 16.4 ou posterior: Safari → Compartilhar → Adicionar
à Tela de Início; abra o app pelo ícone e então ative. Permissão bloqueada precisa
ser liberada nas configurações do navegador/aparelho. Não há garantia de entrega.

Fontes oficiais consultadas em 01/11/2026:

- [WebKit: Web Push no iPhone/iPad](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Push API e compatibilidade](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push: API e VAPID](https://github.com/web-push-libs/web-push)
- [Vercel: limites do cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel: autenticação e gerenciamento](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase: cron, pg_net e Vault](https://supabase.com/docs/guides/functions/schedule-functions)

## Banco e variáveis

1. Aplique as migrations existentes em ordem, incluindo a nova
   **supabase/migrations/20261101120000_web_push.sql**. Ela adiciona quatro tabelas
   privadas com RLS, índices e funções privadas; não reseta nem altera registros
   financeiros. O trigger só captura novos lançamentos/transições de estorno;
   não há backfill de avisos antigos. As assinaturas das RPCs de consumo/estorno
   permanecem as mesmas.
2. Gere UMA vez o par VAPID em terminal privado:

       npm run push:keys

   O comando imprime o par para configuração; não o coloque em logs, commits,
   prints ou mensagens. Não gere um par a cada deploy.
3. Configure na hospedagem e no ambiente local de homologação:

   | Variável | Escopo / valor |
   | --- | --- |
   | NEXT_PUBLIC_VAPID_PUBLIC_KEY | Chave pública gerada; embutida no build do navegador |
   | VAPID_PRIVATE_KEY | Chave privada do mesmo par; exclusivamente servidor |
   | VAPID_SUBJECT | Contato real, por exemplo mailto:contato@seudominio.com |
   | PUSH_ENABLED | true para habilitar; ausência/false mantém desligado |
   | CRON_SECRET | Token aleatório exclusivo do agendador, com pelo menos 32 caracteres |
   | SITE_URL | Origem HTTPS canônica da implantação, sem caminho; use a origem correta em previews |
   | NEXT_PUBLIC_SUPABASE_URL | Configuração Supabase já existente |
   | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Chave pública Supabase já existente |
   | SUPABASE_SERVICE_ROLE_KEY | Configuração de servidor já existente; nunca use em NEXT_PUBLIC ou no cron |

   Para gerar o token do cron em terminal privado:

       node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

4. Faça build e deploy depois de configurar a chave pública. Confirme que os
   endpoints /manifest.webmanifest, /sw.js e /icons/push-192.png retornam 200 via HTTPS.
   /sw.js deve ter escopo /, Cache-Control sem cache e MIME JavaScript. O worker
   não intercepta fetch de páginas nem armazena respostas privadas para uso offline.
5. Entre com um cliente de TESTE e consentimento explícito. Nunca use cliente real
   como teste de entrega. Em rotação do par VAPID, mantenha as duas chaves em conjunto,
   faça novo deploy e peça para os aparelhos ativarem novamente; o portal detecta
   mudança da chave pública quando o navegador permite inspecioná-la.

## Agendamento obrigatório para retentativas

O arquivo vercel.json agenda GET /api/push/daily às 12:00 UTC, correspondendo a
09:00 em São Paulo no fuso atual. O banco calcula o dia por America/Sao_Paulo.
A Vercel envia Authorization: Bearer CRON_SECRET quando a variável está configurada.
Cron da Vercel roda na implantação de produção, não no servidor dev.

A documentação atual limita Hobby a execução diária e precisão de hora; não se
presume execução às 09:00 exatas. Pro/Enterprise permitem maior frequência, mas o
plano desta conta não foi consultado. Não é necessário presumir uma troca de plano.
Confirme também o limite de duração de funções da implantação: os endpoints de
processamento declaram maxDuration=60; o limite efetivo depende da hospedagem.

Para consumir a fila e retentar em minutos sem depender de o cliente abrir o app,
configure **um** dos caminhos abaixo:

- **Supabase Cron + pg_net + Vault:** habilite essas extensões no Dashboard,
  crie no Vault os segredos origine_app_url (origem HTTPS sem barra final) e
  origine_push_cron (o mesmo CRON_SECRET do servidor), e execute o script opcional
  supabase/operations/web_push_scheduler.sql como administrador. Ele cria/atualiza
  um job nomeado a cada minuto. Não é uma migration automática e não foi executado.
  Restrinja acesso SQL/Vault/pg_net a administradores confiáveis: pg_net mantém o
  cabeçalho descriptografado na fila até enviar. Use o token limitado de cron,
  não a chave service_role. Confirme extensões/disponibilidade/cotas no projeto.
- **Agendador externo ou Vercel com frequência permitida:** chame GET ou POST
  /api/push/process a cada minuto (ou a cada 5 minutos), com o cabeçalho
  Authorization: Bearer CRON_SECRET. Se usar Vercel, acrescente a entrada ao
  vercel.json somente após confirmar que o plano aceita a frequência.

O processador trata até 20 entregas por chamada, em grupos de cinco. Depois das
09:00 de São Paulo também completa o enfileiramento de vencimentos em lotes de
200, permitindo drenar mais de mil pacotes elegíveis. Reexecuções são idempotentes.
Monitore backlog e idade das tarefas; a configuração não promete pontualidade.
O cron diário isolado NÃO fornece retentativas em minutos: o job periódico acima
faz parte da configuração necessária para disponibilizar o recurso com retentativas.

Consumo/estorno registrados pelo app também agendam uma tentativa curta com after()
do Next depois de devolver a resposta. É apenas uma antecipação do processamento;
a outbox no banco e o agendador são os mecanismos duráveis. A biblioteca Web Push
só é importada dentro desse callback, fora do caminho da confirmação do atendimento.

## Eventos, consistência e falhas

- O trigger grava uso/estorno e saldo resultante na mesma transação do ledger,
  usando o bloqueio do pacote já adotado pelas RPCs. Nenhum HTTP roda na transação.
- Uso idempotente e estorno repetido não criam novos eventos. Saldo baixo só nasce
  na passagem de >2 para 1 ou 2, com índice único por pacote; não se repete após
  estorno nem ocorre para zero. O texto de zero é “Nenhum serviço disponível”.
- Vencimento usa saldo agregado no banco, somente pacotes vigentes, com saldo,
  status pending/partial/paid e identidade ativa, que vencem em três dias.
  A chave única é pacote/tipo/data. Antes de enviar, uma mudança da validade,
  cancelamento, reembolso ou ausência de saldo invalida o aviso pendente.
- Eventos de uso/estorno/saldo baixo expiram em seis horas; vencimento expira em
  até doze horas, sempre antes da virada do dia em São Paulo. A expiração é lógica;
  esta migration não exclui eventos ou histórico para impor retenção física.
- Entrega é por evento + assinatura. Fanout usa bloqueios SKIP LOCKED; cada entrega
  tem lease de dois minutos e token de reserva. Workers concorrentes não reclamam
  uma reserva válida; token antigo não pode concluir uma tarefa retomada.
- Máximo de cinco tentativas. Rede/DNS, HTTP 408/425/429/5xx usam espera progressiva
  de 1, 5, 30 e 120 minutos. 404/410 desativam aquela assinatura; 3xx não são
  seguidos e são falha permanente, assim como outros erros permanentes 4xx.
- Preferências, identidade, consentimento anterior ao evento e aparelho ativo são
  verificados na expansão e novamente imediatamente antes do envio. Desativar uma
  preferência cancela suas entregas pendentes; desativar/revincular aparelho cancela
  o trabalho anterior. Um aparelho com falha não retenta o envio dos demais.
- Se o provedor recebeu o push, mas a resposta ou o registro de confirmação se
  perdeu, pode haver reenvio. O tag estável do evento ajuda a agrupar notificações
  no aparelho, mas Web Push não garante entrega nem “exatamente uma vez”. Uma
  operação já iniciada no provedor não pode ser recolhida pelo servidor.

## Privacidade, autorização e saída da conta

Não há endpoint para enviar mensagens arbitrárias nem para escolher client_id.
As rotas privadas validam sessão, claims e identidade ativa pelo Supabase do usuário.
Só depois usam service_role no servidor; tabelas/capacidades e RPCs internas não
podem ser lidas/executadas diretamente por clientes ou profissionais.
Mutações exigem Origin da aplicação e cookie SameSite. O cookie de aparelho é
aleatório, HttpOnly, com hash no banco e prefixo __Host- em produção. Uma assinatura
já pertencente a outro cookie de aparelho não pode ser tomada apenas conhecendo o
endpoint. Preferências são restritas à identidade autenticada.

O envio usa HTTPS, uma lista fechada de provedores (FCM, Mozilla, Apple e WNS),
validação de todos os endereços DNS e conexão presa a um IP público aprovado com
verificação TLS do hostname original. Não segue redirecionamentos e tem prazo de
DNS/requisição. Provedores novos precisam de revisão explícita da allowlist.
Endpoints, chaves, tokens e erros brutos do provedor não são escritos nos logs.
A tela bloqueada recebe somente contagem de serviços e texto genérico, sem nomes,
preços ou dados financeiros.

Sair remove o vínculo do aparelho no servidor antes de limpar a sessão. O navegador
limpa o token local, fecha notificações visíveis e tenta unsubscribe. Sem JavaScript,
o formulário ainda executa o desligamento no servidor. Se não for possível confirmar
a desvinculação, o logout retorna erro para tentar novamente. A saída de um aparelho
não desativa os outros.

O service worker também confirma via /api/push/verify que o token local e a conta
atual ainda correspondem ao evento. Se estiver desconectado, em outra conta, com
preferência desativada ou sem conseguir verificar a sessão, NÃO exibe o aviso.
Isso preserva a privacidade em aparelhos compartilhados, mas pode descartar um
push em falha de rede ou sessão expirada. Navegadores que exigem um aviso visível
por push, incluindo Safari, podem revogar a permissão diante de mensagens
silenciosas; pode ser necessário autorizar novamente após esse tipo de descarte. Preferência/permissão dependem também do
navegador: não há promessa de compatibilidade física sem homologação em aparelhos.

Ao clicar em um aviso já exibido, abre /cliente/pacotes/UUID com saldo e histórico
paginado reais. Se precisar entrar novamente, o login preserva exclusivamente essa
rota permitida; links externos e outros caminhos de retorno são descartados.
RLS e verificação da identidade voltam a autorizar a abertura do pacote.

## Testes e pendências desta implementação

Executados localmente: 164 testes Vitest/Testing Library, 51 verificações SQL de
push e 40 regressões de consumo no PGlite, quatro smoke tests HTTP do build de
produção via Playwright, TypeScript, ESLint e build (lint sem erros, com dois avisos
preexistentes em login/onboarding). Os testes usam fixtures e transporte
simulado; não enviam push real. Cobrem consentimento explícito, negação, iPhone/Tela
de Início, validação de destinos/SSRF, vínculo derivado no servidor, múltiplos
aparelhos, logout, snapshots, idempotência, saldo baixo, vencimento e reexecução,
preferências pendentes, isolamento, tokens de reserva, 404/410, retentativas,
expiração e indisponibilidade de push independente do consumo.

Para reproduzir SQL sem tocar na aplicação:

    npm install --prefix .tmp-usage-db --no-save --package-lock=false --cache .tmp-npm-cache @electric-sql/pglite
    node supabase/tests/web_push.mjs
    node supabase/tests/simple_service_usage.mjs

web_push_timings.json registra somente tempo SQL de fixture, antes/depois do trigger
com oito chamadas (uma de aquecimento e sete amostras), cada uma com ROLLBACK.
Não é medição da confirmação HTTP hospedada nem prova de entrega. A última
amostra registrou medianas SQL de 3,30 ms sem o trigger e 4,33 ms com ele; não há
chamada HTTP de push no caminho medido.

A auditoria npm também apontou avisos em dependências já presentes (incluindo
ferramentas de teste); web-push e ipaddr.js não constaram dos pacotes afetados
nessa auditoria. Não foram feitas atualizações de dependências fora do escopo.

Ainda pendentes: aplicar migration no Supabase remoto; gerar/configurar VAPID e
CRON_SECRET; instalar o job periódico e conferir o plano/cotas/extensões; publicar;
homologar com contas de teste em Chrome/Firefox/Edge/Safari e iPhone/iPad instalado;
validar concorrência real entre conexões e falhas de rede ambíguas em infraestrutura
publicada. Nenhuma assinatura, conta ou serviço real foi usado para envio de teste.


## Diagnóstico de configuração

Para bloqueio de ativação, diferenças entre build e runtime e mensagens distintas de suporte/API, consulte [web-push-diagnostics.md](web-push-diagnostics.md). A edição de variáveis na Vercel exige novo deployment; a chave pública exige também novo build. Não gere outro par VAPID para corrigir configuração de ambiente.
