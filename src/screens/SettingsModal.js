import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Platform, StatusBar, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as BackgroundFetch from 'expo-background-fetch';
import * as XLSX from 'xlsx';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { ThemeContext, getStyles, btnStyle } from '../theme';
import { COLORS, MONTHS_F, APP_VER, SCHEMA_VER, GDRIVE_TOKEN_KEY, GDRIVE_HOUR_KEY, GDRIVE_TASK_NAME } from '../constants';
import { toIdr, toShort, todayStr, fmtDate, getNorm, parseCsvText, padNum, parseBon } from '../utils';
import { isGdriveTokenValid, scheduleReminder, cancelReminder } from '../services';
import { PurchasesContext } from '../contexts';
import { can, getMaxSales, FREE } from '../premium';

function SettingsModal({ data, onUpdate, onImport, onRestoreJson, onClose,
  driveEmail, driveLastSync, driveSyncing, driveTokenExpired,
  onDriveConnect, onDriveBackup, onDriveDisconnect, onDriveSync }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { purchases, openPaywall } = useContext(PurchasesContext);
  const hasExcel    = can.excelExport(purchases);
  const hasBackup   = can.backupDrive(purchases);
  const hasShare    = can.shareKartu(purchases);
  const maxSales    = getMaxSales(purchases);

  const { salesList, bonConfig, dateFormat, companyName } = data;
  const [themeMode, setThemeMode]       = useState(data.themeMode||'dark');
  const [pinLockEnabled, setPinLockEnabled] = useState(data.pinLockEnabled||false);
  // lockTimeout dihapus dari UI — selalu lock langsung (lihat App.js)
  const [notifEnabled,   setNotifEnabled]   = useState(data.notifEnabled||false);
  const [notifHour,      setNotifHour]      = useState(data.notifHour??20);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting]         = useState(false);
  const [showExcelMenu,     setShowExcelMenu]     = useState(false);
  const [jsonRestorePreview,setJsonRestorePreview] = useState(null);
  const [jsonRestoring,     setJsonRestoring]      = useState(false);
  const [backupHour,        setBackupHour]         = useState(23);
  const [driveFileList,     setDriveFileList]      = useState([]);
  const [showDriveFiles,    setShowDriveFiles]     = useState(false);
  const [driveFilesLoading, setDriveFilesLoading]  = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(GDRIVE_HOUR_KEY)
      .then(v => { if (v !== null) setBackupHour(parseInt(v, 10)); })
      .catch(() => {}); // fallback ke default 23:00
  }, []);
  const [excelChecked, setExcelChecked]   = useState({ transaksi:true, per_sales:true, bulanan:true, pelanggan:false, ranking:false });
  const [excelPeriodType,      setExcelPeriodType]      = useState('year');
  const [excelPeriodMonth,     setExcelPeriodMonth]      = useState(new Date().getMonth()+1);
  const [excelPeriodMonthYear, setExcelPeriodMonthYear]  = useState(new Date().getFullYear());
  const [exporting, setExporting]         = useState(false);
  const [company, setCompany]   = useState(companyName||'');
  const [prefix,  setPrefix]    = useState(bonConfig?.prefix||'INV');
  const [sep,     setSep]       = useState(bonConfig?.separator||'-');
  const [digits,  setDigits]    = useState(String(bonConfig?.digitLength||5));
  const [fmt,     setFmt]       = useState(dateFormat||'dd/mm/yyyy');
  const [newSales, setNewSales] = useState('');

  // Save individual sections inline
  const saveCompany = async () => {
    if (!company.trim()) { Alert.alert('', 'Nama bisnis tidak boleh kosong'); return; }
    await onUpdate({ companyName: company.trim() });
    Alert.alert('✓', 'Nama bisnis disimpan');
  };
  const saveBonFormat = async () => {
    await onUpdate({
      bonPrefix:    prefix.toUpperCase(),
      bonSeparator: sep,
      bonDigits:    Math.max(1, parseInt(digits)||5),
    });
    Alert.alert('✓', 'Format bon disimpan');
  };

  const handleAddSales = async () => {
    const nm = newSales.trim().toUpperCase();
    if (!nm || salesList.includes(nm)) {
      Alert.alert('','Nama sudah ada atau kosong'); return;
    }
    // Cek limit sales berdasarkan tier premium
    if (salesList.length >= maxSales) {
      openPaywall('more_sales');
      return;
    }
    await onUpdate({ addSales: nm });
    setNewSales('');
  };

  const handleRemoveSales = (name) => {
    Alert.alert('Hapus Sales',
      `Hapus "${name}"? Transaksi lama tetap ada.`,
      [
        { text:'Batal', style:'cancel' },
        { text:'Hapus', style:'destructive', onPress: () => onUpdate({ removeSales: name }) },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const payload = {
        schemaVersion: SCHEMA_VER,
        appVersion:    APP_VER,
        exportedAt:    new Date().toISOString(),
        data,
      };
      const filename = `omsetku-backup-${todayStr()}.json`;
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
      await Sharing.shareAsync(path, { mimeType:'application/json', dialogTitle:'Export OmsetKu Backup' });
    } catch(e) {
      Alert.alert('Export Gagal', String(e));
    }
  };

  const handleReset = () => {
    // Langkah 1: konfirmasi pertama
    Alert.alert(
      '🗑 Reset Semua Data',
      'SEMUA transaksi akan dihapus secara permanen dan tidak bisa dikembalikan.\n\nPengaturan (nama bisnis, sales, format) tidak ikut terhapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua', style: 'destructive',
          onPress: async () => {
            // Langkah 2: jika fingerprint aktif → verifikasi dulu
            if (pinLockEnabled) {
              try {
                const hasHw    = await LocalAuthentication.hasHardwareAsync();
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                if (hasHw && enrolled) {
                  const result = await LocalAuthentication.authenticateAsync({
                    promptMessage:         'Verifikasi untuk menghapus semua data',
                    fallbackLabel:         'Gunakan PIN HP',
                    cancelLabel:           'Batal',
                    disableDeviceFallback: false,
                  });
                  if (!result.success) return; // batal — jangan hapus
                }
              } catch(e) {
                // Fingerprint error → tetap lanjut (jangan block user)
              }
            }
            // Langkah 3: hapus setelah verifikasi
            Alert.alert(
              'Konfirmasi Terakhir',
              'Yakin? Data yang dihapus tidak bisa dipulihkan.',
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Ya, Hapus Sekarang', style: 'destructive',
                  onPress: () => onUpdate({ resetData: true }) },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePickCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri  = result.assets[0].uri;
      const text = await FileSystem.readAsStringAsync(uri);
      const parsed = parseCsvText(text, data.bonConfig);
      if (!parsed.length) {
        Alert.alert(
          'Format Tidak Dikenali',
          'Tidak ada data valid di file ini.\n\nPastikan kolom CSV:\nNo.Bon | Sales | - | Tanggal | Pelanggan | Nominal | Catatan'
        );
        return;
      }
      // Deteksi duplikat: tanggal + customer_norm + amount sama
      const existingActive = (data.transactions||[]).filter(t => !t.deletedAt);
      const dupeRows = [], nonDupeRows = [];
      parsed.forEach(row => {
        const norm  = getNorm(row.customerName);
        const isDupe = existingActive.some(t =>
          t.date === row.date &&
          getNorm(t.customerName) === norm &&
          t.amount === row.amount
        );
        (isDupe ? dupeRows : nonDupeRows).push(row);
      });
      const salesNames = [...new Set(parsed.map(r => r.sales))];
      const totalAmt   = parsed.reduce((a, r) => a + r.amount, 0);
      setImportPreview({ allRows: parsed, dupeRows, nonDupeRows, salesNames, totalAmt });
    } catch(e) {
      Alert.alert('Error membaca file', String(e));
    }
  };

  // ── Export CSV (format kompatibel dengan CSV importer) ──
  const handleExportCsv = async () => {
    try {
      const activeTxns = (data.transactions || [])
        .filter(t => !t.deletedAt)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (activeTxns.length === 0) {
        Alert.alert('', 'Belum ada transaksi untuk diekspor'); return;
      }

      const esc = (s) => {
        const str = String(s ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const header = 'No. Bon,Sales,Tanggal,Nama Pelanggan,Total Belanja (Rp),Catatan';
      const rows = activeTxns.map(t => {
        const seq  = t.bonSeq || parseBon(t.bonNumber, data.bonConfig) || 0;
        const date = fmtDate(t.date, 'dd/mm/yyyy'); // selalu dd/mm/yyyy untuk reimport
        return [seq, esc(t.sales), date, esc(t.customerName), t.amount, esc(t.notes)].join(',');
      });

      const csv      = [header, ...rows].join('\n');
      const filename = `omsetku-data-${todayStr()}.csv`;
      const path     = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType:'text/csv', dialogTitle:'Export CSV OmsetKu' });
    } catch(e) {
      Alert.alert('Export Gagal', String(e));
    }
  };

  // ── Restore dari JSON backup ──
  const handlePickJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
      let backup;
      try { backup = JSON.parse(text); }
      catch(e) { Alert.alert('Format Tidak Valid', 'File bukan JSON yang valid'); return; }

      if (!backup?.data?.transactions) {
        Alert.alert('Format Tidak Dikenali', 'Bukan file backup OmsetKu yang valid.\nPastikan file berasal dari menu "Export Backup JSON".');
        return;
      }

      const allTxns    = (backup.data.transactions || []).filter(t => !t.deletedAt);
      const salesNames = backup.data.salesList || [];

      // Deteksi duplikat
      const existingActive = (data.transactions || []).filter(t => !t.deletedAt);
      const dupeRows = [], nonDupeRows = [];
      allTxns.forEach(t => {
        const isDupe = existingActive.some(e =>
          e.bonNumber === t.bonNumber &&
          e.date === (t.date || t.transaction_date) &&
          getNorm(e.customerName) === getNorm(t.customerName || t.customer_name || '') &&
          e.amount === t.amount
        );
        (isDupe ? dupeRows : nonDupeRows).push(t);
      });

      setJsonRestorePreview({
        allTxns, nonDupeRows, dupeRows, salesNames,
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion || '?',
        totalAmt:   allTxns.reduce((a, t) => a + (t.amount || 0), 0),
      });
    } catch(e) {
      Alert.alert('Error membaca file', String(e));
    }
  };

  // ── Restore dari Google Drive ──────────────────────────────────────────────
  const handleListDriveFiles = async () => {
    const valid = await isGdriveTokenValid();
    if (!valid) {
      Alert.alert('⚠️ Sesi Expired', 'Reconnect Google Drive dulu di bagian atas.');
      return;
    }
    setDriveFilesLoading(true);
    try {
      const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
      // Cari folder OmsetKu Backup
      const qF = encodeURIComponent(`name='OmsetKu Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${qF}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const folderData = await folderRes.json();
      const folderId = folderData.files?.[0]?.id;
      if (!folderId) {
        Alert.alert('', 'Belum ada folder backup di Google Drive.\nBackup dulu sebelum restore.');
        return;
      }
      // Daftar file di folder
      const qFiles = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${qFiles}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime+desc&pageSize=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const filesData = await filesRes.json();
      const files = filesData.files || [];
      if (!files.length) {
        Alert.alert('', 'Belum ada file backup di Google Drive.');
        return;
      }
      setDriveFileList(files);
      setShowDriveFiles(true);
    } catch(e) {
      Alert.alert('Gagal Memuat', String(e));
    } finally {
      setDriveFilesLoading(false);
    }
  };

  const handleDownloadDriveRestore = async (file) => {
    setShowDriveFiles(false);
    setDriveFilesLoading(true);
    try {
      const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const text = await res.text();
      let backup;
      try { backup = JSON.parse(text); }
      catch(e) { Alert.alert('Format Tidak Valid', 'File bukan JSON yang valid'); return; }
      if (!backup?.data?.transactions) {
        Alert.alert('Format Tidak Dikenali', 'Bukan file backup OmsetKu yang valid.');
        return;
      }
      // Reuse alur preview restore JSON yang sudah ada
      const allTxns    = (backup.data.transactions || []).filter(t => !t.deletedAt);
      const salesNames = backup.data.salesList || [];
      const existingActive = (data.transactions || []).filter(t => !t.deletedAt);
      const dupeRows = [], nonDupeRows = [];
      allTxns.forEach(t => {
        const isDupe = existingActive.some(e =>
          e.bonNumber === t.bonNumber &&
          e.date === (t.date || t.transaction_date) &&
          getNorm(e.customerName) === getNorm(t.customerName || t.customer_name || '') &&
          e.amount === t.amount
        );
        (isDupe ? dupeRows : nonDupeRows).push(t);
      });
      setJsonRestorePreview({
        allTxns, nonDupeRows, dupeRows, salesNames,
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion || '?',
        totalAmt:   allTxns.reduce((a, t) => a + (t.amount || 0), 0),
      });
    } catch(e) {
      Alert.alert('Gagal Download', String(e));
    } finally {
      setDriveFilesLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!Object.values(excelChecked).some(Boolean)) {
      Alert.alert('', 'Pilih minimal 1 sheet untuk diexport'); return;
    }
    try {
      setExporting(true);
      const wb       = XLSX.utils.book_new();
      // Nama sheet Excel: max 31 char, tak boleh ada : \ / ? * [ ] dan harus unik
      // (cegah crash bila nama sales mengandung karakter ilegal / bentrok nama sheet lain)
      const usedSheetNames = new Set();
      const safeSheetName = (raw) => {
        let name = String(raw || 'Sheet').replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
        const base = name; let i = 2;
        while (usedSheetNames.has(name.toLowerCase())) {
          const suffix = ` (${i})`;
          name = base.slice(0, 31 - suffix.length) + suffix;
          i++;
        }
        usedSheetNames.add(name.toLowerCase());
        return name;
      };
      const dfmt   = data.dateFormat || 'dd/mm/yyyy';
      const yr     = excelPeriodType === 'month'
        ? excelPeriodMonthYear
        : (data.activeYear || new Date().getFullYear());
      const salesL   = data.salesList || [];
      const company  = data.companyName || 'OmsetKu';
      // Filter transaksi sesuai periode yang dipilih
      const allActive = (data.transactions||[]).filter(t => !t.deletedAt);
      const txns = excelPeriodType === 'month'
        ? allActive.filter(t => t.date.startsWith(
            `${excelPeriodMonthYear}-${String(excelPeriodMonth).padStart(2,'0')}`))
        : allActive.filter(t => t.date.startsWith(String(yr)));

      // ── STYLE LIBRARY ────────────────────────────────────────────
      const S = {
        title:  { fill:{patternType:'solid',fgColor:{rgb:'1E3A5F'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:16,name:'Calibri'}, alignment:{horizontal:'center',vertical:'center'} },
        meta:   { fill:{patternType:'solid',fgColor:{rgb:'DBEAFE'}}, font:{color:{rgb:'1E3A8A'},sz:9,name:'Calibri'},            alignment:{horizontal:'center',vertical:'center'} },
        secH:   { fill:{patternType:'solid',fgColor:{rgb:'2563EB'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:11,name:'Calibri'}, alignment:{horizontal:'left',vertical:'center'} },
        colH:   { fill:{patternType:'solid',fgColor:{rgb:'1D4ED8'}}, font:{bold:true,color:{rgb:'FFFFFF'},sz:10,name:'Calibri'}, alignment:{horizontal:'center',vertical:'center'},
                  border:{top:{style:'thin',color:{rgb:'BFDBFE'}},bottom:{style:'medium',color:{rgb:'1E40AF'}},left:{style:'thin',color:{rgb:'BFDBFE'}},right:{style:'thin',color:{rgb:'BFDBFE'}}} },
        lbl:    { fill:{patternType:'solid',fgColor:{rgb:'F1F5F9'}}, font:{bold:true,color:{rgb:'475569'},sz:10},                alignment:{horizontal:'left',vertical:'center'} },
        acc:    { fill:{patternType:'solid',fgColor:{rgb:'FFF7ED'}}, font:{bold:true,color:{rgb:'C2410C'},sz:13,name:'Calibri'},  alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0' },
        tot:    { fill:{patternType:'solid',fgColor:{rgb:'F0FDF4'}}, font:{bold:true,color:{rgb:'166534'},sz:10},                alignment:{horizontal:'left',vertical:'center'} },
        totN:   { fill:{patternType:'solid',fgColor:{rgb:'F0FDF4'}}, font:{bold:true,color:{rgb:'166534'},sz:10},                alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0' },
        r0:     { fill:{patternType:'solid',fgColor:{rgb:'FFFFFF'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'left',vertical:'center'},
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        r0N:    { fill:{patternType:'solid',fgColor:{rgb:'FFFFFF'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0',
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        r0C:    { fill:{patternType:'solid',fgColor:{rgb:'FFFFFF'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'center',vertical:'center'},
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        r1:     { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'left',vertical:'center'},
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        r1N:    { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0',
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        r1C:    { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}}, font:{color:{rgb:'334155'},sz:10},                          alignment:{horizontal:'center',vertical:'center'},
                  border:{bottom:{style:'thin',color:{rgb:'E2E8F0'}}} },
        mono:   { font:{color:{rgb:'334155'},sz:10,name:'Courier New'}, alignment:{horizontal:'center',vertical:'center'} },
        mono1:  { fill:{patternType:'solid',fgColor:{rgb:'F8FAFC'}}, font:{color:{rgb:'334155'},sz:10,name:'Courier New'}, alignment:{horizontal:'center',vertical:'center'} },
      };

      // ── HELPERS ───────────────────────────────────────────────────
      const EC = (r, c) => XLSX.utils.encode_cell({r, c});
      const sc = (ws, r, c, v, t, s) => { ws[EC(r,c)] = { v, t: t || (typeof v==='number'?'n':'s'), s }; };
      const mg = (arr, r1, c1, r2, c2) => arr.push({s:{r:r1,c:c1},e:{r:r2,c:c2}});
      const setRef = (ws, maxR, maxC) => { ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}}); };

      // txns sudah difilter per periode; yearTxns = txns (untuk Ringkasan)
      const yearTxns  = txns;
      const yearTotal = yearTxns.reduce((a,t)=>a+t.amount,0);
      const yearCount = yearTxns.length;

      // ── SHEET 1: RINGKASAN (selalu ada) ──────────────────────────
      {
        const ws = {}; const mg_ = [];
        let r = 0; const NCOL = 6;

        // Judul & meta
        sc(ws,r,0,company,'s',S.title); mg(mg_,r,0,r,NCOL-1);
        ws['!rows'] = [{hpt:34}]; r++;
        sc(ws,r,0,`Laporan Omset Tahun ${yr}   |   OmsetKu v${APP_VER}   |   ${new Date().toLocaleDateString('id-ID',{dateStyle:'long'})}`,
          's',S.meta); mg(mg_,r,0,r,NCOL-1); r++;
        r++; // empty

        // KPI box
        sc(ws,r,0,'  📊  RINGKASAN OMSET','s',S.secH); mg(mg_,r,0,r,NCOL-1); r++;
        const kpiRows = [
          ['  Total Omset Tahun '+yr, yearTotal, S.lbl, S.acc],
          ['  Total Bon',             yearCount, S.lbl, {...S.r0,font:{bold:true,sz:12},alignment:{horizontal:'right'}}],
          ['  Rata-rata per Bon',     yearCount>0?Math.round(yearTotal/yearCount):0, S.lbl, {...S.r0N,font:{bold:true,sz:10}}],
          ['  Jumlah Sales Aktif',    salesL.length, S.lbl, {...S.r0,alignment:{horizontal:'right'}}],
          ['  Total Pelanggan Unik',  (() => { const m={}; txns.forEach(t=>{m[t.sales+'_'+getNorm(t.customerName)]=1;}); return Object.keys(m).length; })(), S.lbl, {...S.r0,alignment:{horizontal:'right'}}],
        ];
        kpiRows.forEach(([lbl,val,ls,vs]) => {
          sc(ws,r,0,lbl,'s',ls); mg(mg_,r,0,r,2);
          sc(ws,r,3,val,typeof val==='number'?'n':'s',vs); mg(mg_,r,3,r,NCOL-1);
          r++;
        });
        r++;

        // Per-sales table
        sc(ws,r,0,'  👥  OMSET PER SALES','s',S.secH); mg(mg_,r,0,r,NCOL-1); r++;
        ['Sales','Total Omset (Rp)','Jumlah Bon','% Total','Rata-rata/Bon','Hari Ini (Rp)'].forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH));
        r++;
        const today_ = todayStr();
        const bySales_ = salesL.map(s=>{
          const st=yearTxns.filter(t=>t.sales===s);
          const td=txns.filter(t=>t.sales===s&&t.date===today_);
          return {n:s,tot:st.reduce((a,t)=>a+t.amount,0),cnt:st.length,
            avg:st.length>0?Math.round(st.reduce((a,t)=>a+t.amount,0)/st.length):0,
            today:td.reduce((a,t)=>a+t.amount,0)};
        });
        bySales_.forEach((bs,idx)=>{
          const a=idx%2===1;
          sc(ws,r,0,bs.n,'s',a?S.r1:S.r0);
          sc(ws,r,1,bs.tot,'n',a?S.r1N:S.r0N);
          sc(ws,r,2,bs.cnt,'n',a?S.r1N:S.r0N);
          sc(ws,r,3,yearTotal>0?+(bs.tot/yearTotal*100).toFixed(1):0,'n',{...(a?S.r1C:S.r0C),numFmt:'0.0'});
          sc(ws,r,4,bs.avg,'n',a?S.r1N:S.r0N);
          sc(ws,r,5,bs.today,'n',a?S.r1N:S.r0N);
          r++;
        });
        sc(ws,r,0,'TOTAL','s',S.tot); sc(ws,r,1,yearTotal,'n',S.totN);
        sc(ws,r,2,yearCount,'n',S.totN); sc(ws,r,3,100,'n',{...S.tot,alignment:{horizontal:'center'},numFmt:'0'});
        sc(ws,r,4,yearCount>0?Math.round(yearTotal/yearCount):0,'n',S.totN);
        sc(ws,r,5,bySales_.reduce((a,b)=>a+b.today,0),'n',S.totN); r++;
        r++;

        // Rekap bulanan
        sc(ws,r,0,'  📅  REKAP BULANAN '+yr,'s',S.secH); mg(mg_,r,0,r,NCOL-1); r++;
        const mCols = ['Bulan',...salesL,'TOTAL'];
        mCols.forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH)); r++;
        MONTHS_F.forEach((m_,mi)=>{
          const mo=String(mi+1).padStart(2,'0');
          const mTx=yearTxns.filter(t=>t.date.slice(5,7)===mo);
          const mTot=mTx.reduce((a,t)=>a+t.amount,0);
          const a=mi%2===1;
          sc(ws,r,0,m_,'s',a?S.r1:S.r0);
          salesL.forEach((s,ci)=>sc(ws,r,ci+1,mTx.filter(t=>t.sales===s).reduce((a,t)=>a+t.amount,0),'n',a?S.r1N:S.r0N));
          sc(ws,r,salesL.length+1,mTot,'n',a?S.r1N:S.r0N); r++;
        });
        sc(ws,r,0,'TOTAL','s',S.tot);
        salesL.forEach((s,ci)=>sc(ws,r,ci+1,yearTxns.filter(t=>t.sales===s).reduce((a,t)=>a+t.amount,0),'n',S.totN));
        sc(ws,r,salesL.length+1,yearTotal,'n',S.totN); r++;

        ws['!merges']=mg_; setRef(ws,r,NCOL-1);
        ws['!cols']=[{wch:26},{wch:18},{wch:12},{wch:10},{wch:16},{wch:16}];
        XLSX.utils.book_append_sheet(wb,ws,safeSheetName('📊 Ringkasan'));
      }

      // ── TRANSACTION SHEETS ────────────────────────────────────────
      if (excelChecked.transaksi) {
        salesL.forEach(s=>{
          const sTxns=[...txns].filter(t=>t.sales===s).sort((a,b)=>b.date.localeCompare(a.date));
          const ws={}; const mg_=[];
          let r=0;
          const sTotal=sTxns.reduce((a,t)=>a+t.amount,0);
          // Header
          sc(ws,r,0,`${s}  —  Riwayat Transaksi`,'s',S.title); mg(mg_,r,0,r,4); r++;
          sc(ws,r,0,`${sTxns.length} bon  |  Total: Rp ${sTotal.toLocaleString('id-ID')}  |  ${company}`,'s',S.meta); mg(mg_,r,0,r,4); r++;
          ['No. Bon','Tanggal','Nama Pelanggan','Total (Rp)','Catatan'].forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH)); r++;
          sTxns.forEach((t,idx)=>{
            const a=idx%2===1;
            sc(ws,r,0,t.bonNumber,'s',a?S.mono1:S.mono);
            sc(ws,r,1,fmtDate(t.date,dfmt),'s',a?S.r1C:S.r0C);
            sc(ws,r,2,t.customerName,'s',a?S.r1:S.r0);
            sc(ws,r,3,t.amount,'n',a?S.r1N:S.r0N);
            sc(ws,r,4,t.notes||'','s',a?S.r1:S.r0); r++;
          });
          sc(ws,r,0,'TOTAL','s',S.tot); mg(mg_,r,0,r,2);
          sc(ws,r,1,'','s',S.tot); sc(ws,r,2,'','s',S.tot);
          sc(ws,r,3,sTotal,'n',S.totN); sc(ws,r,4,'','s',S.tot); r++;
          ws['!merges']=mg_; setRef(ws,r,4);
          ws['!cols']=[{wch:14},{wch:13},{wch:28},{wch:16},{wch:22}];
          ws['!rows']=[{hpt:28},{hpt:18},{hpt:20}];
          ws['!autofilter']={ref:'A3:E3'};
          XLSX.utils.book_append_sheet(wb,ws,safeSheetName(s));
        });
      }

      // ── PER SALES ─────────────────────────────────────────────────
      if (excelChecked.per_sales) {
        const ws={}; const mg_=[]; let r=0;
        sc(ws,r,0,'Rekap per Sales','s',S.title); mg(mg_,r,0,r,4); r++;
        sc(ws,r,0,`${company}  |  Tahun ${yr}`,'s',S.meta); mg(mg_,r,0,r,4); r++;
        ['Sales','Total Omset (Rp)','Jumlah Bon','Rata-rata/Bon (Rp)','% Kontribusi'].forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH)); r++;
        salesL.forEach((s,idx)=>{
          const st=txns.filter(t=>t.sales===s);
          const tot=st.reduce((a,t)=>a+t.amount,0);
          const a=idx%2===1;
          sc(ws,r,0,s,'s',a?S.r1:S.r0); sc(ws,r,1,tot,'n',a?S.r1N:S.r0N);
          sc(ws,r,2,st.length,'n',a?S.r1N:S.r0N);
          sc(ws,r,3,st.length>0?Math.round(tot/st.length):0,'n',a?S.r1N:S.r0N);
          const allTot=txns.reduce((a,t)=>a+t.amount,0);
          sc(ws,r,4,allTot>0?+(tot/allTot*100).toFixed(1):0,'n',{...(a?S.r1C:S.r0C),numFmt:'0.0'}); r++;
        });
        const allTot2=txns.reduce((a,t)=>a+t.amount,0);
        sc(ws,r,0,'TOTAL','s',S.tot); sc(ws,r,1,allTot2,'n',S.totN);
        sc(ws,r,2,txns.length,'n',S.totN);
        sc(ws,r,3,txns.length>0?Math.round(allTot2/txns.length):0,'n',S.totN);
        sc(ws,r,4,100,'n',{...S.tot,alignment:{horizontal:'center'},numFmt:'0'}); r++;
        ws['!merges']=mg_; setRef(ws,r,4);
        ws['!cols']=[{wch:18},{wch:18},{wch:13},{wch:18},{wch:14}];
        ws['!rows']=[{hpt:24},{hpt:18}];
        XLSX.utils.book_append_sheet(wb,ws,safeSheetName('Per Sales'));
      }

      // ── PELANGGAN ─────────────────────────────────────────────────
      if (excelChecked.pelanggan) {
        const cMap={};
        txns.forEach(t=>{
          const k=`${t.sales}|||${getNorm(t.customerName)}`;
          if(!cMap[k]) cMap[k]={name:t.customerName,sales:t.sales,cnt:0,tot:0,last:''};
          cMap[k].cnt++; cMap[k].tot+=t.amount;
          if(t.date>cMap[k].last) cMap[k].last=t.date;
        });
        const ws={}; const mg_=[]; let r=0;
        sc(ws,r,0,'Daftar Pelanggan','s',S.title); mg(mg_,r,0,r,5); r++;
        sc(ws,r,0,`${company}  |  ${Object.keys(cMap).length} pelanggan unik`,'s',S.meta); mg(mg_,r,0,r,5); r++;
        ['No','Nama Pelanggan','Sales','Jumlah Bon','Total Belanja (Rp)','Terakhir Transaksi'].forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH)); r++;
        Object.values(cMap).sort((a,b)=>a.name.localeCompare(b.name,'id')).forEach((c,i)=>{
          const a=i%2===1;
          sc(ws,r,0,i+1,'n',{...(a?S.r1C:S.r0C),font:{color:{rgb:'94A3B8'},sz:9}});
          sc(ws,r,1,c.name,'s',a?S.r1:S.r0); sc(ws,r,2,c.sales,'s',a?S.r1C:S.r0C);
          sc(ws,r,3,c.cnt,'n',a?S.r1N:S.r0N); sc(ws,r,4,c.tot,'n',a?S.r1N:S.r0N);
          sc(ws,r,5,fmtDate(c.last,dfmt),'s',a?S.r1C:S.r0C); r++;
        });
        ws['!merges']=mg_; setRef(ws,r,5);
        ws['!cols']=[{wch:5},{wch:28},{wch:12},{wch:12},{wch:18},{wch:16}];
        ws['!rows']=[{hpt:24},{hpt:18}]; ws['!autofilter']={ref:'A3:F3'};
        XLSX.utils.book_append_sheet(wb,ws,safeSheetName('Pelanggan'));
      }

      // ── RANKING ───────────────────────────────────────────────────
      if (excelChecked.ranking) {
        const ws={}; const mg_=[]; let r=0;
        sc(ws,r,0,'Ranking Pelanggan','s',S.title); mg(mg_,r,0,r,5); r++;
        sc(ws,r,0,`${company}  |  All Time`,'s',S.meta); mg(mg_,r,0,r,5); r++;
        ['Rank','Nama Pelanggan','Sales','Jumlah Bon','Total Belanja (Rp)','Terakhir Transaksi'].forEach((h,ci)=>sc(ws,r,ci,h,'s',S.colH)); r++;
        salesL.forEach(s=>{
          getRanking(txns,s).forEach((rv,i)=>{
            const a=i%2===1;
            const medal=i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':'';
            sc(ws,r,0,i+1,'n',{...(a?S.r1C:S.r0C),font:{bold:i<3,color:{rgb:i===0?'F59E0B':i===1?'9CA3AF':i===2?'B45309':'334155'},sz:10}});
            sc(ws,r,1,medal+rv.name,'s',a?S.r1:S.r0); sc(ws,r,2,s,'s',a?S.r1C:S.r0C);
            sc(ws,r,3,rv.count,'n',a?S.r1N:S.r0N); sc(ws,r,4,rv.total,'n',a?S.r1N:S.r0N);
            sc(ws,r,5,fmtDate(rv.last,dfmt),'s',a?S.r1C:S.r0C); r++;
          });
        });
        ws['!merges']=mg_; setRef(ws,r,5);
        ws['!cols']=[{wch:6},{wch:28},{wch:12},{wch:12},{wch:18},{wch:16}];
        ws['!rows']=[{hpt:24},{hpt:18}];
        XLSX.utils.book_append_sheet(wb,ws,safeSheetName('Ranking'));
      }

      const base64  = XLSX.write(wb, { type:'base64', bookType:'xlsx', cellStyles:true });
      const fname   = excelPeriodType === 'month'
        ? `OmsetKu-${company.replace(/\s/g,'-')}-${MONTHS_F[excelPeriodMonth-1]}-${excelPeriodMonthYear}.xlsx`
        : `OmsetKu-${company.replace(/\s/g,'-')}-${yr}.xlsx`;
      const uri     = FileSystem.documentDirectory + fname;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding:FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, {
        mimeType:    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Excel OmsetKu',
      });
      setShowExcelMenu(false);
    } catch(e) {
      Alert.alert('Export Gagal', String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[st.container, { paddingTop: Platform.OS==='ios'?44:StatusBar.currentHeight||0 }]}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border }}>
          <Text style={{ color:C.text, fontSize:18, fontWeight:'800' }}>⚙  Pengaturan</Text>
          <TouchableOpacity onPress={onClose}
            style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
            <Text style={{ color:C.muted }}>✕ Tutup</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:50 }}>
          {/* Company — simpan inline */}
          <View style={st.card}>
            <Text style={st.label}>Nama Bisnis</Text>
            <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
              <TextInput value={company} onChangeText={setCompany}
                placeholder="Nama bisnis..." placeholderTextColor={C.muted}
                style={[st.input, { flex:1 }]} />
              <TouchableOpacity onPress={saveCompany}
                style={{ backgroundColor:C.primary, borderRadius:10, paddingHorizontal:14,
                  paddingVertical:14, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontSize:13, fontWeight:'800' }}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sales management */}
          <View style={st.card}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' }}>
                TIM SALES
              </Text>
              <Text style={{ color: salesList.length >= maxSales ? C.warning : C.muted, fontSize:11, fontWeight:'700' }}>
                {salesList.length}/{maxSales === Infinity ? '∞' : maxSales}
                {salesList.length >= maxSales && maxSales < 50 ? ' 🔒' : ''}
              </Text>
            </View>
            {salesList.map((sl, i) => (
              <View key={sl} style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
                <View style={{ width:12, height:12, borderRadius:6, backgroundColor:COLORS[i%COLORS.length] }} />
                <Text style={{ color:C.text, flex:1, fontSize:14, fontWeight:'600' }}>{sl}</Text>
                {salesList.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveSales(sl)}
                    style={{ backgroundColor:C.input, borderRadius:6, width:28, height:28, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:C.muted }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <TextInput value={newSales} onChangeText={v => setNewSales(v.toUpperCase())}
                placeholder="Nama sales baru..." placeholderTextColor={C.muted}
                style={[st.input, {flex:1}]} returnKeyType="done" onSubmitEditing={handleAddSales} />
              <TouchableOpacity onPress={handleAddSales}
                style={{ backgroundColor:C.primary, borderRadius:12, paddingHorizontal:18, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bon format */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              FORMAT NOMOR BON
            </Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
              <View style={{ flex:1 }}>
                <Text style={st.label}>Prefix</Text>
                <TextInput value={prefix} onChangeText={v=>setPrefix(v.toUpperCase())} style={st.input} placeholderTextColor={C.muted}/>
              </View>
              <View style={{ width:60 }}>
                <Text style={st.label}>Sep.</Text>
                <TextInput value={sep} onChangeText={setSep} style={st.input} placeholderTextColor={C.muted}/>
              </View>
              <View style={{ width:70 }}>
                <Text style={st.label}>Digit</Text>
                <TextInput value={digits} onChangeText={v=>setDigits(v.replace(/\D/g,''))}
                  keyboardType="number-pad" style={st.input} placeholderTextColor={C.muted}/>
              </View>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={[st.mono, { color:C.accent, fontSize:16, fontWeight:'800' }]}>
                {prefix}{sep}{padNum(1, parseInt(digits)||5)}
              </Text>
              <TouchableOpacity onPress={saveBonFormat}
                style={{ backgroundColor:C.primary, borderRadius:10, paddingHorizontal:16,
                  paddingVertical:8 }}>
                <Text style={{ color:'#fff', fontSize:13, fontWeight:'800' }}>✓ Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date format — kompak, pilih langsung simpan */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:10 }}>
              FORMAT TANGGAL
            </Text>
            <View style={{ flexDirection:'row', gap:6 }}>
              {['dd/mm/yyyy','mm/dd/yyyy','yyyy/mm/dd'].map(f => (
                <TouchableOpacity key={f}
                  onPress={async () => { setFmt(f); await onUpdate({ dateFormat: f }); }}
                  style={{ flex:1, paddingVertical:10, borderRadius:10, alignItems:'center',
                    backgroundColor: fmt===f ? C.primary : C.input,
                    borderWidth: fmt===f ? 0 : 1, borderColor: C.border }}>
                  <Text style={{ color: fmt===f ? '#fff' : C.muted, fontSize:10, fontWeight:'700' }}>
                    {f.toUpperCase()}
                  </Text>
                  {fmt===f && <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:8, marginTop:2 }}>✓ aktif</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Google Drive Backup — locked jika belum beli BACKUP SYNC */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              BACKUP GOOGLE DRIVE
            </Text>
            {!hasBackup ? (
              <TouchableOpacity onPress={() => openPaywall('backup_drive')}
                style={{ backgroundColor:C.input, borderRadius:14, borderWidth:1.5, borderColor:C.border,
                  borderStyle:'dashed', padding:16, alignItems:'center', gap:8 }}>
                <Text style={{ fontSize:28 }}>🔒</Text>
                <Text style={{ color:C.text, fontSize:14, fontWeight:'800' }}>Backup & Sinkron Terkunci</Text>
                <Text style={{ color:C.muted, fontSize:12, textAlign:'center' }}>
                  Google Drive · Sinkron 2 HP · Widget
                </Text>
                <View style={{ backgroundColor:C.primary, borderRadius:10, paddingHorizontal:18, paddingVertical:9, marginTop:4 }}>
                  <Text style={{ color:'#fff', fontSize:13, fontWeight:'800' }}>Unlock Rp 49.000 →</Text>
                </View>
              </TouchableOpacity>
            ) : driveEmail ? (
              <>
                {/* Warning token expired */}
                {driveTokenExpired && (
                  <View style={{ backgroundColor:C.warning+'22', borderRadius:10, padding:12, marginBottom:10, flexDirection:'row', alignItems:'center', gap:10 }}>
                    <Text style={{ flex:1, color:C.warning, fontSize:12, fontWeight:'700' }}>
                      ⚠️ Sesi expired — backup otomatis berhenti
                    </Text>
                    <TouchableOpacity onPress={onDriveConnect}
                      style={{ backgroundColor:C.warning, borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}>
                      <Text style={{ color:'#fff', fontSize:11, fontWeight:'800' }}>Reconnect</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* Area gmail — tap untuk sinkron */}
                <TouchableOpacity onPress={onDriveSync} disabled={driveSyncing}
                  activeOpacity={0.7}
                  style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:10,
                    paddingVertical:10, paddingHorizontal:12, borderRadius:12,
                    backgroundColor:C.input }}>
                  <View style={{ width:42, height:42, borderRadius:21,
                    backgroundColor:'#4285F422', alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ fontSize:22 }}>☁️</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontSize:13, fontWeight:'700' }}>{driveEmail}</Text>
                    <Text style={{ color: driveSyncing ? C.primary : C.muted, fontSize:11, marginTop:1 }}>
                      {driveSyncing
                        ? 'Synchronizing data...'
                        : driveLastSync
                          ? `Last sync: ${driveLastSync}`
                          : 'Tap untuk sinkron'}
                    </Text>
                  </View>
                  {driveSyncing
                    ? <ActivityIndicator color={C.primary} size="small" />
                    : <Text style={{ color:C.primary, fontSize:22, fontWeight:'200' }}>↻</Text>
                  }
                </TouchableOpacity>
                {/* Backup manual + Restore */}
                <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
                  <TouchableOpacity onPress={onDriveBackup} disabled={driveSyncing}
                    style={{ flex:1, backgroundColor:C.success+'18', borderWidth:1, borderColor:C.success,
                      borderRadius:12, paddingVertical:11, alignItems:'center',
                      opacity: driveSyncing ? 0.5 : 1 }}>
                    <Text style={{ color:C.success, fontSize:12, fontWeight:'700' }}>☁️ Backup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleListDriveFiles} disabled={driveFilesLoading}
                    style={{ flex:1, backgroundColor:C.primary+'18', borderWidth:1, borderColor:C.primary,
                      borderRadius:12, paddingVertical:11, alignItems:'center',
                      opacity: driveFilesLoading ? 0.5 : 1 }}>
                    <Text style={{ color:C.primary, fontSize:12, fontWeight:'700' }}>
                      {driveFilesLoading ? '⏳ Memuat...' : '📥 Restore'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Jam backup otomatis */}
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  backgroundColor:C.input, borderRadius:12, padding:12, marginBottom:10 }}>
                  <Text style={{ color:C.muted, fontSize:12 }}>⏰ Backup otomatis jam:</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <TouchableOpacity
                      onPress={async () => {
                        const h = backupHour === 0 ? 23 : backupHour - 1;
                        setBackupHour(h);
                        await SecureStore.setItemAsync(GDRIVE_HOUR_KEY, String(h));
                      }}
                      style={{ backgroundColor:C.card, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
                      <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={[{ color:C.accent, fontSize:16, fontWeight:'800', minWidth:52, textAlign:'center' }]}>
                      {String(backupHour).padStart(2,'0')}:00
                    </Text>
                    <TouchableOpacity
                      onPress={async () => {
                        const h = backupHour === 23 ? 0 : backupHour + 1;
                        setBackupHour(h);
                        await SecureStore.setItemAsync(GDRIVE_HOUR_KEY, String(h));
                      }}
                      style={{ backgroundColor:C.card, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
                      <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity onPress={onDriveDisconnect}
                  style={{ backgroundColor:C.danger+'11', borderRadius:14, paddingVertical:10, alignItems:'center' }}>
                  <Text style={{ color:C.danger, fontSize:12, fontWeight:'700' }}>Putus Koneksi</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color:C.muted, fontSize:12, marginBottom:12 }}>
                  Backup otomatis harian ke Google Drive. Data aman jika HP hilang atau rusak.
                </Text>
                <TouchableOpacity onPress={onDriveConnect}
                  style={{ backgroundColor:'#4285F422', borderWidth:1.5, borderColor:'#4285F4',
                    borderRadius:14, paddingVertical:14, alignItems:'center' }}>
                  <Text style={{ color:'#4285F4', fontSize:14, fontWeight:'800' }}>
                    🔗 Hubungkan Akun Google
                  </Text>
                </TouchableOpacity>
                <Text style={{ color:C.muted, fontSize:10, textAlign:'center', marginTop:8 }}>
                  Memerlukan koneksi internet saat setup
                </Text>
              </>
            )}
          </View>

          {/* ── LAPORAN ── */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:4 }}>
              LAPORAN
            </Text>
            <Text style={{ color:C.muted, fontSize:11, marginBottom:12 }}>
              Generate laporan Excel profesional siap cetak
            </Text>
            <TouchableOpacity onPress={() => hasExcel ? setShowExcelMenu(true) : openPaywall('excel_export')}
              style={{ backgroundColor: hasExcel ? C.success+'18' : C.input,
                borderWidth:1.5, borderColor: hasExcel ? C.success : C.border,
                borderRadius:14, paddingVertical:16, alignItems:'center' }}>
              <Text style={{ color: hasExcel ? C.success : C.muted, fontSize:15, fontWeight:'800' }}>
                {hasExcel ? '📊' : '🔒'}  Export ke Excel (.xlsx)</Text>
              <Text style={{ color: hasExcel ? C.success : C.muted, fontSize:10, marginTop:3, opacity:0.8 }}>
                {hasExcel ? 'Ringkasan · Per Sales · Bulanan · Pelanggan · Ranking' : 'Laporan & Ekspor — Rp 49.000'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── DATA ── */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              DATA
            </Text>
            {/* ── Import ── */}
            <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', marginBottom:6 }}>IMPORT</Text>
            <TouchableOpacity onPress={handlePickCsv}
              style={{ backgroundColor:C.primary+'18', borderWidth:1.5, borderColor:C.primary, borderRadius:14, paddingVertical:13, alignItems:'center', marginBottom:8 }}>
              <Text style={{ color:C.primary, fontSize:13, fontWeight:'800' }}>📥  Import dari CSV (Google Sheets)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickJson}
              style={{ backgroundColor:C.primary+'18', borderWidth:1.5, borderColor:C.primary, borderRadius:14, paddingVertical:13, alignItems:'center', marginBottom:12 }}>
              <Text style={{ color:C.primary, fontSize:13, fontWeight:'800' }}>🔄  Restore dari Backup JSON</Text>
            </TouchableOpacity>

            {/* ── Export / Backup ── */}
            <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', marginBottom:6 }}>EXPORT & BACKUP</Text>
            <TouchableOpacity onPress={handleExportCsv}
              style={{ backgroundColor:C.success+'18', borderWidth:1.5, borderColor:C.success, borderRadius:14, paddingVertical:13, alignItems:'center', marginBottom:8 }}>
              <Text style={{ color:C.success, fontSize:13, fontWeight:'800' }}>📤  Export ke CSV (Google Sheets)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport}
              style={{ backgroundColor:C.success+'18', borderWidth:1.5, borderColor:C.success, borderRadius:14, paddingVertical:13, alignItems:'center', marginBottom:12 }}>
              <Text style={{ color:C.success, fontSize:13, fontWeight:'800' }}>💾  Export Backup JSON</Text>
            </TouchableOpacity>

            {/* ── Danger ── */}
            <TouchableOpacity onPress={handleReset} style={[btnStyle(C.danger+'33')]}>
              <Text style={{ color:C.danger, fontSize:13, fontWeight:'700' }}>🗑  Reset Semua Data</Text>
            </TouchableOpacity>
          </View>

          {/* Keamanan — PIN / Fingerprint */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              KEAMANAN
            </Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>🔐 Kunci Aplikasi</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>
                  {pinLockEnabled
                    ? '✅ Aktif — pakai fingerprint / PIN HP'
                    : 'Nonaktif — fingerprint / PIN HP saat buka app'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (!pinLockEnabled) {
                    // ── AKTIFKAN: verifikasi dulu sebelum enable ──
                    const hasHw    = await LocalAuthentication.hasHardwareAsync();
                    const enrolled = await LocalAuthentication.isEnrolledAsync();
                    if (!hasHw || !enrolled) {
                      Alert.alert(
                        'Fingerprint Tidak Tersedia',
                        'HP kamu belum memiliki fingerprint atau PIN yang terdaftar.\n\nAktifkan dulu di Pengaturan HP → Keamanan → Kunci Layar.',
                        [{ text: 'Mengerti' }]
                      );
                      return;
                    }
                    const result = await LocalAuthentication.authenticateAsync({
                      promptMessage:         'Verifikasi untuk mengaktifkan Kunci Aplikasi',
                      fallbackLabel:         'Gunakan PIN HP',
                      cancelLabel:           'Batal',
                      disableDeviceFallback: false,
                    });
                    if (!result.success) return;
                    setPinLockEnabled(true);
                    onUpdate({ pinLockEnabled: true, lockTimeout: 0 }); // selalu lock langsung
                    Alert.alert('🔐 Kunci Aktif', 'Aplikasi akan dikunci otomatis saat ditutup.');
                  } else {
                    // ── NONAKTIFKAN: langsung disable ──
                    setPinLockEnabled(false);
                    onUpdate({ pinLockEnabled: false });
                  }
                }}
                style={{ width:50, height:28, borderRadius:14,
                  backgroundColor: pinLockEnabled ? C.success : C.input,
                  justifyContent:'center', paddingHorizontal:3 }}>
                <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
                  alignSelf: pinLockEnabled ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>
            {/* Kunci langsung saat tutup app — seperti aplikasi bank */}
            {pinLockEnabled && (
              <Text style={{ color:C.muted, fontSize:11, marginTop:8 }}>
                🔒 Dikunci otomatis saat aplikasi ditutup
              </Text>
            )}
          </View>

          {/* Notifikasi Pengingat */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              NOTIFIKASI
            </Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: notifEnabled ? 12 : 0 }}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>🔔 Pengingat Harian</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>
                  {notifEnabled ? `✅ Aktif — reminder jam ${String(notifHour).padStart(2,'0')}:00` : 'Nonaktif'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (!notifEnabled) {
                    // Minta permission dulu
                    const { status } = await Notifications.requestPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert(
                        'Izin Notifikasi Diperlukan',
                        'Aktifkan izin notifikasi di Pengaturan HP → Aplikasi → OmsetKu → Notifikasi',
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    setNotifEnabled(true);
                    await scheduleReminder(notifHour, true);
                    onUpdate({ notifEnabled: true, notifHour });
                    Alert.alert('🔔 Notifikasi Aktif', `Reminder akan muncul setiap hari jam ${String(notifHour).padStart(2,'0')}:00`);
                  } else {
                    setNotifEnabled(false);
                    await cancelReminder();
                    onUpdate({ notifEnabled: false });
                  }
                }}
                style={{ width:50, height:28, borderRadius:14,
                  backgroundColor: notifEnabled ? C.success : C.input,
                  justifyContent:'center', paddingHorizontal:3 }}>
                <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
                  alignSelf: notifEnabled ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>
            {notifEnabled && (
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                backgroundColor:C.input, borderRadius:12, padding:12 }}>
                <Text style={{ color:C.muted, fontSize:12 }}>⏰ Jam pengingat:</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      const h = notifHour === 0 ? 23 : notifHour - 1;
                      setNotifHour(h);
                      await scheduleReminder(h, true);
                      onUpdate({ notifEnabled: true, notifHour: h });
                    }}
                    style={{ backgroundColor:C.card, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
                    <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <Text style={{ color:C.accent, fontSize:16, fontWeight:'800', minWidth:52, textAlign:'center' }}>
                    {String(notifHour).padStart(2,'0')}:00
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      const h = notifHour === 23 ? 0 : notifHour + 1;
                      setNotifHour(h);
                      await scheduleReminder(h, true);
                      onUpdate({ notifEnabled: true, notifHour: h });
                    }}
                    style={{ backgroundColor:C.card, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
                    <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Theme — kompak 3 chip, klik langsung simpan */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:10 }}>
              TAMPILAN
            </Text>
            <View style={{ flexDirection:'row', gap:6 }}>
              {[['dark','🌙','Gelap'],['light','☀️','Terang'],['system','📱','Ikuti HP']].map(([val,icon,lbl]) => (
                <TouchableOpacity key={val}
                  onPress={() => { setThemeMode(val); onUpdate({ themeMode: val }); }}
                  style={{ flex:1, paddingVertical:10, borderRadius:10, alignItems:'center', gap:3,
                    backgroundColor: themeMode===val ? C.primary : C.input,
                    borderWidth: themeMode===val ? 0 : 1, borderColor: C.border }}>
                  <Text style={{ fontSize:18 }}>{icon}</Text>
                  <Text style={{ color: themeMode===val ? '#fff' : C.muted, fontSize:10, fontWeight:'700' }}>
                    {lbl}
                  </Text>
                  {themeMode===val && <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:8 }}>✓ aktif</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Kelola Pembelian */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              PEMBELIAN & LANGGANAN
            </Text>

            {/* Daftar yang sudah dibeli */}
            {Object.keys(purchases).length > 0 ? (
              <View style={{ marginBottom:12 }}>
                <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', marginBottom:8 }}>AKTIF</Text>
                {Object.entries(purchases).map(([id, info]) => {
                  const labels = {
                    omsetku_sales_unlock: '✓ Sales Unlock (3 sales)',
                    omsetku_sales_pro: '✓ Sales Pro (10 sales)',
                    omsetku_sales_ultimate: '✓ Sales Ultimate (unlimited)',
                    omsetku_analytics_dashboard: '✓ Analitik Dashboard',
                    omsetku_analytics_customers: '✓ Analitik Pelanggan',
                    omsetku_analytics_export: '✓ Laporan & Ekspor',
                    omsetku_analytics_all: '✓ Semua Analitik',
                    omsetku_backup_sync: '✓ Backup & Sinkron',
                    omsetku_monthly_plus: '✓ Monthly Plus (aktif)',
                    omsetku_yearly_plus: '✓ Yearly Plus (aktif)',
                  };
                  return (
                    <View key={id} style={{ flexDirection:'row', justifyContent:'space-between',
                      paddingVertical:6, borderBottomWidth:1, borderBottomColor:C.border }}>
                      <Text style={{ color:C.success, fontSize:13, fontWeight:'600' }}>
                        {labels[id] || id}
                      </Text>
                      {info.purchasedAt && (
                        <Text style={{ color:C.muted, fontSize:10 }}>
                          {new Date(info.purchasedAt).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color:C.muted, fontSize:12, marginBottom:12, fontStyle:'italic' }}>
                Belum ada pembelian aktif
              </Text>
            )}

            {/* Tombol-tombol kelola */}
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Restore Pembelian',
                'Fitur ini akan terhubung ke Google Play untuk memulihkan pembelian Anda sebelumnya.',
                [{ text:'OK' }]
              )}
              style={{ backgroundColor:C.primary+'18', borderWidth:1, borderColor:C.primary,
                borderRadius:12, paddingVertical:12, alignItems:'center', marginBottom:8 }}>
              <Text style={{ color:C.primary, fontSize:13, fontWeight:'800' }}>
                🔄  Restore Pembelian
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert(
                'Kelola Langganan',
                'Untuk membatalkan atau mengubah langganan, buka:\n\nGoogle Play Store → Profil → Pembayaran & langganan → Langganan → OmsetKu',
                [{ text:'Mengerti' }]
              )}
              style={{ backgroundColor:C.input, borderRadius:12, paddingVertical:12, alignItems:'center' }}>
              <Text style={{ color:C.muted, fontSize:13, fontWeight:'700' }}>
                ⚙  Kelola Langganan di Play Store
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color:C.muted, fontSize:11, textAlign:'center', marginTop:4 }}>
            OmsetKu v{APP_VER}
          </Text>
          <Text style={{ color:C.muted, fontSize:10, textAlign:'center', marginTop:4 }}>
            by @Maelllai
          </Text>
        </ScrollView>
      </View>

      {/* ── Excel Export Checklist Modal ── */}
      {showExcelMenu && (
        <Modal visible animationType="slide" transparent onRequestClose={() => !exporting && setShowExcelMenu(false)}>
          <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.65)' }}>
            <View style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:36 }}>
              <Text style={{ color:C.text, fontSize:18, fontWeight:'800', marginBottom:12 }}>📊 Export ke Excel</Text>

              {/* ── Pilih Periode ── */}
              <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:1, marginBottom:8 }}>
                PERIODE DATA
              </Text>
              <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
                <TouchableOpacity onPress={() => setExcelPeriodType('year')}
                  style={{ flex:1, paddingVertical:10, borderRadius:10, alignItems:'center',
                    backgroundColor: excelPeriodType==='year' ? C.primary : C.input }}>
                  <Text style={{ color: excelPeriodType==='year'?'#fff':C.muted,
                    fontSize:12, fontWeight:'700' }}>
                    Tahun {data.activeYear||new Date().getFullYear()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setExcelPeriodType('month')}
                  style={{ flex:1, paddingVertical:10, borderRadius:10, alignItems:'center',
                    backgroundColor: excelPeriodType==='month' ? C.primary : C.input }}>
                  <Text style={{ color: excelPeriodType==='month'?'#fff':C.muted,
                    fontSize:12, fontWeight:'700' }}>Per Bulan</Text>
                </TouchableOpacity>
              </View>
              {excelPeriodType === 'month' && (
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  backgroundColor:C.input, borderRadius:10, paddingHorizontal:12,
                  paddingVertical:8, marginBottom:10 }}>
                  <TouchableOpacity onPress={() => {
                    let m = excelPeriodMonth-1, y = excelPeriodMonthYear;
                    if (m < 1) { m=12; y--; }
                    setExcelPeriodMonth(m); setExcelPeriodMonthYear(y);
                  }} style={{ padding:6 }}>
                    <Text style={{ color:C.text, fontSize:20, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ color:C.accent, fontSize:15, fontWeight:'800' }}>
                      {MONTHS_F[excelPeriodMonth-1]}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:11 }}>{excelPeriodMonthYear}</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    let m = excelPeriodMonth+1, y = excelPeriodMonthYear;
                    if (m > 12) { m=1; y++; }
                    setExcelPeriodMonth(m); setExcelPeriodMonthYear(y);
                  }} style={{ padding:6 }}>
                    <Text style={{ color:C.text, fontSize:20, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height:1, backgroundColor:C.border, marginBottom:12 }} />
              <Text style={{ color:C.muted, fontSize:12, marginBottom:4 }}>Sheet <Text style={{ color:C.accent, fontWeight:'700' }}>📊 Ringkasan</Text> selalu disertakan</Text>
              <Text style={{ color:C.muted, fontSize:11, marginBottom:10 }}>Tambahkan sheet lain sesuai kebutuhan:</Text>
              {[
                { id:'transaksi', label:'📋 Semua Transaksi',     desc:'Seluruh bon aktif lengkap' },
                { id:'per_sales', label:'👤 Rekap per Sales',      desc:'Total omset & bon per sales' },
                { id:'bulanan',   label:'📅 Rekap Bulanan',        desc:`Omset per bulan tahun ${data.activeYear||new Date().getFullYear()}` },
                { id:'pelanggan', label:'👥 Daftar Pelanggan',     desc:'Semua pelanggan & total belanja' },
                { id:'ranking',   label:'🏆 Ranking Pelanggan',    desc:'Peringkat per sales' },
              ].map(item => {
                const checked = excelChecked[item.id];
                return (
                  <TouchableOpacity key={item.id}
                    onPress={() => setExcelChecked(p => ({...p, [item.id]: !p[item.id]}))}
                    style={{ flexDirection:'row', alignItems:'center', paddingVertical:12,
                      borderBottomWidth:1, borderBottomColor:C.border, gap:12 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:2,
                      borderColor: checked ? C.success : C.muted,
                      backgroundColor: checked ? C.success : 'transparent',
                      alignItems:'center', justifyContent:'center' }}>
                      {checked && <Text style={{ color:'#fff', fontSize:13, fontWeight:'800' }}>✓</Text>}
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>{item.label}</Text>
                      <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{item.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                disabled={exporting}
                onPress={handleExportExcel}
                style={{ backgroundColor:C.success, borderRadius:16, paddingVertical:16,
                  alignItems:'center', marginTop:16, marginBottom:10, opacity: exporting ? 0.6 : 1 }}>
                <Text style={{ color:'#fff', fontSize:15, fontWeight:'800' }}>
                  {exporting ? 'Membuat file...' : `📊 Export ${Object.values(excelChecked).filter(Boolean).length} Sheet`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={exporting} onPress={() => setShowExcelMenu(false)}
                style={{ backgroundColor:C.input, borderRadius:16, paddingVertical:14, alignItems:'center', opacity: exporting ? 0.4 : 1 }}>
                <Text style={{ color:C.muted, fontSize:14, fontWeight:'700' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── JSON Restore Preview Modal ── */}
      {jsonRestorePreview && (
        <Modal visible animationType="slide" transparent onRequestClose={() => !jsonRestoring && setJsonRestorePreview(null)}>
          <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.65)' }}>
            <View style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:36 }}>
              <Text style={{ color:C.text, fontSize:18, fontWeight:'800', marginBottom:16 }}>
                🔄 Preview Restore JSON
              </Text>
              <View style={{ backgroundColor:C.input, borderRadius:14, padding:14, marginBottom:14 }}>
                <Text style={{ color:C.muted, fontSize:11, marginBottom:8 }}>
                  Dari backup v{jsonRestorePreview.appVersion} · {jsonRestorePreview.exportedAt ? new Date(jsonRestorePreview.exportedAt).toLocaleDateString('id-ID') : '?'}
                </Text>
                <Text style={{ color:C.text, fontSize:14, marginBottom:6 }}>
                  📦 <Text style={{ fontWeight:'800', color:C.accent }}>{jsonRestorePreview.allTxns.length}</Text> transaksi
                </Text>
                <Text style={{ color:C.text, fontSize:14, marginBottom:6 }}>
                  👥 Sales: <Text style={{ fontWeight:'800', color:C.primary }}>{jsonRestorePreview.salesNames.join(', ') || '-'}</Text>
                </Text>
                <Text style={{ color:C.text, fontSize:14 }}>
                  💰 Total: <Text style={{ fontWeight:'800', color:C.accent }}>{toIdr(jsonRestorePreview.totalAmt)}</Text>
                </Text>
                {jsonRestorePreview.dupeRows.length > 0 && (
                  <View style={{ backgroundColor:C.warning+'22', borderRadius:8, padding:8, marginTop:10 }}>
                    <Text style={{ color:C.warning, fontSize:12, fontWeight:'800' }}>
                      ⚠️  {jsonRestorePreview.dupeRows.length} transaksi duplikat terdeteksi
                    </Text>
                  </View>
                )}
              </View>

              {jsonRestorePreview.dupeRows.length > 0 ? (
                <>
                  <TouchableOpacity disabled={jsonRestoring}
                    onPress={async () => {
                      setJsonRestoring(true);
                      await onRestoreJson(jsonRestorePreview.nonDupeRows, jsonRestorePreview.salesNames);
                      setJsonRestoring(false);
                      setJsonRestorePreview(null);
                    }}
                    style={{ backgroundColor:C.primary, borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10, opacity: jsonRestoring ? 0.6 : 1 }}>
                    <Text style={{ color:'#fff', fontSize:14, fontWeight:'800' }}>
                      {jsonRestoring ? 'Memproses...' : `✓ Restore ${jsonRestorePreview.nonDupeRows.length} (Lewati Duplikat)`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={jsonRestoring}
                    onPress={async () => {
                      setJsonRestoring(true);
                      await onRestoreJson(jsonRestorePreview.allTxns, jsonRestorePreview.salesNames);
                      setJsonRestoring(false);
                      setJsonRestorePreview(null);
                    }}
                    style={{ backgroundColor:C.warning+'22', borderWidth:1.5, borderColor:C.warning, borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10, opacity: jsonRestoring ? 0.6 : 1 }}>
                    <Text style={{ color:C.warning, fontSize:14, fontWeight:'800' }}>
                      {jsonRestoring ? 'Memproses...' : `Restore Semua ${jsonRestorePreview.allTxns.length}`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity disabled={jsonRestoring}
                  onPress={async () => {
                    setJsonRestoring(true);
                    await onRestoreJson(jsonRestorePreview.allTxns, jsonRestorePreview.salesNames);
                    setJsonRestoring(false);
                    setJsonRestorePreview(null);
                  }}
                  style={{ backgroundColor:C.success, borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10, opacity: jsonRestoring ? 0.6 : 1 }}>
                  <Text style={{ color:'#fff', fontSize:15, fontWeight:'800' }}>
                    {jsonRestoring ? 'Memproses...' : `✓ Restore ${jsonRestorePreview.allTxns.length} Transaksi`}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity disabled={jsonRestoring} onPress={() => setJsonRestorePreview(null)}
                style={{ backgroundColor:C.input, borderRadius:16, paddingVertical:14, alignItems:'center', opacity: jsonRestoring ? 0.4 : 1 }}>
                <Text style={{ color:C.muted, fontSize:14, fontWeight:'700' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Import Preview Modal ── */}
      {importPreview && (
        <Modal visible animationType="slide" transparent onRequestClose={() => !importing && setImportPreview(null)}>
          <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.65)' }}>
            <View style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:36 }}>
              <Text style={{ color:C.text, fontSize:18, fontWeight:'800', marginBottom:16 }}>
                📋 Preview Import CSV
              </Text>

              {/* Stats */}
              <View style={{ backgroundColor:C.input, borderRadius:14, padding:14, marginBottom:14 }}>
                <Text style={{ color:C.text, fontSize:14, marginBottom:6 }}>
                  📦 Ditemukan{' '}
                  <Text style={{ fontWeight:'800', color:C.accent }}>{importPreview.allRows.length}</Text>
                  {' '}transaksi
                </Text>
                <Text style={{ color:C.text, fontSize:14, marginBottom:6 }}>
                  👥 Sales:{' '}
                  <Text style={{ fontWeight:'800', color:C.primary }}>
                    {importPreview.salesNames.length} ({importPreview.salesNames.join(', ')})
                  </Text>
                </Text>
                <Text style={{ color:C.text, fontSize:14, marginBottom:6 }}>
                  💰 Total Transaksi:{' '}
                  <Text style={{ fontWeight:'800', color:C.accent }}>{toIdr(importPreview.totalAmt)}</Text>
                </Text>
                <Text style={{ color:C.text, fontSize:14 }}>
                  🧾 Total Bon:{' '}
                  <Text style={{ fontWeight:'800' }}>{importPreview.allRows.length}</Text>
                </Text>
                {importPreview.dupeRows.length > 0 && (
                  <View style={{ backgroundColor:C.warning+'22', borderRadius:10, padding:10, marginTop:10 }}>
                    <Text style={{ color:C.warning, fontSize:13, fontWeight:'800' }}>
                      ⚠️  {importPreview.dupeRows.length} transaksi duplikat terdeteksi
                    </Text>
                    <Text style={{ color:C.muted, fontSize:11, marginTop:3 }}>
                      Duplikat = tanggal + nama pelanggan + nominal sama dengan data yang sudah ada
                    </Text>
                  </View>
                )}
              </View>

              {/* Action buttons */}
              {importPreview.dupeRows.length > 0 ? (
                <>
                  <TouchableOpacity
                    disabled={importing || importPreview.nonDupeRows.length === 0}
                    onPress={async () => {
                      setImporting(true);
                      await onImport(importPreview.nonDupeRows);
                      setImporting(false);
                      setImportPreview(null);
                    }}
                    style={{ backgroundColor: importPreview.nonDupeRows.length===0 ? C.muted : C.primary,
                      borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10,
                      opacity: importing ? 0.6 : 1 }}>
                    <Text style={{ color:'#fff', fontSize:14, fontWeight:'800' }}>
                      {importing ? 'Mengimport...' : `✓ Import ${importPreview.nonDupeRows.length} (Lewati ${importPreview.dupeRows.length} Duplikat)`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={importing}
                    onPress={async () => {
                      setImporting(true);
                      await onImport(importPreview.allRows);
                      setImporting(false);
                      setImportPreview(null);
                    }}
                    style={{ backgroundColor: C.warning+'22', borderWidth:1.5, borderColor:C.warning,
                      borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10,
                      opacity: importing ? 0.6 : 1 }}>
                    <Text style={{ color:C.warning, fontSize:14, fontWeight:'800' }}>
                      {importing ? 'Mengimport...' : `Import Semua ${importPreview.allRows.length} (Termasuk Duplikat)`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  disabled={importing}
                  onPress={async () => {
                    setImporting(true);
                    await onImport(importPreview.allRows);
                    setImporting(false);
                    setImportPreview(null);
                  }}
                  style={{ backgroundColor: C.success, borderRadius:16, paddingVertical:16,
                    alignItems:'center', marginBottom:10, opacity: importing ? 0.6 : 1 }}>
                  <Text style={{ color:'#fff', fontSize:15, fontWeight:'800' }}>
                    {importing ? 'Mengimport...' : `✓ Import ${importPreview.allRows.length} Transaksi`}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                disabled={importing}
                onPress={() => setImportPreview(null)}
                style={{ backgroundColor:C.input, borderRadius:16, paddingVertical:16, alignItems:'center', opacity: importing ? 0.4 : 1 }}>
                <Text style={{ color:C.muted, fontSize:14, fontWeight:'700' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modal Daftar Backup di Google Drive ── */}
      {showDriveFiles && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setShowDriveFiles(false)}>
          <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.65)' }}>
            <View style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24,
              padding:20, paddingBottom:36 }}>
              <Text style={{ color:C.text, fontSize:17, fontWeight:'800', marginBottom:4 }}>
                ☁️ Pilih Backup dari Drive
              </Text>
              <Text style={{ color:C.muted, fontSize:11, marginBottom:14 }}>
                {driveFileList.length} file tersedia · tap untuk restore
              </Text>
              <ScrollView style={{ maxHeight:360 }}>
                {driveFileList.map(file => {
                  // Extract tanggal dari nama file: omsetku-backup-YYYY-MM-DD.json
                  const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
                  const dateLabel = dateMatch
                    ? fmtDate(dateMatch[1], data.dateFormat)
                    : new Date(file.modifiedTime).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
                  const sizeKB = file.size ? `${Math.round(parseInt(file.size,10)/1024)} KB` : '';
                  return (
                    <TouchableOpacity key={file.id}
                      onPress={() => handleDownloadDriveRestore(file)}
                      style={{ flexDirection:'row', alignItems:'center', paddingVertical:12,
                        borderBottomWidth:1, borderBottomColor:C.border, gap:12 }}>
                      <Text style={{ fontSize:24 }}>📄</Text>
                      <View style={{ flex:1 }}>
                        <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>{dateLabel}</Text>
                        <Text style={{ color:C.muted, fontSize:11, marginTop:1 }}>
                          {new Date(file.modifiedTime).toLocaleTimeString('id-ID',
                            { hour:'2-digit', minute:'2-digit' })}
                          {sizeKB ? `  ·  ${sizeKB}` : ''}
                        </Text>
                      </View>
                      <Text style={{ color:C.primary, fontSize:13, fontWeight:'700' }}>Restore ›</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => setShowDriveFiles(false)}
                style={{ marginTop:14, backgroundColor:C.input, borderRadius:12,
                  padding:12, alignItems:'center' }}>
                <Text style={{ color:C.muted, fontWeight:'700' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}


// ─── CUSTOMER LIST + DETAIL ───────────────────────────────────────────────────
export default SettingsModal;
