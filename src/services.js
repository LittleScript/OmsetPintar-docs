import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager    from 'expo-task-manager';
import * as Notifications  from 'expo-notifications';
import * as SecureStore    from 'expo-secure-store';
import * as WebBrowser     from 'expo-web-browser';

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GDRIVE_TOKEN_KEY, GDRIVE_REFRESH_KEY, GDRIVE_EXPIRY_KEY,
  GDRIVE_LAST_BACKUP_KEY, GDRIVE_HOUR_KEY, GDRIVE_TASK_NAME,
  NOTIF_TASK_ID, APP_VER, SCHEMA_VER,
} from './constants';
import { getDb, assembleData } from './db';
import { todayStr } from './utils';

// ─── GOOGLE DRIVE AUTH ────────────────────────────────────────────────────────
export async function refreshGdriveToken() {
  const refreshToken = await SecureStore.getItemAsync(GDRIVE_REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(GOOGLE_ANDROID_CLIENT_ID)}&grant_type=refresh_token`,
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return false;
    await SecureStore.setItemAsync(GDRIVE_TOKEN_KEY, data.access_token);
    await SecureStore.setItemAsync(GDRIVE_EXPIRY_KEY,
      String(Date.now() + (data.expires_in || 3600) * 1000));
    return true;
  } catch(e) { return false; }
}

export async function isGdriveTokenValid() {
  const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
  if (!token) return false;
  const expiry = await SecureStore.getItemAsync(GDRIVE_EXPIRY_KEY);
  if (!expiry) return true;
  if (Date.now() < parseInt(expiry, 10) - 60_000) return true;
  return refreshGdriveToken();
}

// ─── GOOGLE DRIVE UPLOAD ─────────────────────────────────────────────────────
export async function uploadToDrive(accessToken, payload) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1. Cari/buat folder OmsetKu Backup
  const qFolder = encodeURIComponent(`name='OmsetKu Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFolder}&fields=files(id)`, { headers });
  const folderData = await folderRes.json();
  let folderId = folderData.files?.[0]?.id;

  if (!folderId) {
    const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OmsetKu Backup', mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = (await cr.json()).id;
  }

  // Gunakan nama file tetap per hari — satu file per hari, tidak berlipat-lipat
  const filename = `omsetku-backup-${todayStr()}.json`;
  const content  = JSON.stringify(payload, null, 2);
  const boundary = 'omsetku_boundary';

  // 2. Cek apakah file dengan nama ini sudah ada di folder
  const qFile   = encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`);
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFile}&fields=files(id)`, { headers });
  const fileData = await fileRes.json();
  const existingId = fileData.files?.[0]?.id;

  if (existingId) {
    // 3a. File sudah ada hari ini → UPDATE (PATCH) isi file, tidak buat file baru
    const patchBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({}), // metadata kosong (tidak ubah nama)
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const patchRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: patchBody,
      }
    );
    if (!patchRes.ok) throw new Error(`Drive update failed: ${patchRes.status}`);
  } else {
    // 3b. File belum ada → CREATE baru
    const postBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: filename, parents: [folderId] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const postRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: postBody,
      }
    );
    if (!postRes.ok) throw new Error(`Drive upload failed: ${postRes.status}`);
  }
}

// ─── NOTIFIKASI ───────────────────────────────────────────────────────────────
// Notifikasi cerdas: hanya tampil jika belum ada transaksi hari ini
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    if (notification.request.identifier === NOTIF_TASK_ID) {
      try {
        const db  = await getDb();
        const d   = new Date();
        const tod = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const row = await db.getFirstAsync(
          `SELECT COUNT(*) as cnt FROM transactions WHERE transaction_date=? AND deleted_at IS NULL`, [tod]
        );
        const hadTx = (row?.cnt || 0) > 0;
        return { shouldShowAlert: !hadTx, shouldPlaySound: !hadTx, shouldSetBadge: false };
      } catch(e) {}
    }
    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
  },
});

export async function scheduleReminder(hour, forceReschedule = false) {
  if (!forceReschedule) {
    const existing = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    if (existing.some(n => n.identifier === NOTIF_TASK_ID)) return;
  }
  await Notifications.cancelScheduledNotificationAsync(NOTIF_TASK_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_TASK_ID,
    content: {
      title: '📊 OmsetKu',
      body:  'Jangan lupa catat omset hari ini!',
      sound: true,
    },
    trigger: { type: 'daily', hour, minute: 0 },
  });
}

export async function cancelReminder() {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_TASK_ID).catch(() => {});
}

// ─── BACKGROUND TASK (Google Drive auto-backup) ───────────────────────────────
TaskManager.defineTask(GDRIVE_TASK_NAME, async () => {
  try {
    const tokenValid = await isGdriveTokenValid();
    if (!tokenValid) return BackgroundFetch.BackgroundFetchResult.Failed;
    const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
    if (!token)  return BackgroundFetch.BackgroundFetchResult.NoData;
    const prefHour = parseInt(await SecureStore.getItemAsync(GDRIVE_HOUR_KEY) || '23', 10);
    const now = new Date();
    if (now.getHours() !== prefHour || now.getMinutes() >= 15) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const last = await SecureStore.getItemAsync(GDRIVE_LAST_BACKUP_KEY);
    if (last && Date.now() - parseInt(last) < 23 * 60 * 60 * 1000) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const db      = await getDb();
    const appData = await assembleData(db);
    await uploadToDrive(token, { schemaVersion: SCHEMA_VER, appVersion: APP_VER, exportedAt: now.toISOString(), data: appData });
    await SecureStore.setItemAsync(GDRIVE_LAST_BACKUP_KEY, String(Date.now()));
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch(e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// WebBrowser.maybeCompleteAuthSession() dipanggil di App.js langsung
