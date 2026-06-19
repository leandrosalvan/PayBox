# PayBox

Web app PWA para controle de despesas compartilhado. Cada carteira pode ser compartilhada via link com outras pessoas, permitindo que todos lancem e acompanhem os gastos em tempo real.

## Funcionalidades

- Cadastro e login com e-mail/senha ou Google
- Criação de carteiras de despesas
- Convite por link automático por carteira (WhatsApp / Copiar)
- Múltiplos membros com salários configuráveis
- Modo de salários: conjuntos ou separados
- CRUD de despesas com categorias
- Despesas fixas auto-renováveis
- Despesas parceladas
- Marcar como pago, quem pagou, atrasados
- Relatórios mensais com gráficos por categoria e evolução
- Suporte a 5 idiomas e 5 moedas
- PWA (instalável no celular)

## Tecnologias

- Next.js 14 (Pages Router)
- Prisma + SQLite (desenvolvimento) / PostgreSQL (produção)
- NextAuth.js (credentials + Google)
- Tailwind CSS
- Recharts
- Nodemailer + Brevo SMTP

## Rodar localmente

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Acesse http://localhost:3000

## Variáveis de ambiente

Copie `.env.local` para `.env` e preencha:

```
DATABASE_URL="file:./dev.db?connection_limit=1"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-in-production"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

BREVO_SMTP_HOST="smtp-relay.brevo.com"
BREVO_SMTP_PORT="587"
BREVO_SMTP_USER=""
BREVO_SMTP_PASS=""
FROM_EMAIL="noreply@seudominio.com"
```

Para envio de e-mails (redefinição de senha), configure uma conta de remetente no Brevo e use um e-mail genérico.

## Login com Google

1. Crie um projeto em https://console.cloud.google.com/
2. Configure a tela de consentimento OAuth
3. Crie credenciais OAuth 2.0 para Web
4. Adicione `http://localhost:3000/api/auth/callback/google` nas URIs autorizadas
5. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`

## Deploy no Render

A forma mais fácil é usar o **Blueprint** do Render com o arquivo `render.yaml`:

1. Faça push do projeto para o GitHub.
2. No Render, crie um **Blueprint** e conecte o repositório.
3. O Render criará automaticamente:
   - O banco PostgreSQL (`paybox-db`)
   - O Web Service (`paybox`)
4. Após o deploy, adicione manualmente as variáveis sensíveis em **Environment**:
   - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (opcional)
   - `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`, `FROM_EMAIL`
   - Ajuste `NEXTAUTH_URL` para a URL do seu app no Render
5. Redeploy o serviço.

> O arquivo `render.yaml` já define o build, start e `NEXTAUTH_SECRET` automático.
> O script `scripts/render-build.sh` converte o Prisma para PostgreSQL durante o deploy.

Deploy manual (alternativa):
- **Build command:** `bash scripts/render-build.sh`
- **Start command:** `npm start`

## Compartilhamento de carteira

Cada carteira possui um link de convite único. Em **Configurações da carteira**, use o botão do **WhatsApp** para enviar diretamente ou **Copiar** o link para qualquer outro meio. Quem acessar o link e entrar na conta passa a fazer parte da carteira.

## Licença

MIT
