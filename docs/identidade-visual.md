# Identidade Origine Pacotes

A fonte aprovada está em `assets/brand/origine-aprovada.png` (1254 × 1254). Não é servida ao navegador. Nenhuma fonte, vetor ou desenho substitui a arte original.

## Exportação

`node scripts/export-brand.mjs` usa o Sharp instalado com Next.js para recortar a assinatura completa e o símbolo. Preserva os pixels interiores e a textura; recupera a cobertura das bordas para remover o fundo creme sem halo. WebP sem perdas para a interface; PNG para instalação e notificações; ICO com PNGs RGBA de 16, 32 e 48 px. Não ampliar a fonte para usos maiores que a resolução original.

- `public/brand/origine-logo-v1.webp`: assinatura completa transparente, 640 × 568.
- `public/brand/origine-symbol-v1.webp`: símbolo transparente, 153 × 160.
- `public/icons/origine-{192,512}-v1.png`: símbolo sobre creme opaco, propósito `any`.
- `public/icons/origine-maskable-{192,512}-v1.png`: símbolo inteiro dentro do círculo seguro central (raio de 40% da dimensão, https://www.w3.org/TR/appmanifest/#icon-masks).
- `public/icons/origine-apple-180-v1.png`: instalação Apple, 180 × 180, creme opaco.
- `public/icons/origine-badge-96-v1.png`: silhueta branca com transparência e mecha vazada. A apresentação de icon/badge depende do sistema operacional.
- `public/icons/push-{192,512}.png`: compatibilidade com referências antigas, agora com a arte aprovada.
- `src/app/favicon.ico` e `src/app/icon.png`: convenções automáticas Next; o PNG também é referenciado explicitamente nos metadados. O Apple touch icon tem referência explícita de 180 px. Não adicionar versões antigas em segmentos de rotas.

O componente `Brand` usa a assinatura completa na autenticação, portal e menu lateral; `compact` usa só o símbolo no cabeçalho móvel e nos cartões decorativos do login. A base creme em superfícies escuras mantém a arte grafite original legível. Os tokens decorativos usam creme #f7f4ee, grafite #2f2b2f e terracota #c37a65, amostrados da imagem, que contém pequenas variações de textura. As cores funcionais de botões e estados continuam separadas para manter contraste.

## Verificação

```powershell
node scripts/check-brand.mjs
npm test
npm run lint
npm run build
npx tsc --noEmit
npm run start -- --port 3117 --hostname 127.0.0.1
# Em outro terminal, depois de Ready:
node scripts/preview-brand.mjs
```

O preview testa HTTP no build de produção local e salva 14 screenshots em `test-results/branding`: login profissional e do cliente em desktop/tablet/mobile, claro/escuro; e uma composição inerte da navegação com o Brand e CSS reais. Essa composição não autentica nem acessa dados privados. Use `BRAND_QA_URL` para outro endereço. Não envia notificações, não cria assinaturas e não escreve no banco.

O verificador de arquivos confere dimensões, opacidade, área segura circular, badge monocromático e transparência dos arquivos da interface. Para mudanças futuras no conteúdo, incrementar o sufixo v1 e atualizar referências. O service worker continua com seu escopo, validações, vínculo de conta, destinos e política de atualização; apenas os caminhos de icon/badge mudaram.

## Depois do deploy

Conferir `/login`, `/cliente/login`, o menu e portal autenticados nos dois temas; inspecionar `/manifest.webmanifest`, links `icon`/`apple-touch-icon` do HTML e imagens em `/icons/`. Verificar em DevTools que `/sw.js` foi atualizado e aponta para o novo icon/badge. A identidade de instalação permanece `id: /cliente`, `start_url: /cliente`, `scope: /`, nome Origine Pacotes.

Ícones instalados podem continuar no cache do sistema. No iPhone, conferir primeiro a prévia de Adicionar à Tela de Início no Safari. Uma instalação antiga pode exigir remover o atalho e adicionar novamente para atualizar o ícone (https://web.dev/learn/pwa/update). Isso pode exigir novo login e nova ativação das notificações; não remover uma instalação antes de ter credenciais disponíveis. Não há código para excluir assinaturas ou mudar chaves VAPID nesta alteração. A exibição real no iOS e em notificações exige validação no dispositivo após o deploy.
