import fs from 'node:fs';
import path from 'node:path';
import type { SiliaCreativeSession } from './types.js';

const SESSIONS_FILE_PATH = path.resolve(process.cwd(), 'data', 'silia-sessions.json');
const memorySessions = new Map<string, SiliaCreativeSession>();
let initializedFromDisk = false;

function serializeSessionForDisk(session: SiliaCreativeSession): SiliaCreativeSession {
  return {
    ...session,
    proposals: session.proposals.map((p) => ({
      ...p,
      references: p.references.map((r) => {
        const { buffer: _buf, ...rest } = r;
        return rest;
      }),
    })),
  };
}

export function loadSessionsFromDisk(): Map<string, SiliaCreativeSession> {
  if (initializedFromDisk) {
    return memorySessions;
  }
  initializedFromDisk = true;

  try {
    if (fs.existsSync(SESSIONS_FILE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf8')) as Record<
        string,
        SiliaCreativeSession
      >;
      for (const [userId, session] of Object.entries(raw)) {
        if (session && typeof session.userId === 'string') {
          memorySessions.set(userId, session);
        }
      }
    }
  } catch (err) {
    console.warn('[SiliaStorage] Aviso ao ler data/silia-sessions.json:', err);
  }

  return memorySessions;
}

export function saveSessionsToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE_PATH), { recursive: true });
    const obj: Record<string, SiliaCreativeSession> = {};
    for (const [userId, session] of memorySessions.entries()) {
      obj[userId] = serializeSessionForDisk(session);
    }
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('[SiliaStorage] Aviso ao salvar data/silia-sessions.json:', err);
  }
}

export function getStoredSession(userId: string): SiliaCreativeSession | undefined {
  loadSessionsFromDisk();
  return memorySessions.get(userId);
}

export function upsertStoredSession(session: SiliaCreativeSession): void {
  loadSessionsFromDisk();
  session.updatedAt = Date.now();
  memorySessions.set(session.userId, session);
  saveSessionsToDisk();

  // Trigger non-blocking cloud sync if configured
  void syncSessionToFirestore(session).catch(() => undefined);
  void syncSessionToGoogleDrive(session).catch(() => undefined);
}

export function clearAllStoredSessionsForTests(): void {
  memorySessions.clear();
  initializedFromDisk = true;
  try {
    if (fs.existsSync(SESSIONS_FILE_PATH)) {
      fs.unlinkSync(SESSIONS_FILE_PATH);
    }
  } catch {
    // Ignore
  }
}

/**
 * Checks whether Google Drive OAuth2 credentials are configured.
 */
export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim(),
  );
}

async function getGoogleDriveAccessToken(): Promise<string | null> {
  if (!isGoogleDriveConfigured()) {
    return null;
  }

  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!.trim(),
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!.trim(),
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function ensureDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string,
): Promise<string | null> {
  try {
    const parentClause = parentId ? ` and '${parentId}' in parents` : '';
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false${parentClause}`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
      if (searchData.files?.[0]?.id) {
        return searchData.files[0].id;
      }
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });

    if (!createRes.ok) return null;
    const created = (await createRes.json()) as { id?: string };
    return created.id ?? null;
  } catch {
    return null;
  }
}

export async function uploadBriefingDocxToGoogleDrive(
  fileName: string,
  docxBuffer: Buffer,
): Promise<{ fileId?: string | undefined; webViewLink?: string | undefined }> {
  const accessToken = await getGoogleDriveAccessToken();
  if (!accessToken) {
    return {};
  }

  try {
    const rootFolderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim() || 'Silia AI';
    const rootId =
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ||
      (await ensureDriveFolder(accessToken, rootFolderName));
    const briefingsFolderId = rootId
      ? await ensureDriveFolder(accessToken, 'Briefings', rootId)
      : null;

    const boundary = `-------SiliaBoundary${Date.now()}`;
    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ...(briefingsFolderId ? { parents: [briefingsFolderId] } : {}),
    };

    const multipartHeader = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`,
      'utf8',
    );
    const multipartFooter = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const body = Buffer.concat([multipartHeader, docxBuffer, multipartFooter]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!res.ok) return {};
    const data = (await res.json()) as { id?: string; webViewLink?: string };
    return {
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch {
    return {};
  }
}

async function syncSessionToGoogleDrive(session: SiliaCreativeSession): Promise<void> {
  const accessToken = await getGoogleDriveAccessToken();
  if (!accessToken) return;

  try {
    const rootFolderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim() || 'Silia AI';
    const rootId =
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ||
      (await ensureDriveFolder(accessToken, rootFolderName));
    const sessionsFolderId = rootId ? await ensureDriveFolder(accessToken, 'Sessions', rootId) : null;

    const payload = Buffer.from(JSON.stringify(serializeSessionForDisk(session), null, 2), 'utf8');
    const fileName = `silia-session-${session.userId}.json`;
    const boundary = `-------SiliaSession${Date.now()}`;
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      ...(sessionsFolderId && !session.driveSessionFileId ? { parents: [sessionsFolderId] } : {}),
    };

    const multipartHeader = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      'utf8',
    );
    const multipartFooter = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const body = Buffer.concat([multipartHeader, payload, multipartFooter]);

    const url = session.driveSessionFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${session.driveSessionFileId}?uploadType=multipart&fields=id`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';

    const res = await fetch(url, {
      method: session.driveSessionFileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (res.ok) {
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        session.driveSessionFileId = data.id;
      }
    }
  } catch {
    // Ignore Drive background sync errors
  }
}

async function syncSessionToFirestore(session: SiliaCreativeSession): Promise<void> {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const collection = process.env.FIRESTORE_COLLECTION_PREFIX?.trim() || 'silia_sessions';
  if (!project || !process.env.FIRESTORE_ACCESS_TOKEN) {
    return;
  }

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(session.userId)}`;
    await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.FIRESTORE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          sessionId: { stringValue: session.sessionId },
          userId: { stringValue: session.userId },
          stage: { stringValue: session.stage },
          updatedAt: { integerValue: String(session.updatedAt) },
          payloadJson: { stringValue: JSON.stringify(serializeSessionForDisk(session)) },
        },
      }),
    });
  } catch {
    // Non-blocking Firestore sync
  }
}
