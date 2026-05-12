# Deploy do LWX Lab Bot

## Melhor alvo gratuito

Use Northflank no plano Sandbox. Ele e uma opcao melhor que Vercel para este bot porque o Discord Gateway funciona com uma conexao WebSocket persistente, enquanto Vercel Functions tem limite de duracao por request. Northflank informa no plano Sandbox: always-on compute, sem sleep, 2 servicos gratis.

Fontes:

- Discord Gateway: https://docs.discord.com/developers/events/gateway
- Vercel Functions Limits: https://vercel.com/docs/functions/limitations
- Northflank Pricing: https://northflank.com/pricing
- Northflank Build and Deploy: https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code

## Variaveis obrigatorias

Configure estas variaveis no painel do host:

```env
DISCORD_TOKEN=token_do_bot
GUILD_ID=id_do_servidor
OPENAI_API_KEY=sua_chave_se_usar_openai
GEMINI_API_KEY=sua_chave_se_usar_gemini
```

O cargo Support ja esta fixo no codigo como `1441752196797435944`, conforme configurado para o servidor.

## Deploy na Northflank

1. Suba este projeto para um repositorio GitHub privado ou publico.
2. Crie uma conta em https://northflank.com.
3. Crie um novo projeto.
4. Crie um servico do tipo `combined service`.
5. Selecione o repositorio e a branch.
6. Em build options, escolha `Dockerfile`.
7. Adicione as variaveis de ambiente.
8. Nao precisa expor porta publica; este bot trabalha conectado ao Discord.
9. Crie o servico e acompanhe os logs.

## Teste local antes do deploy

```bash
npm test
npm run typecheck
npm start
```

Se os paineis fixos ja existirem no servidor, o bot tenta editar as mensagens antigas. Se alguma mensagem tiver sido apagada, ele cria outra e salva o ID em `data/runtime/state.json`.
