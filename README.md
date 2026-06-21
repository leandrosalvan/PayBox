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

### Desenvolvimento local

1. Crie um projeto em https://console.cloud.google.com/
2. Configure a tela de consentimento OAuth
3. Crie credenciais OAuth 2.0 para Web
4. Em **URIs de redirecionamento autorizadas**, adicione:
   - `http://localhost:3000/api/auth/callback/google`
5. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env.local`

### Produção (Render)

1. Acesse as credenciais OAuth 2.0 do projeto no Google Cloud Console
2. Em **URIs de redirecionamento autorizadas**, adicione também:
   - `https://paybox-8j56.onrender.com/api/auth/callback/google`
3. Verifique se a variável `NEXTAUTH_URL` no Render está com a URL exata do deploy:
   - `https://paybox-8j56.onrender.com`
4. Confirme que `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão preenchidos nas variáveis de ambiente do Render

## Deploy no Render

A forma mais fácil é usar o **Blueprint** do Render com o arquivo `render.yaml`:

1. Faça push do projeto para o GitHub.
2. No Render, crie um **Blueprint** e conecte o repositório.
3. O Render criará o Web Service (`paybox`).
4. Crie um banco PostgreSQL no **Neon** (ou outro) e copie a `DATABASE_URL`.
5. Após o primeiro deploy, vá em **Environment** do serviço e adicione:
   - `DATABASE_URL` (connection string do Neon)
   - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (opcional)
   - `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`, `FROM_EMAIL`
   - Ajuste `NEXTAUTH_URL` para a URL exata do seu app no Render (ex: `https://paybox-8j56.onrender.com`)
6. Redeploy o serviço.

> O arquivo `render.yaml` já define o build, start e `NEXTAUTH_SECRET` automático.
> O build converte o Prisma para PostgreSQL e já aplica o schema no banco (Neon).

Deploy manual (alternativa):
- **Build command:** `bash -c "npm install && sed -i 's/provider = \"sqlite\"/provider = \"postgresql\"/g' prisma/schema.prisma && npx prisma@5.22.0 generate && npx prisma@5.22.0 db push --accept-data-loss && npm run build"`
- **Start command:** `npm start`

## Compartilhamento de carteira

Cada carteira possui um link de convite único. Em **Configurações da carteira**, use o botão do **WhatsApp** para enviar diretamente ou **Copiar** o link para qualquer outro meio. Quem acessar o link e entrar na conta passa a fazer parte da carteira.

## Licença

MIT
