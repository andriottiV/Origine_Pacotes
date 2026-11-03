# Diagnóstico do botão Web Push — 03/11/2026

## O que foi comprovado

Na versão anterior, o texto “As notificações ainda não estão disponíveis neste
ambiente” vinha exclusivamente de !configured no componente PushSettings. O portal
calculava esse valor no servidor por:

    PUSH_ENABLED === "true"
    && Boolean(VAPID_PRIVATE_KEY && NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_SUBJECT)

A condição não consultava iPhone, permissão, modo instalado, registro de service
worker ou API de assinatura. Portanto, essa frase prova o bloqueio pela configuração
recebida pela tela, mas não identifica sozinha QUAL das quatro variáveis falhou.
Não se pode usar um HTTP 200 do cron como prova de habilitação: processPushBatch já
retornava configured:false, claimed:0, accepted:0 com HTTP 200 quando desabilitado.

Foi encontrado também um problema reproduzível no cliente: o efeito retornava
imediatamente quando configured era falso. Não havia consulta à API nem atualização
desse estado inicial. Uma janela de PWA preservada com props antigas podia continuar
bloqueada mesmo depois de a configuração do servidor ser corrigida. Essa falha foi
corrigida e tem teste de regressão; não é possível afirmar que ela seja a única causa
do caso publicado sem observar a implantação que o iPhone está carregando.

O usuário confirmou que as variáveis estão configuradas na Vercel. Esse relato foi
preservado: não foi presumida ausência na produção com base no ambiente local.
A inspeção da Vercel pela UI foi interrompida pela ferramenta porque não conseguiu
validar a URL do navegador. Nenhuma configuração da Vercel foi lida ou alterada.
Não há valores de produção ou sessão do iPhone disponíveis para fechar a causa
em uma variável específica.

## Verificações remotas somente de leitura

Na origem configurada https://origine-pacotes.vercel.app:

- /manifest.webmanifest: HTTP 200, display standalone, start_url /cliente, scope /.
- /sw.js: HTTP 200, MIME JavaScript, Service-Worker-Allowed /, Cache-Control no-store;
  handlers push e notificationclick presentes.
- /api/push/subscription sem sessão: HTTP 401 e Cache-Control private,no-store.

Isso comprova os recursos publicados e a proteção da API, não a permissão ou o
registro efetivo do worker no iPhone. Não houve ativação, geração de chaves, escrita
no banco nem envio de push real para fazer estas verificações.

No .env local faltam PUSH_ENABLED e as três configurações VAPID. SITE_URL e as
configurações existentes do Supabase estão presentes. O diagnóstico local não é
uma leitura do ambiente Production da Vercel.

## Correções

A configuração agora tem uma fonte de verdade no servidor, compartilhada pelo
portal, API e processador. A resposta autenticada da API de assinatura contém um
objeto configuration com códigos de problema e verificações booleanas. Nunca
inclui chave privada, credencial Supabase, assunto, valores arbitrários de env ou
partes/fingerprints de segredos. Apenas a chave pública validada é enviada ao
navegador quando a configuração está pronta.

A validação identifica flag exata, chave pública ausente/inválida no build,
divergência build/runtime, chave privada ausente/inválida ou que não corresponde
ao par existente, assunto ausente/inválido e infraestrutura de servidor ausente.
O build fixa explicitamente a chave pública (inclusive sua ausência) em next.config;
nenhuma variável privada foi adicionada a esse mapa público.

O portal lê a configuração atual uma vez na montagem mesmo se a prop inicial for
false. Não há polling. Há nova verificação manual, mensagens separadas para
configuração incompleta, navegador sem suporte, necessidade de Tela de Início,
permissão negada, falha da API e falha do service worker. Registro inexistente do
worker é normal antes da primeira ativação; ele só é registrado após o clique.
Uma falha ao carregar a API deixa a ativação bloqueada até uma verificação bem-sucedida.
Falha ao salvar uma assinatura não é apresentada como falta de suporte.

## Conferência na Vercel e novo build

Em origine-pacotes → Settings → Environment Variables, selecione Production.
Confirme os nomes exatamente, sem enviar valores de chaves a logs ou mensagens:

| Variável | Valor/requisito | Aplicação da mudança |
| --- | --- | --- |
| PUSH_ENABLED | exatamente true, sem aspas/espaços; TRUE, 1 e true com espaço não habilitam | novo deployment Production |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | chave pública do MESMO par existente, base64url sem espaços, disponível ao compilar | novo build e deployment Production obrigatórios |
| VAPID_PRIVATE_KEY | chave privada do mesmo par, somente servidor | novo deployment Production |
| VAPID_SUBJECT | contato mailto: ou URL HTTPS válida | novo deployment Production |
| SUPABASE_SERVICE_ROLE_KEY | credencial já adotada pelo servidor, nunca NEXT_PUBLIC | novo deployment Production |
| SITE_URL | origem HTTPS canônica da aplicação, sem caminho/query/fragmento | novo deployment Production |

Não gere outro par VAPID. Para as demais variáveis, a leitura é no servidor, mas
a Vercel não muda os valores de deployments antigos ao editar o painel: publique
um novo deployment. Para corrigir a chave pública congelada no build, faça um
build novo com a variável no escopo correto; não apenas promova um artefato anterior.

Após publicar esta correção, atualize a página do PWA para carregar a nova versão
e consulte o diagnóstico exibido. A frase antiga foi removida: se ela continuar
aparecendo, a página ou a implantação ainda está usando a versão anterior. Não é
necessário remover a instalação nem recriar chaves para esse diagnóstico.

Fontes oficiais:

- https://vercel.com/docs/environment-variables
- Guia local da versão instalada: node_modules/next/dist/docs/01-app/02-guides/environment-variables.md

## Testes

Os testes usam pontos fixos P-256 e valores fictícios; nenhum novo par VAPID de
produção é gerado. Cobrem flag true exata, build vazio com runtime preenchido,
divergência de chaves, presença de dependências, pareamento, diagnóstico sem
segredos, atualização de estado inicial false pela API, retry, falha da API,
registro ausente/erro de worker, suporte e modo instalado em iPhone/iPad.

A configuração da implantação real, os dados da sessão do iPhone e a entrega em
aparelho físico não foram acessados. Deploy e verificação no PWA real permanecem
externos; não há migration de banco nesta correção.

Verificações finais: 192 testes da aplicação e quatro smoke tests HTTP passaram; build e TypeScript passaram. ESLint sem erros, com dois avisos preexistentes em login/onboarding. O build local confirmou a chave pública fixada explicitamente e vazia neste ambiente local; isso não é uma leitura do build publicado na Vercel.
