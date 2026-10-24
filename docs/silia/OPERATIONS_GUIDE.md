# Guia de Operação e Manutenção — Silia Creative Intelligence

Este guia reúne procedimentos práticos para operar, monitorar, testar e atualizar a **Silia AI** no **LWX Lab Bot**.

---

## 1. Comandos de Verificação e Testes

Antes de qualquer deploy para o Render, execute:

```bash
# 1. Verificar tipagem TypeScript de todo o projeto
npm run typecheck

# 2. Executar toda a suíte de testes automatizados (Vitest)
npm test
```

---

## 2. Onde os Arquivos São Salvos Localmente

- **Sessões Operacionais:** `data/silia-sessions.json` (garante que propostas ativas, histórico e chaves de idempotência sobrevivam a reinicializações).
- **Briefings `.docx` Gerados:** `data/briefings/Briefing-LWX-<slug>-<proposalId>.docx`.
- **Playbook e Prompts Editáveis:**
  - Metodologia: [`docs/silia/SILIA_CREATIVE_PLAYBOOK.md`](./SILIA_CREATIVE_PLAYBOOK.md)
  - Prompts por tarefa: `docs/silia/prompts/*.md`
  - Exemplos Few-Shot: [`docs/silia/examples/few-shot-proposals.json`](./examples/few-shot-proposals.json)

> **Dica:** Você pode editar os arquivos Markdown dentro de `docs/silia/prompts/` ou o `SILIA_CREATIVE_PLAYBOOK.md` a qualquer momento para refinar o estilo de direção de arte da Silia AI sem precisar alterar a lógica TypeScript!

---

## 3. Segurança e Higiene de Credenciais

- **Nunca grave chaves reais em arquivos versionados pelo Git.** Use sempre o arquivo `.env` local (ignorado pelo `.gitignore`) ou as **Environment Variables / Secret Files** do painel do Render.
- **Proteção SSRF Ativa:** O módulo [`src/silia/visualSearch.ts`](../../src/silia/visualSearch.ts) bloqueia automaticamente qualquer URL apontando para `localhost`, `127.0.0.1`, `169.254.169.254` (metadata cloud), faixas privadas RFC1918 (`10.x`, `172.16-31.x`, `192.168.x`) e protocolos locais como `file://`.
- **Idempotência de Botões:** Cada clique em `Gostei dessa ideia` ou `Prefiro outra ideia` registra a chave `<ação>:<proposalId>` em `session.processedInteractionKeys`, impedindo geração duplicada de documentos `.docx` caso o usuário clique várias vezes seguidas.
