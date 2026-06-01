/**
 * OmsetKu — App.js v4.5.0
 * Entry point: imports dari src/, render App component
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator, StatusBar, useColorScheme, Image, BackHandler, ToastAndroid, AppState } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as SecureStore      from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as AuthSession       from 'expo-auth-session';
import * as Google            from 'expo-auth-session/providers/google';
import * as Notifications     from 'expo-notifications';
import * as WebBrowser        from 'expo-web-browser';

// ── src/ foundations ─────────────────────────────────────────────────────────
import { ThemeContext, getStyles }      from './src/theme';
import {
  DARK_THEME, LIGHT_THEME, TABS,
  GDRIVE_TOKEN_KEY, GDRIVE_REFRESH_KEY, GDRIVE_EXPIRY_KEY,
  GDRIVE_EMAIL_KEY, GDRIVE_LAST_BACKUP_KEY, GDRIVE_HOUR_KEY,
  GDRIVE_TASK_NAME, NOTIF_TASK_ID,
  GOOGLE_ANDROID_CLIENT_ID, GDRIVE_REDIRECT_URI, GOOGLE_DISCOVERY,
  APP_VER, SCHEMA_VER,
} from './src/constants';
import { todayStr, getNorm, toIdr } from './src/utils';
import {
  getDb, initDb, assembleData,
  insertTransaction, updateTransaction,
  softDeleteTransaction, restoreTransaction,
  setupBusiness, updateSettings,
  addSales, deactivateSales,
  setOnboardingDone, addIgnoredTypoPair, mergeCustomerName,
} from './src/db';
import {
  isGdriveTokenValid, uploadToDrive,
  scheduleReminder, cancelReminder,
} from './src/services';

// ── screens ───────────────────────────────────────────────────────────────────
import OnboardingScreen from './src/screens/OnboardingScreen';
import SetupWizard      from './src/screens/SetupWizard';
import InputScreen      from './src/screens/InputScreen';
import DashboardScreen  from './src/screens/DashboardScreen';
import HistoryScreen    from './src/screens/HistoryScreen';
import RankingScreen    from './src/screens/RankingScreen';
import CustomersScreen  from './src/screens/CustomersScreen';
import SettingsModal    from './src/screens/SettingsModal';

// services.js sudah jalankan Notifications.setNotificationHandler + TaskManager.defineTask
// WebBrowser.maybeCompleteAuthSession perlu dipanggil di entry point
WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [dbReady,  setDbReady]  = useState(false);
  const [tab,      setTab]      = useState('input');
  const [showSett, setShowSett] = useState(false);
  const inputDirtyRef = useRef(false); // diisi oleh InputScreen bila ada input belum tersimpan
  const [saveState,setSaveState]= useState('idle');
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('dark');

  const currentTheme = useMemo(() => {
    const isDark = themeMode === 'system' ? (systemScheme !== 'light') : (themeMode === 'dark');
    return isDark ? DARK_THEME : LIGHT_THEME;
  }, [themeMode, systemScheme]);

  const C = currentTheme;
  const dbRef = useRef(null);

  // Init DB + load data
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        dbRef.current = await getDb();
        const loaded = await assembleData(dbRef.current);
        // Apply saved theme
        const savedTheme = loaded?.themeMode || 'dark';
        setThemeMode(savedTheme);
        // Re-schedule notifikasi jika aktif (hilang setelah reinstall)
        if (loaded?.notifEnabled) {
          scheduleReminder(loaded.notifHour ?? 20).catch(() => {});
        }
        setData(loaded || { isSetupComplete: false, salesList: [], transactions: [], companyName: '', bonConfig:{prefix:'INV',separator:'-',digitLength:5}, dateFormat:'dd/mm/yyyy', activeYear:new Date().getFullYear(), lastDate:todayStr(), lastSales:'', nextSeq:1 });
        setDbReady(true);
      } catch(e) {
        Alert.alert('Database Error', String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reloadData = useCallback(async () => {
    if (!dbRef.current) return;
    const fresh = await assembleData(dbRef.current);
    if (fresh) setData(fresh);
  }, []);

  // ── Google Drive Backup ─────────────────────────────────────
  const [driveEmail,       setDriveEmail]       = useState('');
  const [driveLastSync,    setDriveLastSync]    = useState('');
  const [driveSyncing,     setDriveSyncing]     = useState(false);
  const [driveTokenExpired,setDriveTokenExpired]= useState(false);

  // Native Android OAuth — PKCE flow (tanpa client secret, dapat refresh_token)
  // Butuh Android OAuth client ID dengan SHA-1 EAS → lihat instruksi di konstanta atas
  const [gRequest, gResponse, gPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId:    GOOGLE_ANDROID_CLIENT_ID,
      redirectUri: GDRIVE_REDIRECT_URI,
      scopes:      ['https://www.googleapis.com/auth/drive.file', 'email', 'profile'],
      responseType:'code',
      usePKCE:     true,
      extraParams: { access_type: 'offline', prompt: 'consent' }, // agar dapat refresh_token
    },
    GOOGLE_DISCOVERY
  );

  // Load stored drive state on startup + cek token validity
  useEffect(() => {
    (async () => {
      try {
        const email = await SecureStore.getItemAsync(GDRIVE_EMAIL_KEY);
        const last  = await SecureStore.getItemAsync(GDRIVE_LAST_BACKUP_KEY);
        if (email) {
          setDriveEmail(email);
          // Re-register background backup task — hilang setelah reinstall/update app
          try {
            await BackgroundFetch.registerTaskAsync(GDRIVE_TASK_NAME, {
              minimumInterval: 15 * 60,
              stopOnTerminate: false,
              startOnBoot: true,
            });
          } catch(_) {} // task sudah registered dari sesi sebelumnya — abaikan
          const valid = await isGdriveTokenValid();
          setDriveTokenExpired(!valid);
        }
        if (last) {
          const d = new Date(parseInt(last));
          const isToday = d.toDateString() === new Date().toDateString();
          setDriveLastSync(
            isToday
              ? d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
              : d.toLocaleDateString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
          );
        }
      } catch(_) {} // jangan crash startup jika SecureStore / token check gagal
    })();
  }, []);

  // Re-cek token saat app kembali ke foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && driveEmail) {
        isGdriveTokenValid().then(valid => setDriveTokenExpired(!valid)).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [driveEmail]);

  // Handle OAuth response — tukar auth code dengan access + refresh token (PKCE)
  useEffect(() => {
    if (gResponse?.type !== 'success') return;
    (async () => {
      try {
        const { code } = gResponse.params;
        if (!code) throw new Error('Tidak ada auth code dari Google');

        // Tukar code dengan token (PKCE — tanpa client secret)
        const body = [
          `code=${encodeURIComponent(code)}`,
          `client_id=${encodeURIComponent(GOOGLE_ANDROID_CLIENT_ID)}`,
          `redirect_uri=${encodeURIComponent(GDRIVE_REDIRECT_URI)}`,
          `grant_type=authorization_code`,
          `code_verifier=${encodeURIComponent(gRequest?.codeVerifier || '')}`,
        ].join('&');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        const tokens = await tokenRes.json();
        if (!tokenRes.ok || !tokens.access_token) {
          throw new Error(tokens.error_description || tokens.error || 'Token exchange gagal');
        }

        // Simpan access token + expiry
        await SecureStore.setItemAsync(GDRIVE_TOKEN_KEY, tokens.access_token);
        await SecureStore.setItemAsync(GDRIVE_EXPIRY_KEY,
          String(Date.now() + (tokens.expires_in || 3600) * 1000));

        // Simpan refresh token — auto-renew, tidak perlu reconnect manual lagi
        if (tokens.refresh_token) {
          await SecureStore.setItemAsync(GDRIVE_REFRESH_KEY, tokens.refresh_token);
        }

        setDriveTokenExpired(false);

        // Ambil email user
        const infoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const info = await infoRes.json();
        await SecureStore.setItemAsync(GDRIVE_EMAIL_KEY, info.email || '');
        setDriveEmail(info.email || '');

        // Register background task
        try {
          await BackgroundFetch.registerTaskAsync(GDRIVE_TASK_NAME, {
            minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true,
          });
        } catch(_) {}

        Alert.alert('✅ Google Drive Terhubung', `Backup otomatis aktif untuk:\n${info.email}`);
      } catch(e) {
        Alert.alert('Gagal Hubungkan Drive', String(e));
      }
    })();
  }, [gResponse]);

  const handleManualDriveBackup = async () => {
    // Cek apakah token masih valid
    const valid = await isGdriveTokenValid();
    if (!valid) {
      Alert.alert(
        '⚠️ Sesi Expired',
        'Token Google Drive sudah kadaluarsa. Silakan reconnect untuk melanjutkan backup.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: '🔗 Reconnect', onPress: () => gRequest && gPromptAsync() },
        ]
      );
      return;
    }
    const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
    if (!token) { Alert.alert('','Hubungkan Google Drive dulu di Settings'); return; }
    try {
      setDriveSyncing(true);
      const db      = await getDb();
      const appData = await assembleData(db);
      await uploadToDrive(token, { schemaVersion: SCHEMA_VER, appVersion: APP_VER, exportedAt: new Date().toISOString(), data: appData });
      await SecureStore.setItemAsync(GDRIVE_LAST_BACKUP_KEY, String(Date.now()));
      const now = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
      setDriveLastSync(now);
      Alert.alert('✅ Backup Berhasil', `Data tersimpan ke Google Drive\nJam ${now}`);
    } catch(e) {
      Alert.alert('Backup Gagal', String(e));
    } finally {
      setDriveSyncing(false);
    }
  };

  const handleDisconnectDrive = () => {
    Alert.alert('Putus Google Drive?', 'Backup otomatis akan berhenti.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Putuskan', style: 'destructive', onPress: async () => {
          await SecureStore.deleteItemAsync(GDRIVE_TOKEN_KEY);
          await SecureStore.deleteItemAsync(GDRIVE_REFRESH_KEY).catch(() => {});
          await SecureStore.deleteItemAsync(GDRIVE_EXPIRY_KEY).catch(() => {});
          await SecureStore.deleteItemAsync(GDRIVE_EMAIL_KEY);
          await BackgroundFetch.unregisterTaskAsync(GDRIVE_TASK_NAME).catch(() => {});
          setDriveEmail('');
          setDriveLastSync('');
        }},
      ]
    );
  };

  // ── PIN Lock / Fingerprint ──────────────────────────────────
  const [isLocked, setIsLocked]     = useState(false);
  const pinInitialized              = useRef(false);
  const lastBackgroundTime          = useRef(null);

  // Set lock saat pertama data load (jika pin enabled)
  useEffect(() => {
    if (dbReady && data && !pinInitialized.current) {
      pinInitialized.current = true;
      if (data.pinLockEnabled) setIsLocked(true);
    }
  }, [dbReady, data]);

  // Lock kembali jika app background > 30 detik
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastBackgroundTime.current = Date.now();
      } else if (nextState === 'active') {
        if (data?.pinLockEnabled && lastBackgroundTime.current) {
          if (Date.now() - lastBackgroundTime.current > 30000) setIsLocked(true);
        }
        lastBackgroundTime.current = null;
      }
    });
    return () => sub.remove();
  }, [data?.pinLockEnabled]);

  const handleAuthenticate = useCallback(async () => {
    try {
      const hasHw   = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHw || !enrolled) { setIsLocked(false); return; }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:          'Verifikasi untuk masuk OmsetKu',
        fallbackLabel:          'Gunakan PIN HP',
        cancelLabel:            'Batal',
        disableDeviceFallback:  false,
      });
      if (result.success) setIsLocked(false);
    } catch(e) { setIsLocked(false); }
  }, []);

  // Auto-prompt saat lock screen muncul
  useEffect(() => {
    if (isLocked) handleAuthenticate();
  }, [isLocked]);

  // Pindah tab dengan cek unsaved input
  const handleTabChange = (newTab) => {
    if (tab === 'input' && newTab !== 'input' && inputDirtyRef.current) {
      Alert.alert(
        'Input Belum Tersimpan',
        'Ada nama / nominal yang belum disimpan. Yakin mau pindah?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Pindah Saja', style: 'destructive', onPress: () => setTab(newTab) },
        ]
      );
      return;
    }
    setTab(newTab);
  };

  // Double back press to exit — tekan 2x dalam 2 detik
  const backPressedOnce = useRef(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backPressedOnce.current) {
        BackHandler.exitApp();
        return true;
      }
      backPressedOnce.current = true;
      ToastAndroid.show('Tekan sekali lagi untuk keluar', ToastAndroid.SHORT);
      setTimeout(() => { backPressedOnce.current = false; }, 2000);
      return true;
    });
    return () => sub.remove();
  }, []);

  // ─── handlers ──────────────────────────────────────────────
  const handleOnboardingDone = useCallback(async () => {
    await setOnboardingDone(dbRef.current);
    await reloadData();
  }, [reloadData]);

  const handleSetupComplete = useCallback(async (setup) => {
    setSaveState('saving');
    try {
      await setupBusiness(dbRef.current, setup);
      await reloadData();
      setSaveState('saved');
    } catch(e) { setSaveState('error'); Alert.alert('Error', String(e)); }
    setTimeout(() => setSaveState('idle'), 2000);
  }, [reloadData]);

  const handleSave = useCallback(async (tx) => {
    setSaveState('saving');
    try {
      await insertTransaction(dbRef.current, tx);
      await reloadData();
      setSaveState('saved');
    } catch(e) { setSaveState('error'); Alert.alert('Error', String(e)); }
    setTimeout(() => setSaveState('idle'), 2000);
  }, [reloadData]);

  const handleDelete = useCallback(async (id) => {
    await softDeleteTransaction(dbRef.current, id);
    await reloadData();
  }, [reloadData]);

  const handleEdit = useCallback(async (id, fields) => {
    const originalTx = data?.transactions?.find(t => t.id === id);
    await updateTransaction(dbRef.current, id, fields, originalTx);
    await reloadData();
  }, [data, reloadData]);

  const handleRestore = useCallback(async (id) => {
    await restoreTransaction(dbRef.current, id);
    await reloadData();
  }, [reloadData]);

  const handleYearChange = useCallback(async (year) => {
    await updateSettings(dbRef.current, { activeYear: year });
    await reloadData();
  }, [reloadData]);

  const handleRestoreJson = useCallback(async (txns, salesNames) => {
    const db  = dbRef.current;
    const now = new Date().toISOString();
    const currentSalesList = [...(data?.salesList || [])];
    // Buat sales yang belum ada
    for (const s of salesNames) {
      if (!currentSalesList.includes(s)) {
        await addSales(db, s, null, currentSalesList.length);
        currentSalesList.push(s);
      }
    }
    // Insert transaksi
    let inserted = 0;
    for (const t of txns) {
      const date         = t.date || t.transaction_date || '';
      const customerName = (t.customerName || t.customer_name || '').trim();
      const bonNumber    = t.bonNumber || t.bon_number || '';
      const bonSeq       = t.bonSeq || t.bon_seq || 0;
      const sales        = t.sales || t.sales_name || '';
      const amount       = t.amount || 0;
      const notes        = t.notes || '';
      if (!date || !customerName || !sales || amount <= 0) continue;
      const year = parseInt(date.slice(0, 4), 10);
      const ym   = date.slice(0, 7);
      await db.runAsync(
        `INSERT INTO transactions (bon_number,bon_seq,sales_name,customer_name,customer_norm,amount,transaction_date,year,year_month,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [bonNumber, bonSeq, sales, customerName, getNorm(customerName), amount, date, year, ym, notes, now, now]
      );
      inserted++;
    }
    await reloadData();
    Alert.alert('✓ Restore Berhasil', `${inserted} transaksi berhasil direstore ke database.`);
  }, [data, reloadData]);

  const handleMergeCustomer = useCallback(async (oldName, newName, sales) => {
    await mergeCustomerName(dbRef.current, oldName, newName, sales);
    await reloadData();
  }, [reloadData]);

  const handleIgnoreTypo = useCallback(async (sales, normA, normB) => {
    await addIgnoredTypoPair(dbRef.current, sales, normA, normB);
    await reloadData();
  }, [reloadData]);

  // Google Drive Sync — merge dua arah untuk multi-device
  const handleSyncDrive = useCallback(async () => {
    const valid = await isGdriveTokenValid();
    if (!valid) {
      Alert.alert('⚠️ Sesi Expired', 'Token Google Drive sudah expired.\nReconnect dulu di Settings → Google Drive.');
      return;
    }
    setDriveSyncing(true);
    try {
      const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
      // Cari folder backup
      const qF = encodeURIComponent(`name='OmsetKu Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${qF}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const folderData = await folderRes.json();
      const folderId   = folderData.files?.[0]?.id;
      const doUpload   = async () => {
        const fresh = await assembleData(dbRef.current);
        await uploadToDrive(token, { schemaVersion: SCHEMA_VER, appVersion: APP_VER, exportedAt: new Date().toISOString(), data: fresh });
        await SecureStore.setItemAsync(GDRIVE_LAST_BACKUP_KEY, String(Date.now()));
        const ts = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
        setDriveLastSync(ts);
      };
      if (!folderId) { await doUpload(); Alert.alert('✅ Sinkron', 'Tidak ada data di Drive, data lokal berhasil diunggah.'); return; }
      // Download file terbaru
      const qFiles = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${qFiles}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const filesData = await filesRes.json();
      const latestFile = filesData.files?.[0];
      if (!latestFile) { await doUpload(); Alert.alert('✅ Sinkron', 'Data lokal berhasil diunggah ke Drive.'); return; }
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const text = await fileRes.text();
      let backup;
      try { backup = JSON.parse(text); } catch(e) { throw new Error('Format backup di Drive tidak valid'); }
      const driveT = (backup.data?.transactions || []).filter(t => !t.deletedAt);
      const localT = (data?.transactions  || []).filter(t => !t.deletedAt);
      // Cari transaksi di Drive yang belum ada di lokal
      const newFromDrive = driveT.filter(dt => {
        const dtDate = dt.date || dt.transaction_date || '';
        const dtCust = getNorm(dt.customerName || dt.customer_name || '');
        const dtBon  = dt.bonNumber || dt.bon_number || '';
        return !localT.some(lt =>
          lt.bonNumber === dtBon && lt.date === dtDate &&
          getNorm(lt.customerName) === dtCust && lt.amount === dt.amount
        );
      });
      let synced = 0;
      if (newFromDrive.length > 0) {
        const db  = dbRef.current;
        const now = new Date().toISOString();
        const driveSales = backup.data?.salesList || [];
        const curSales   = [...(data?.salesList || [])];
        for (const s of driveSales) {
          if (!curSales.includes(s)) { await addSales(db, s, null, curSales.length); curSales.push(s); }
        }
        for (const t of newFromDrive) {
          const date = t.date || t.transaction_date || '', cn = (t.customerName || t.customer_name || '').trim();
          const bn = t.bonNumber || t.bon_number || '', bs = t.bonSeq || t.bon_seq || 0;
          const sn = t.sales || t.sales_name || '', amt = t.amount || 0, nt = t.notes || '';
          if (!date || !cn || !sn || amt <= 0) continue;
          const yr = parseInt(date.slice(0,4),10), ym2 = date.slice(0,7);
          await db.runAsync(
            `INSERT INTO transactions (bon_number,bon_seq,sales_name,customer_name,customer_norm,amount,transaction_date,year,year_month,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [bn,bs,sn,cn,getNorm(cn),amt,date,yr,ym2,nt,now,now]
          );
          synced++;
        }
        await reloadData();
      }
      await doUpload();
      Alert.alert('✅ Sinkron Selesai',
        synced > 0
          ? `${synced} transaksi baru dari perangkat lain berhasil digabung.\nData gabungan telah diupload ke Drive.`
          : 'Semua data sudah sinkron.\nTidak ada transaksi baru dari perangkat lain.'
      );
    } catch(e) {
      Alert.alert('Sinkron Gagal', String(e));
    } finally {
      setDriveSyncing(false);
    }
  }, [data, reloadData]);

  const handleImportCsv = useCallback(async (rows) => {
    const db = dbRef.current;
    const now = new Date().toISOString();
    const currentSalesList = [...(data?.salesList || [])];
    let inserted = 0;
    for (const row of rows) {
      // Auto-create sales jika belum ada
      if (!currentSalesList.includes(row.sales)) {
        await addSales(db, row.sales, null, currentSalesList.length);
        currentSalesList.push(row.sales);
      }
      const year = parseInt(row.date.slice(0, 4), 10);
      const ym   = row.date.slice(0, 7);
      const norm = getNorm(row.customerName);
      await db.runAsync(
        `INSERT INTO transactions
         (bon_number,bon_seq,sales_name,customer_name,customer_norm,amount,
          transaction_date,year,year_month,notes,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.bonNumber, row.bonSeq, row.sales, row.customerName.trim(), norm,
         row.amount, row.date, year, ym, row.notes||'', now, now]
      );
      inserted++;
    }
    await reloadData();
    Alert.alert('✓ Import Berhasil', `${inserted} transaksi berhasil diimport ke database.`);
  }, [data, reloadData]);

  const handleSettingsUpdate = useCallback(async (fields) => {
    const db = dbRef.current;
    // Update React theme state — ThemeContext.Provider will re-render all children
    if (fields.themeMode) {
      setThemeMode(fields.themeMode);
    }
    if (fields.addSales) {
      await addSales(db, fields.addSales, null, data.salesList.length);
    } else if (fields.removeSales) {
      await deactivateSales(db, fields.removeSales);
    } else if (fields.resetData) {
      await db.runAsync('DELETE FROM transactions');
      await db.runAsync('UPDATE settings SET current_seq=1 WHERE id=1');
    } else {
      await updateSettings(db, fields);
    }
    await reloadData();
  }, [reloadData, data]);

  // ─── render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
        <Image source={require('./assets/icon.png')}
        style={{ width:80, height:80, borderRadius:18, marginBottom:16 }} />
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!dbReady || !data) {
    return (
      <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:C.danger }}>Database error — restart app</Text>
      </View>
    );
  }

  // Onboarding — hanya untuk user baru (is_setup_complete=0 & onboarding belum selesai)
  // User lama yang upgrade: is_setup_complete=1 → skip langsung ke main app
  if (!data.isSetupComplete && !data.onboardingDone) {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  if (!data.isSetupComplete) {
    return <SetupWizard data={data} onComplete={handleSetupComplete} />;
  }

  // Lock screen — tampil jika PIN enabled dan belum terautentikasi
  if (data.pinLockEnabled && isLocked) {
    return (
      <View style={{ flex:1, backgroundColor:currentTheme.bg, alignItems:'center', justifyContent:'center', padding:24 }}>
        <StatusBar barStyle="light-content" backgroundColor={currentTheme.bg} />
        <Image source={require('./assets/icon.png')}
          style={{ width:90, height:90, borderRadius:20, marginBottom:20 }} />
        <Text style={{ color:currentTheme.text, fontSize:22, fontWeight:'800', marginBottom:6 }}>
          OmsetKu
        </Text>
        <Text style={{ color:currentTheme.muted, fontSize:14, marginBottom:40, textAlign:'center' }}>
          Verifikasi identitas untuk melanjutkan
        </Text>
        <TouchableOpacity onPress={handleAuthenticate}
          style={{ backgroundColor:currentTheme.primary, borderRadius:16,
            paddingVertical:16, paddingHorizontal:40 }}>
          <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>🔐 Buka Aplikasi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const st = getStyles(C);

  const statusText = saveState==='saving' ? 'Menyimpan...'
    : saveState==='error'  ? 'Gagal simpan!'
    : `${(data.transactions||[]).filter(t=>!t.deletedAt).length} bon · ${data.activeYear}`;
  const statusColor = saveState==='saved' ? C.success
    : saveState==='error' ? C.danger : C.muted;

  return (
    <ThemeContext.Provider value={currentTheme}>
    <View style={[{flex:1, backgroundColor:currentTheme.bg}, { paddingTop:Platform.OS==='ios'?44:StatusBar.currentHeight||0 }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
        <Image source={require('./assets/icon.png')}
          style={{ width:32, height:32, borderRadius:8, marginRight:10 }} />
        <View style={{ flex:1 }}>
          <Text style={{ color:C.text, fontSize:13, fontWeight:'800' }}>
            {data.companyName || 'OmsetKu'}
          </Text>
          <Text style={{ color:statusColor, fontSize:10 }}>{statusText}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSett(true)}
          style={{ backgroundColor:C.input, borderRadius:10, padding:8, borderWidth:1, borderColor:C.primary+'44' }}>
          <Text style={{ fontSize:15, color:C.text }}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Screen */}
      <View style={st.flex1}>
        {tab==='input'     && <InputScreen data={data} onSave={handleSave} dirtyRef={inputDirtyRef} />}
        {tab==='dashboard' && <DashboardScreen data={data} onYearChange={handleYearChange} />}
        {tab==='riwayat'   && <HistoryScreen data={data} onDelete={handleDelete} onEdit={handleEdit} onRestore={handleRestore} />}
        {tab==='ranking'   && <RankingScreen data={data} />}
        {tab==='pelanggan' && <CustomersScreen data={data} onMerge={handleMergeCustomer} onIgnoreTypo={handleIgnoreTypo} />}
      </View>

      {/* Bottom tabs */}
      <View style={{ flexDirection:'row', backgroundColor:C.card, borderTopWidth:1, borderTopColor:C.border, paddingBottom: Platform.OS==='ios'?16:0 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => handleTabChange(t.id)}
            style={{ flex:1, alignItems:'center', paddingVertical:10 }}>
            <Text style={{ fontSize:18, color:tab===t.id?C.accent:C.muted,
              transform:[{scale: tab===t.id?1.2:1}] }}>{t.icon}</Text>
            <Text style={{ fontSize:9, fontWeight:'700', color:tab===t.id?C.accent:C.muted, marginTop:2 }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Settings */}
      {showSett && (
        <SettingsModal
          data={data}
          onUpdate={handleSettingsUpdate}
          onImport={handleImportCsv}
          onRestoreJson={handleRestoreJson}
          onClose={() => setShowSett(false)}
          driveEmail={driveEmail}
          driveLastSync={driveLastSync}
          driveSyncing={driveSyncing}
          driveTokenExpired={driveTokenExpired}
          onDriveConnect={() => {
            if (GOOGLE_ANDROID_CLIENT_ID.startsWith('ISIAN')) {
              Alert.alert('Belum Dikonfigurasi',
                'Android OAuth Client ID belum diisi.\n\nLihat panduan GOOGLE_DRIVE_SETUP.md\nuntuk mendapatkan SHA-1 dan membuat\nAndroid OAuth Client di Google Cloud Console.');
              return;
            }
            gRequest && gPromptAsync();
          }}
          onDriveBackup={handleManualDriveBackup}
          onDriveSync={handleSyncDrive}
          onDriveDisconnect={handleDisconnectDrive}
        />
      )}
    </View>
    </ThemeContext.Provider>
  );
}
