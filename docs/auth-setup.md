# Cadastro profissional e recuperação — ambiente de testes

O modo atual utiliza o envio padrão do Supabase e o endereço padrão da Vercel, sem SMTP personalizado e sem domínio próprio. Não é necessário contratar domínio nem configurar SPF/DKIM para esse teste.

## O que foi verificado, sem enviar e-mails

Verificação de 28/10/2026:

- Projeto indicado pela configuração local: xxpsqpdrsiwsujyoxocn.
- GET público de Auth: cadastro habilitado e confirmação de e-mail obrigatória (mailer_autoconfirm=false).
- A introspecção REST autenticada não lista password_recovery_grants nem complete_professional_signup. A consulta à tabela nova com limit=0 retornou HTTP 404/PGRST205, enquanto profiles respondeu HTTP 200. O acesso ao histórico supabase_migrations foi recusado com HTTP 406/PGRST106 (esquema não exposto). Esses componentes obrigatórios ainda não estão disponíveis na API; conferir o histórico SQL antes de aplicar qualquer migration.
- A branch main remota permanece no commit fbcce98c60edb3828e2c2825f21a9596e6969fee. As alterações de autenticação continuam locais, sem commit.
- https://origine-pacotes.vercel.app/cadastro e /esqueci-senha retornaram HTTP 404. As novas páginas não estão publicadas.
- O valor de SITE_URL na Vercel, os templates atualmente salvos, a composição da equipe e a configuração de SMTP não puderam ser verificados pela API pública.
- Nenhum cadastro, recuperação, geração de link administrativo ou envio de e-mail foi realizado nessa verificação.

Não reaplicar a migration com base apenas na introspecção REST. Conferir primeiro o histórico e os objetos no projeto correto; a API pode ter cache de esquema. Não executar outras migrations pendentes automaticamente.

## Templates padrão: como o callback funciona

Manter Confirm email habilitado. Em Confirm signup e Reset password, preservar o link padrão:

<a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a>

<a href="{{ .ConfirmationURL }}">Redefinir minha senha</a>

Esses exemplos mostram somente o link relevante. O texto, o assunto e o restante do HTML padrão podem permanecer como estão. Não substituir por links com TokenHash/RedirectTo para este modo de teste.

O encadeamento revisado no código e no SDK instalado é:

1. O aplicativo chama signUp ou resetPasswordForEmail com redirectTo fixo no servidor.
2. @supabase/ssr 0.8.0 configura PKCE e persiste o verificador em cookie mesmo quando o cadastro exige confirmação e não devolve uma sessão.
3. ConfirmationURL abre /auth/v1/verify no Supabase. No fluxo PKCE, o Auth acrescenta code à query de redirectTo, preservando flow.
4. O link de cadastro volta a /auth/callback?flow=signup&code=... e o de recuperação a /auth/callback?flow=recovery&code=....
5. /auth/callback usa exchangeCodeForSession e grava os cookies da sessão.
6. Cadastro segue para /auth/complete; o provisionamento idempotente precisa ser confirmado antes de abrir o painel.
7. Recuperação exige claims verificadas com método recovery, autorização temporária ligada ao usuário/sessão e consumo único antes de updateUser. O parâmetro flow sozinho não autoriza troca de senha.

O código também rejeita parâmetros duplicados ou conflitantes, combinações de código e token, parâmetros de erro e tokens de sessão passados na query. Ele não usa tokens de fragments (#access_token=...) como alternativa ao PKCE, nem aceita next/redirect livre para escolher o destino.

### Mesmo navegador e uma solicitação por vez

Iniciar e concluir cada fluxo no MESMO navegador, perfil, dispositivo e origem:

- Se começou em https://origine-pacotes.vercel.app, abra o e-mail nesse mesmo perfil e domínio.
- Se começou em http://localhost:3000, abra o link nesse mesmo perfil e mantenha a aplicação local ligada.
- Não alternar localhost e 127.0.0.1: os cookies pertencem a origens diferentes.
- Evitar o navegador interno do Gmail, outro dispositivo e janela anônima.
- Concluir um fluxo antes de iniciar outro; outra solicitação pode substituir o verificador PKCE anterior.
- Links antigos, emitidos antes da implementação/configuração correta, podem não servir. Solicitar um novo somente quando as pendências abaixo estiverem resolvidas.

Sem o cookie original, com código expirado ou já consumido, o callback mostra erro; não cria uma sessão artificial e não abre o painel.

Os testes de contrato usam o SDK real instalado e um servidor Auth substituído por um fetch local: verificam geração do desafio S256, persistência/leitura do cookie, troca do código, cookies de sessão e rejeição sem verificador/por expiração. Nenhuma chamada desses testes alcança o Supabase real. Isso não substitui o teste ponta a ponta com e-mail autorizado.

## URLs exatas

Vercel → projeto origine-pacotes → Settings → Environment Variables:

- SITE_URL com valor https://origine-pacotes.vercel.app, exclusivamente no servidor e no ambiente Production.
- Não criar NEXT_PUBLIC_SITE_URL.
- Manter NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY como públicas.
- Manter SUPABASE_SERVICE_ROLE_KEY exclusivamente no servidor.
- Alterações de ambiente só passam a valer no próximo deploy.

Supabase → Authentication → URL Configuration:

Site URL: https://origine-pacotes.vercel.app

Redirect URLs de produção necessárias aos templates padrão:

- https://origine-pacotes.vercel.app/auth/callback?flow=signup
- https://origine-pacotes.vercel.app/auth/callback?flow=recovery

/auth/confirm não é usado pelos templates padrão neste modo. A rota /auth/confirm existente continua no código para compatibilidade com integrações previamente revisadas; não é preciso inventar ou mudar o callback padrão.

Para desenvolvimento em 3000, adicionar somente as origens que serão utilizadas:

- http://localhost:3000/auth/callback?flow=signup
- http://localhost:3000/auth/callback?flow=recovery
- http://127.0.0.1:3000/auth/callback?flow=signup
- http://127.0.0.1:3000/auth/callback?flow=recovery

Se for usar o servidor de teste em 3101, os valores exatos adicionais são:

- http://localhost:3101/auth/callback?flow=signup
- http://localhost:3101/auth/callback?flow=recovery
- http://127.0.0.1:3101/auth/callback?flow=signup
- http://127.0.0.1:3101/auth/callback?flow=recovery

Preservar outros destinos legítimos já cadastrados. Não usar curingas abertos. /redefinir-senha é o destino interno após a troca do código, não o redirectTo enviado à Auth.

## Envio padrão, sem SMTP personalizado

No Supabase, manter o serviço de envio padrão; não habilitar nem cadastrar SMTP personalizado nesta etapa.

Segundo a documentação oficial consultada em 28/10/2026, o serviço padrão:

- Só entrega a endereços que pertencem à equipe da organização/projeto Supabase. Ser um usuário do aplicativo ou proprietário de um negócio no banco não substitui essa condição.
- Tem atualmente limite de 2 e-mails por hora por projeto, sujeito a alterações, além dos limites por solicitação/destinatário.
- É apropriado para exploração e testes e não oferece garantia de entrega.

Conferir em Organization Settings → Team se o e-mail de teste já pertence à equipe. Se não pertencer, será necessário o proprietário administrar a equipe pelo painel; a aplicação não deve conceder acesso à organização Supabase.

Planejar um cadastro e uma recuperação dentro da cota, sem disparar tentativas repetidas. A resposta neutra da recuperação não comprova entrega: verificar caixa de entrada/spam e os logs de Auth pelo painel, sem expor tokens. Não usar generateLink nem suprimir confirmação para contornar os testes.

A senha da interface exige 10+ caracteres, letras e números; o Supabase ainda pode impor regras mais fortes. Não enfraquecer a política para realizar os testes.

## Migration: verificar antes de aplicar

Arquivo:
supabase/migrations/20261028100000_professional_signup_and_recovery.sql

Confirmar no painel que a referência é xxpsqpdrsiwsujyoxocn e que esse é o projeto do aplicativo. No SQL Editor, executar primeiro apenas leituras:

select to_regclass('supabase_migrations.schema_migrations') as migration_history;
select to_regclass('public.password_recovery_grants') as recovery_grants,
       to_regprocedure('public.complete_professional_signup()') as completion_rpc;

Se a tabela de histórico existir:

select version, name
from supabase_migrations.schema_migrations
order by version;

Se a versão 20261028100000 já estiver registrada, não reaplicar. Se os objetos existirem sem registro, revisar as definições/permissões e conciliar o histórico antes de qualquer mudança. Se o histórico não existir, comparar as definições no banco com as migrations; isso não autoriza aplicar todas novamente.

A migration é transacional: atualiza o trigger existente, cria perfil/organização/vínculo owner de forma idempotente e inclui a tabela privada de autorizações de recuperação, com RLS e acesso somente pelo servidor. Ela não aceita ids de organização nem papéis privilegiados do navegador. Não há necessidade de uma migration nova para usar templates padrão.

## Publicação e ordem para o teste com o próprio e-mail

1. Confirmar identidade/histórico e disponibilizar a migration, sem duplicar nem aplicar outras pendentes.
2. Verificar SITE_URL na Vercel; Site URL, Redirect URLs e templates padrão no Supabase; manter confirmação habilitada.
3. Confirmar que o e-mail do próprio usuário pertence à equipe Supabase.
4. Revisar arquivos/segredos e publicar as alterações locais no repositório existente andriottiV/Origine_Pacotes.
5. Verificar se o push iniciou deploy automático antes de criar outro. Aguardar sucesso e conferir /cadastro e /esqueci-senha na URL publicada.
6. Só então iniciar, com autorização, o cadastro e a recuperação. Nenhum e-mail deve ser enviado na etapa atual.
7. Verificar confirmação, um único perfil/negócio/owner, ausência de acesso a outro negócio, redefinição com link válido, expiração/reutilização e logout após a troca.

Manutenção futura: limpar autorizações expiradas/usadas por uma rotina administrativa confiável. Não expor password_recovery_grants ao navegador.

## Verificações locais

npm run test
npm run lint
npx tsc --noEmit
npm run build

Resultado desta revisão: 73 testes passaram; build e checagem de tipos passaram. Não houve envio de e-mails nem operação de alteração no Supabase, GitHub ou Vercel.

O teste SQL em supabase/tests/professional_signup_and_recovery.sql destina-se SOMENTE a banco isolado e termina com ROLLBACK. A migration já foi exercitada localmente com PostgreSQL WASM/PGlite na etapa anterior; isso não significa aplicação ao Supabase real.

Referências oficiais:
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/auth-smtp

## Preparação para publicação — 28/10/2026

O usuário informou que as URLs de produção já foram preenchidas no Supabase e SITE_URL adicionada na Vercel. Essas configurações não foram sobrescritas nem consideradas incorretas. O acesso disponível confirma o projeto indicado na configuração local e a confirmação de e-mail habilitada, mas não permite ler as configurações administrativas da Vercel/Supabase.

A consulta do histórico pelo acesso REST disponível foi recusada com PGRST106. A aplicação da migration ficou parada, mesmo estando autorizada: não foi possível consultar o histórico SQL. Um 404 na API não foi tratado como prova de ausência de tabela.

Consultas SQL exatas e somente de leitura:
[supabase/verification/professional_signup_readonly.sql](../supabase/verification/professional_signup_readonly.sql).

Abra o SQL Editor em:
https://supabase.com/dashboard/project/xxpsqpdrsiwsujyoxocn/sql/new

1. Confirme a referência do projeto na URL/painel.
2. Execute a seção 1 do arquivo de verificação.
3. Somente se migration_history não for null, execute a seção 2.
4. Se a versão 20261028100000 já estiver registrada, não execute a migration novamente.
5. Se houver objetos novos sem registro, ou se o histórico não existir, execute a seção 3 e revise as definições/permissões antes de aplicar qualquer alteração. Não usar migrations anteriores como tentativa de corrigir o histórico.
6. Se a versão não estiver aplicada e os objetos/pré-requisitos estiverem conferidos, abra o arquivo integral supabase/migrations/20261028100000_professional_signup_and_recovery.sql, copie TODO o conteúdo, de begin; até commit;, sem resumir ou substituir trechos, e execute somente esse arquivo no SQL Editor do projeto confirmado.
7. Não executar db push que inclua outras migrations pendentes. Depois, repetir as consultas de verificação. Se a aplicação for manual pelo SQL Editor, conciliar o registro de histórico com a ferramenta de migrations antes de uma futura execução automatizada; nunca marcar uma migration como aplicada antes de verificar a aplicação.

A publicação do código é independente da aplicação manual: /cadastro e /esqueci-senha podem ser verificadas por GET sem enviar e-mails. Os fluxos completos não devem ser testados até a migration estar confirmada.

Para acompanhar a publicação na Vercel: projeto origine-pacotes → Deployments → localizar o SHA do commit enviado à branch main do repositório andriottiV/Origine_Pacotes, aguardar Ready e conferir o domínio origine-pacotes.vercel.app. Antes de iniciar qualquer deploy manual, verificar se o push já iniciou o deploy automático. Não reenviar o mesmo commit apenas para acompanhar a implantação.
