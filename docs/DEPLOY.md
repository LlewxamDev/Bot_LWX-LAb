# 🚀 Guia de Hospedagem 100% Gratuita — `LWX Lab Bot`

## ❌ Por que a Vercel NÃO funciona para este Bot?
A **Vercel** é voltada para sites e funções *Serverless* sob requisição HTTP — ela desliga o processo após alguns segundos (`10s–60s` no plano Hobby).
Como o **LWX Lab Bot** ([`src/index.ts`](file:///c:/Users/Evandro/Downloads/LWX-Lab/src/index.ts)) utiliza **WebSocket persistente (Discord Gateway)** para manter o status *Rich Presence* girando, responder mensagens direto no `#🤖・silia-ai`, enviar boas-vindas ao vivo e limpar mensagens extras nos 8 canais de painel, na Vercel ele cairia poucos segundos após ligar.

---

## 🏆 As 4 Melhores Opções 100% Gratuitas (24/7)

| Plataforma | Pede Cartão? | Como Funciona no Plano Grátis | Recomendação |
| :--- | :---: | :--- | :--- |
| **1. Render.com + Cron-Job.org** | **Não** | Cria um *Web Service* gratuito conectado direto ao seu GitHub. Como adicionamos um servidor HTTP de *Healthcheck* em [`src/index.ts`](file:///c:/Users/Evandro/Downloads/LWX-Lab/src/index.ts#L461-L477) na variável `PORT`, basta colocar a URL no [cron-job.org](https://cron-job.org) (ping a cada 5 min) para ele nunca dormir! | ⭐ **Melhor opção sem cartão e com deploy automático pelo GitHub** |
| **2. Discloud / Shard Cloud** | **Não** | Hospedagens brasileiras focadas especificamente em Bots de Discord (`discord.js`). Basta enviar o `.zip` do projeto (sem `node_modules`). No plano gratuito pede apenas renovação periódica pelo painel/comando. | Ótima para bots brasileiros sem configurar Docker |
| **3. Wispbyte / KataBump** | **Não** | Painéis Pterodactyl gratuitos para bots Node.js / TypeScript 24/7. Você sobe os arquivos ou conecta o Git e deixa rodando sem cartão. | Muito boa se preferir painel estilo servidor dedicado |
| **4. Northflank (Sandbox) / Koyeb / Oracle Cloud Free** | **Sim** *(apenas verificação anti-bot, R$ 0 cobrado)* | **Northflank Sandbox** dá 2 serviços Docker gratuitos *Always-On* (sem sleep) usando nosso [`Dockerfile`](file:///c:/Users/Evandro/Downloads/LWX-Lab/Dockerfile). **Oracle Cloud Always Free** dá uma VPS inteira de graça para sempre. | ⭐ **Melhor opção caso você tenha um cartão virtual (Nubank/Inter) só para verificação** |

---

## 🔑 Variáveis de Ambiente Obrigatórias (`.env`)

Em qualquer uma das plataformas escolhidas, configure estas 3 variáveis principais no painel de *Environment Variables*:

```env
DISCORD_TOKEN=seu_token_do_bot
DISCORD_CLIENT_ID=1493072348868251758
DISCORD_GUILD_ID=1441608284061569209
```
*(Opcional: `GEMINI_API_KEY` ou `OPENAI_API_KEY` — lembrando que a **Silia AI** já possui motor gratuito em tempo real integrado em [`src/ai/chatbot.ts`](file:///c:/Users/Evandro/Downloads/LWX-Lab/src/ai/chatbot.ts) e funciona mesmo sem chaves pagas!)*

---

## 🛠️ Passo a Passo Rápido: Deploy no Render (100% Grátis e Sem Cartão)

1. Suba o código atualizado para o seu repositório no GitHub (`https://github.com/LlewxamDev/Bot_LWX-LAb`).
2. Crie uma conta gratuita em **[render.com](https://render.com)** (pode entrar com a própria conta do GitHub, sem cartão).
3. Clique em **New +** → **Web Service** e selecione o repositório `Bot_LWX-LAb`.
4. Configure:
   - **Runtime**: `Docker` (ele já usa automaticamente o [`Dockerfile`](file:///c:/Users/Evandro/Downloads/LWX-Lab/Dockerfile) do projeto) **ou** `Node` (Build Command: `npm install`, Start Command: `npm start`).
   - **Instance Type**: `Free`.
5. Em **Environment Variables**, adicione `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `DISCORD_GUILD_ID`.
6. Assim que o Render gerar a URL pública (ex.: `https://bot-lwx-lab.onrender.com`), crie uma conta gratuita no **[cron-job.org](https://cron-job.org)** e crie um Cronjob acessando essa URL a cada **5 minutos** — isso mantém o bot **acordado 24h por dia, 7 dias por semana**!
