# Guia de Configuração Google Drive API (`Silia AI/`)

Este documento explica como configurar a integração com o **Google Drive** para que a Silia AI salve automaticamente os **Briefings Executáveis (`.docx`)** e o histórico de sessões na sua conta Google Drive dentro da estrutura de pastas:

```text
Silia AI/
├── Sessions/
├── Briefings/
├── Knowledge Base/
└── Reference Assets/
```

---

## 1. Criar Credenciais OAuth2 no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) no mesmo projeto onde ativou a **Google Drive API**.
2. Vá em **APIs & Services > OAuth consent screen**:
   - Escolha **External** (ou Internal se usar Google Workspace).
   - Preencha o nome do app (`LWX Lab Silia AI`) e seu e-mail.
   - Em **Test users**, adicione o seu próprio e-mail do Google Drive.
3. Vá em **APIs & Services > Credentials** e clique em **Create Credentials > OAuth client ID**:
   - **Application type:** `Web application`
   - **Name:** `Silia Drive OAuth Client`
   - Em **Authorized redirect URIs**, adicione: `https://developers.google.com/oauthplayground`
4. Copie o **Client ID** e o **Client Secret** gerados.

---

## 2. Gerar o Refresh Token no OAuth2 Playground

1. Acesse o [Google OAuth2 Playground](https://developers.google.com/oauthplayground).
2. Clique no ícone de **engrenagem (⚙️)** no canto superior direito:
   - Marque a opção **Use your own OAuth credentials**.
   - Cole o seu **OAuth Client ID** e **OAuth Client Secret**.
3. Na lista de escopos (Step 1), digite ou selecione:
   - `https://www.googleapis.com/auth/drive.file`
4. Clique em **Authorize APIs** e faça login com a sua conta Google.
5. No **Step 2**, clique em **Exchange authorization code for tokens** e copie o **`Refresh token`**.

---

## 3. Variáveis de Ambiente (`.env` e Render)

Adicione as variáveis abaixo no seu `.env` ou no painel **Environment** do Render:

```env
GOOGLE_DRIVE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=seu-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=seu-refresh-token
GOOGLE_DRIVE_ROOT_FOLDER_NAME=Silia AI
# Opcional: se você já criou a pasta "Silia AI" manualmente no Drive, cole o ID dela aqui:
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

---

## 4. Comportamento Resiliente

- Quando as credenciais acima estão configuradas, [`src/silia/storage.ts`](../../src/silia/storage.ts) encontra ou cria automaticamente a pasta `Silia AI/Briefings` e faz upload multipart do arquivo `.docx` assim que o cliente clica em **`Gostei dessa ideia`**, anexando também o link direto do Drive na mensagem e no modal de orçamento (`siliaToBriefing`).
- Quando as credenciais ainda não estão configuradas, o arquivo `.docx` **continua sendo gerado normalmente**, salvo em `data/briefings/` e entregue diretamente como anexo no Discord sem interromper o atendimento!
