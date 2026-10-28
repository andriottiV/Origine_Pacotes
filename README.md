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
