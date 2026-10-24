# Guia de Configuração Google Cloud & Vertex AI (`gemini-3.8-flash`)

Este documento detalha passo a passo como ativar o modelo principal **`gemini-3.8-flash`** (e os fallbacks `gemini-3.6-flash` e `gemini-3.5-flash-lite`) via **Google Cloud / Vertex AI / Gemini Enterprise Agent Platform** usando o SDK oficial `@google/genai` e **Application Default Credentials (ADC)**.

---

## 1. Criar ou Selecionar o Projeto no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto novo (ex.: `lwx-lab-silia-ai`) ou selecione um projeto existente.
3. Anote o **Project ID** (ex.: `lwx-lab-silia-ai-41920`). Ele será usado na variável `GOOGLE_CLOUD_PROJECT`.
4. Certifique-se de que o faturamento (Billing) ou os créditos gratuitos do Google Cloud (ex.: US$ 300 de Free Trial) estejam vinculados ao projeto.

---

## 2. Habilitar as APIs Necessárias

No menu **APIs & Services > Library** (ou via Cloud Shell / `gcloud`), habilite:

- **Vertex AI API** (`aiplatform.googleapis.com`)
- **Cloud Firestore API** (`firestore.googleapis.com`) — opcional para persistência operacional em nuvem
- **Google Drive API** (`drive.googleapis.com`) — para envio automático dos briefings `.docx`

Comando equivalente via Google Cloud CLI:

```bash
gcloud services enable aiplatform.googleapis.com firestore.googleapis.com drive.googleapis.com --project=SEU_PROJECT_ID
```

---

## 3. Autenticação Local (Desenvolvimento) via ADC

Para testar localmente na sua máquina Windows/Linux/macOS sem precisar baixar chaves JSON:

1. Instale o [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install).
2. Execute no terminal:

```bash
gcloud auth application-default login
gcloud config set project SEU_PROJECT_ID
```

3. No seu arquivo `.env` local, defina:

```env
GOOGLE_CLOUD_PROJECT=SEU_PROJECT_ID
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
SILIA_PRIMARY_MODEL=gemini-3.8-flash
SILIA_FALLBACK_MODEL_1=gemini-3.6-flash
SILIA_FALLBACK_MODEL_2=gemini-3.5-flash-lite
```

---

## 4. Autenticação em Produção no Render (Docker)

Como o bot roda em container Docker no **Render**, o método recomendado pelo Google Cloud para ambientes externos ao GCP é criar uma **Service Account** com permissões mínimas e montá-la como um **Secret File**:

### Passo 4.1: Criar a Service Account
1. No Google Cloud Console, acesse **IAM & Admin > Service Accounts**.
2. Clique em **Create Service Account**:
   - **Name:** `silia-vertex-runtime`
3. Conceda apenas as roles mínimas necessárias:
   - `Vertex AI User` (`roles/aiplatform.user`)
   - `Cloud Datastore User` (`roles/datastore.user`) — se usar Firestore
4. Na aba **Keys** da Service Account criada, clique em **Add Key > Create new key > JSON** e salve o arquivo no seu computador (nunca faça commit dele no Git!).

### Passo 4.2: Configurar no Render
1. Abra o painel do seu Web Service **`bot-lwx-lab`** no [Render Dashboard](https://dashboard.render.com/).
2. Vá em **Environment > Secret Files** e clique em **Add Secret File**:
   - **Filename:** `gcp-service-account.json`
   - **Contents:** Cole o conteúdo completo do JSON da Service Account.
3. Ainda em **Environment Variables**, adicione:
   - `GOOGLE_APPLICATION_CREDENTIALS` = `/etc/secrets/gcp-service-account.json`
   - `GOOGLE_CLOUD_PROJECT` = `SEU_PROJECT_ID`
   - `GOOGLE_CLOUD_LOCATION` = `global`
   - `GOOGLE_GENAI_USE_VERTEXAI` = `true`
   - `SILIA_PRIMARY_MODEL` = `gemini-3.8-flash`
   - `SILIA_FALLBACK_MODEL_1` = `gemini-3.6-flash`
   - `SILIA_FALLBACK_MODEL_2` = `gemini-3.5-flash-lite`

---

## 5. Regras Específicas do `gemini-3.8-flash` Implementadas no Código

De acordo com a documentação oficial consultada (`https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash`):

- O módulo [`src/silia/modelRouter.ts`](../../src/silia/modelRouter.ts) utiliza exclusivamente `thinking_level` (`LOW`, `MEDIUM` ou `HIGH`) e **jamais envia `MINIMAL`**.
- Parâmetros de amostragem legados (`temperature`, `top_p`, `top_k`) e parâmetros incompatíveis (`frequency_penalty`, `presence_penalty`, `candidate_count`) foram **removidos** das chamadas ao `gemini-3.8-flash`.
- O histórico conversacional passa por `sanitizeGemini3History()` para remover turnos vazios e garantir que a sequência nunca termine com o papel `model`.
