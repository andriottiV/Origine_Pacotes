# Origine Pacotes

Aplicação de gestão de pacotes de serviços para barbearias, preparada para múltiplas organizações. A interface está em português brasileiro, com painel administrativo responsivo, tema claro/escuro/sistema e uma modelagem Supabase com isolamento por organização.

## Requisitos

Node.js 20+ e uma conta/projeto Supabase para persistência e autenticação.

## Desenvolvimento

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em `.env.local`. A chave `SUPABASE_SERVICE_ROLE_KEY` só pode ser usada em código de servidor; nunca a exponha com prefixo `NEXT_PUBLIC_`.

## Banco e Supabase

No SQL Editor do Supabase, execute as migrações em ordem: `supabase/migrations/20261027140000_initial_schema.sql` e depois `supabase/migrations/20261027143000_security_and_tenant_integrity.sql`. A segunda reforça RLS, cria o onboarding seguro da primeira organização, restringe a execução das funções e impede referências entre organizações diferentes.

Antes de executar em produção, faça backup e aplique em um projeto de teste. No painel do Supabase, abra **SQL Editor**, cole uma migração por vez, execute e confira **Database → Migrations**. As migrações não desativam RLS nem usam `service_role`. Após a segunda migração, crie um usuário em **Authentication → Users**, inicie uma sessão na aplicação e chame o RPC `create_organization` somente pela interface autenticada que será adicionada na etapa de onboarding.

Após criar um usuário no Supabase Auth, crie uma organização e a associação correspondente em `organization_members` com o `user_id` desse usuário e papel `owner`. O produto não contém credenciais, usuários padrão ou seeds de produção.

Pacotes são válidos durante todo o dia de `expires_on`. Para validade mensal, quando o dia não existir no mês de destino, usa-se o último dia daquele mês.

## Verificação

```bash
npm run lint
npm run test
npm run build
```

## Publicação

O destino previsto é a Vercel: importe este repositório, cadastre as mesmas variáveis de ambiente no painel do projeto e conecte-o ao Supabase configurado. Não há implantação nem integração Supabase ativa neste repositório sem as credenciais do proprietário.

## Limitações atuais

O esquema de dados, RLS e função transacional foram criados localmente, mas ainda precisam ser aplicados a um projeto Supabase. Login, telas de CRUD, links seguros para a área do cliente e reconhecimento de voz dependem dessa integração e serão implementados nas próximas etapas.

## Cadastro profissional e recuperação de senha

As novas páginas estão implementadas em /cadastro, /esqueci-senha e /redefinir-senha.
A ativação depende da migration e das configurações externas descritas em
[docs/auth-setup.md](docs/auth-setup.md). Consulte esse guia antes de testar com
usuários reais. Nenhuma migration é aplicada automaticamente pela aplicação.


## Registro simples de uso de serviços

Acesse **Clientes → Registrar uso**, ou **Início → Registrar uso**, na rota
/atendimentos/novo. Selecione o cliente, o pacote e explicitamente 1 ou 2 serviços.
A prévia mostra o saldo restante; nenhuma identificação de serviço ou beneficiário é exigida.
O histórico permite estornar com confirmação. O dashboard mostra os dez usos mais
recentes; o portal do cliente mostra o histórico e os saldos do mesmo ledger.

Antes de disponibilizar esta versão, aplique a migration incremental
supabase/migrations/20261101100000_simple_service_usage.sql depois das anteriores,
pelo processo habitual de migrations do Supabase. Ela não foi aplicada ao banco remoto.
Não é necessário resetar o banco. Valores financeiros e validades são preservados.

Consumo e estorno travam o pacote e calculam o saldo pelos usos não estornados.
A chave de idempotência é vinculada ao autor, pacote, quantidade e observação legada.
O formulário conserva a mesma solicitação em tentativas após perda de resposta.
Membros (incluindo staff) registram e estornam; clientes do portal têm somente leitura.
A RPC antiga sem idempotência passa a ser interna. Linhas legadas são preservadas.

Validação local: npm run lint, npx tsc --noEmit, npm test e npm run build.
Para executar PostgreSQL em memória sem acessar a aplicação:

    npm install --prefix .tmp-usage-db --no-save --package-lock=false --cache .tmp-usage-db/npm-cache @electric-sql/pglite
    node supabase/tests/simple_service_usage.mjs

O script aplica todas as migrations em banco isolado e testa RPCs, permissões, RLS
do portal, idempotência, saldo, estorno e ausência de efeitos financeiros. A extensão
pgcrypto é omitida apenas no harness, pois UUID já é nativo do PostgreSQL.
A pasta temporária .tmp-usage-db pode ser removida após essa verificação.

O harness tem uma conexão e não substitui o ensaio com conexões independentes.
Em um Supabase de homologação com a migration aplicada, execute dois consumos
simultâneos, com chaves diferentes, sobre um pacote com saldo 2: apenas um consumo
de 2 deve ser aceito. Repita com a mesma chave: ambos devem devolver o mesmo
lançamento, com um único desconto. Dois estornos simultâneos do mesmo uso devem
produzir uma única entrada de auditoria de estorno.
A verificação em navegador autenticado no Supabase publicado permanece externa.


## Desempenho

O diagnóstico, as amostras antes/depois e os limites da medição estão em [performance/REPORT.md](performance/REPORT.md). A versão com consultas paginadas depende da migration incremental `20261101110000_bounded_usage_reads.sql`, que ainda precisa ser aplicada no Supabase. A instrumentação opcional usa `ORIGINE_PERF=1` no servidor, sem registrar dados privados.


## Notificações Web Push

O portal possui ativação opcional por aparelho, quatro preferências e avisos de uso, estorno, saldo baixo e vencimento. Consulte [docs/web-push-setup.md](docs/web-push-setup.md) para a migration, VAPID, variáveis e agendamento obrigatório. A implantação externa ainda precisa ser configurada; nenhum push real foi enviado nos testes.
