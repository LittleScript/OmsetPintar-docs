/**
 * OmsetKu — App.js
 * React Native (Expo) | Storage: expo-sqlite | All screens complete
 *
 * Fixed from DeepSeek baseline:
 *  - HistoryScreen, RankingScreen, SettingsModal: fully implemented
 *  - Storage: expo-sqlite (no JSON blob, proper tables + indexes)
 *  - parseBon: handles dateCode formats
 *  - todayStr: uses local timezone (not UTC)
 *  - styles: moved fn helpers outside StyleSheet.create
 *  - Double-save prevention on Input
 *  - Soft delete with 24h undo in History
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, useContext, createContext } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, Dimensions, Platform, Modal, ActivityIndicator,
  KeyboardAvoidingView, StatusBar, useColorScheme, Image, BackHandler, ToastAndroid,
  Share, AppState,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as XLSX from 'xlsx';
import * as LocalAuthentication from 'expo-local-authentication';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MONTHS     = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MONTHS_F   = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const COLORS     = ['#2563eb','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
const DB_NAME    = 'tracker_omset.db';

// ─── THEMES ───────────────────────────────────────────────────────────────────
const DARK_THEME = {
  bg:'#071018', card:'#0f1720', input:'#0a1929',
  border:'rgba(255,255,255,0.07)', primary:'#2563eb',
  success:'#22c55e', warning:'#f59e0b', text:'#f1f5f9',
  muted:'#64748b', accent:'#F57F17', danger:'#ef4444',
};
const LIGHT_THEME = {
  bg:'#f0f4f8', card:'#ffffff', input:'#e2e8f0',
  border:'rgba(0,0,0,0.09)', primary:'#2563eb',
  success:'#16a34a', warning:'#d97706', text:'#1e293b',
  muted:'#64748b', accent:'#ea580c', danger:'#dc2626',
};
const APP_VER    = '3.8.0';
const SCHEMA_VER = 1;
const { width: SW } = Dimensions.get('window');

// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
const ThemeContext = createContext(DARK_THEME);

// Dynamic styles — called inside each component with current C
// Replaces StyleSheet.create (plain objects are fine for this app size)
const getStyles = (C) => ({
  flex1:     { flex: 1 },
  container: { flex:1, backgroundColor:C.bg },
  scroll:    { paddingHorizontal:14, paddingBottom:110 },
  card:      { backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:C.border, padding:16, marginBottom:12 },
  input:     { backgroundColor:C.input, borderWidth:1.5, borderColor:C.border, borderRadius:12, padding:14, color:C.text, fontSize:16 },
  label:     { color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  mono:      { fontFamily: Platform.OS==='ios' ? 'Courier New' : 'monospace' },
  row:       { flexDirection:'row', alignItems:'center' },
  sep:       { height:1, backgroundColor:C.border, marginVertical:8 },
});

// Module-level C reference (for non-component code only — analytics helpers etc.)
let C = DARK_THEME;

// ─── UTILS ────────────────────────────────────────────────────────────────────
const toIdr   = n => 'Rp ' + (n||0).toLocaleString('id-ID');
const toShort = n => n>=1e9?(n/1e9).toFixed(1)+'M':n>=1e6?(n/1e6).toFixed(1)+'Jt':n>=1e3?(n/1e3).toFixed(0)+'K':String(n||0);
const padNum  = (n, len) => String(n).padStart(len, '0');

// FIX: use local date, not UTC (avoids midnight UTC bug in WIB/UTC+7)
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

const fmtDate = (s, fmt='dd/mm/yyyy') => {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  if (!y||!m||!d) return s;
  if (fmt==='mm/dd/yyyy') return `${m}/${d}/${y}`;
  if (fmt==='yyyy/mm/dd') return `${y}/${m}/${d}`;
  return `${d}/${m}/${y}`;
};

const genBon = (seq, cfg) =>
  (cfg.prefix||'') + (cfg.separator||'') + padNum(seq, cfg.digitLength||5);

// FIX: proper parseBon that handles dateCode formats
// Strategy: strip known prefix+separator, then parse trailing digits
const parseBon = (bonStr, cfg) => {
  if (!bonStr) return 0;
  const p = cfg.prefix || '';
  const s = cfg.separator || '';
  // Remove prefix+separator from start
  let rest = bonStr.startsWith(p + s) ? bonStr.slice((p+s).length) : bonStr;
  // If there's still a separator, take only the last segment (dateCode segment)
  if (s && rest.includes(s)) {
    const parts = rest.split(s);
    rest = parts[parts.length - 1];
  }
  return parseInt(rest, 10) || 0;
};

const getMondayOfWeek = (date) => {
  const d = new Date(date + 'T12:00:00'); // noon to avoid DST
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const getNorm = name => (name||'').trim().toLowerCase().replace(/\s+/g,' ');

// ─── SQLITE LAYER ─────────────────────────────────────────────────────────────
let _db = null;

async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

async function initDb() {
  const db = await getDb();
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  // Drop unique bon constraint if it exists (for existing installs)
  try { await db.execAsync(`DROP INDEX IF EXISTS idx_bon_unique`); } catch(e) {}
  // Add edit-tracking columns if not exist
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN edited_at TEXT`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN original_values TEXT`); } catch(e) {}
  // Migration: add theme_mode column if not exists
  try {
    await db.execAsync(`ALTER TABLE settings ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'dark'`);
  } catch(e) { /* column already exists, ok */ }
  try {
    await db.execAsync(`ALTER TABLE settings ADD COLUMN pin_lock_enabled INTEGER NOT NULL DEFAULT 0`);
  } catch(e) {}
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
      company_name       TEXT    NOT NULL DEFAULT '',
      is_setup_complete  INTEGER NOT NULL DEFAULT 0,
      bon_prefix         TEXT    NOT NULL DEFAULT 'INV',
      bon_separator      TEXT    NOT NULL DEFAULT '-',
      bon_digit_length   INTEGER NOT NULL DEFAULT 5,
      date_format        TEXT    NOT NULL DEFAULT 'dd/mm/yyyy',
      active_year        INTEGER NOT NULL DEFAULT ${new Date().getFullYear()},
      last_date          TEXT    NOT NULL DEFAULT '${todayStr()}',
      last_sales         TEXT    NOT NULL DEFAULT '',
      current_seq        INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS sales (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL UNIQUE,
      color         TEXT    NOT NULL DEFAULT '#2563eb',
      active        INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      bon_number       TEXT    NOT NULL,
      bon_seq          INTEGER NOT NULL,
      sales_name       TEXT    NOT NULL,
      customer_name    TEXT    NOT NULL,
      customer_norm    TEXT    NOT NULL,
      amount           INTEGER NOT NULL CHECK(amount > 0),
      transaction_date TEXT    NOT NULL,
      year             INTEGER NOT NULL,
      year_month       TEXT    NOT NULL,
      notes            TEXT    NOT NULL DEFAULT '',
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL,
      deleted_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_txn_date      ON transactions(transaction_date)  WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_year      ON transactions(year, sales_name)  WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_yearmonth ON transactions(year_month)        WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_customer  ON transactions(sales_name, customer_norm) WHERE deleted_at IS NULL;
    -- NOTE: NO unique index on bon_number — same number allowed across sales or after reset
  `);
}

// ─── DATA ACCESS ──────────────────────────────────────────────────────────────
async function loadSettings(db) {
  return db.getFirstAsync('SELECT * FROM settings WHERE id=1');
}

async function loadSales(db) {
  return db.getAllAsync('SELECT * FROM sales WHERE active=1 ORDER BY display_order ASC');
}

async function loadTransactions(db) {
  return db.getAllAsync(
    'SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC'
  );
}

function dbRowToTx(row) {
  return {
    id:          row.id,
    bonNumber:   row.bon_number,
    bonSeq:      row.bon_seq,
    sales:       row.sales_name,
    customerName:row.customer_name,
    customerId:  row.sales_name+'___'+row.customer_norm,
    amount:      row.amount,
    date:        row.transaction_date,
    notes:       row.notes || '',
    createdAt:   row.created_at,
    deletedAt:     row.deleted_at || null,
    editedAt:      row.edited_at || null,
    originalValues:row.original_values ? JSON.parse(row.original_values) : null,
  };
}

async function assembleData(db) {
  const cfg  = await loadSettings(db);
  if (!cfg) return null;
  const salesRows = await loadSales(db);
  const txRows    = await loadTransactions(db);
  return {
    themeMode:      cfg.theme_mode || 'dark',
    pinLockEnabled: !!cfg.pin_lock_enabled,
    companyName:    cfg.company_name,
    isSetupComplete:!!cfg.is_setup_complete,
    bonConfig: {
      prefix:      cfg.bon_prefix,
      separator:   cfg.bon_separator,
      digitLength: cfg.bon_digit_length,
    },
    dateFormat:  cfg.date_format,
    activeYear:  cfg.active_year || new Date().getFullYear(),
    lastDate:    cfg.last_date   || todayStr(),
    lastSales:   cfg.last_sales  || (salesRows[0]?.name || ''),
    nextSeq:     cfg.current_seq || 1,
    salesList:   salesRows.map(s => s.name),
    salesData:   salesRows,
    transactions:txRows.map(dbRowToTx),
  };
}

async function insertTransaction(db, tx) {
  const now = new Date().toISOString();
  const year = parseInt(tx.date.slice(0,4), 10);
  const ym   = tx.date.slice(0,7);
  const norm = getNorm(tx.customerName);
  // Duplicate check (warn only, don't block)
  const exists = await db.getFirstAsync(
    'SELECT id FROM transactions WHERE bon_number=? AND deleted_at IS NULL', [tx.bonNumber]
  );
  if (exists) {
    console.warn(`Bon ${tx.bonNumber} already exists — using anyway`);
  }
  // BUG FIX 4: continuation from manual bon number
  // Extract last digit sequence from bon number, use max(nextSeq+1, parsedBon+1)
  const parsedBonSeq = parseInt((tx.bonNumber||'').match(/(\d+)$/)?.[1]||'0', 10)||0;
  // FIX 3: When manual override (even to lower number), follow parsedBonSeq + 1
  // Example: seq=50, user edits to 25 → next bon is 26 (not 51)
  tx.nextSeqAfterSave = tx.bonManual ? parsedBonSeq + 1 : tx.nextSeq + 1;

  await db.runAsync(
    `INSERT INTO transactions
     (bon_number,bon_seq,sales_name,customer_name,customer_norm,amount,
      transaction_date,year,year_month,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [tx.bonNumber, tx.nextSeq, tx.sales, tx.customerName.trim(), norm,
     tx.amount, tx.date, year, ym, tx.notes||'', now, now]
  );
  await db.runAsync(
    `UPDATE settings SET current_seq=?, last_date=?, last_sales=? WHERE id=1`,
    [tx.nextSeqAfterSave, tx.date, tx.sales]
  );
}

async function updateTransaction(db, id, fields, originalTx) {
  const now = new Date().toISOString();
  const sets = [];
  const vals = [];
  if (fields.bonNumber  != null) { sets.push('bon_number=?');       vals.push(fields.bonNumber); }
  if (fields.sales      != null) { sets.push('sales_name=?');       vals.push(fields.sales); }
  if (fields.customerName!=null) {
    sets.push('customer_name=?'); vals.push(fields.customerName.trim());
    sets.push('customer_norm=?'); vals.push(getNorm(fields.customerName));
  }
  if (fields.amount     != null) { sets.push('amount=?');           vals.push(fields.amount); }
  if (fields.date       != null) {
    sets.push('transaction_date=?'); vals.push(fields.date);
    sets.push('year=?');             vals.push(parseInt(fields.date.slice(0,4),10));
    sets.push('year_month=?');       vals.push(fields.date.slice(0,7));
  }
  if (fields.notes      != null) { sets.push('notes=?');            vals.push(fields.notes); }
  if (!sets.length) return;
  // Save edit audit: only snapshot original values on FIRST edit
  if (originalTx && !originalTx.editedAt) {
    sets.push('edited_at=?');
    vals.push(now);
    sets.push('original_values=?');
    vals.push(JSON.stringify({
      bonNumber: originalTx.bonNumber,
      sales: originalTx.sales,
      customerName: originalTx.customerName,
      amount: originalTx.amount,
      date: originalTx.date,
      notes: originalTx.notes,
    }));
  } else if (originalTx) {
    // Already edited before — just update edited_at timestamp
    sets.push('edited_at=?'); vals.push(now);
  }
  sets.push('updated_at=?'); vals.push(now);
  vals.push(id);
  await db.runAsync(`UPDATE transactions SET ${sets.join(',')} WHERE id=?`, vals);
}

async function softDeleteTransaction(db, id) {
  await db.runAsync(
    `UPDATE transactions SET deleted_at=? WHERE id=?`,
    [new Date().toISOString(), id]
  );
}

async function restoreTransaction(db, id) {
  await db.runAsync(
    `UPDATE transactions SET deleted_at=NULL, updated_at=? WHERE id=?`,
    [new Date().toISOString(), id]
  );
}

async function setupBusiness(db, setup) {
  // Upsert settings
  await db.runAsync(
    `UPDATE settings SET company_name=?,bon_prefix=?,bon_separator=?,
     bon_digit_length=?,date_format=?,is_setup_complete=1 WHERE id=1`,
    [setup.companyName, setup.bonConfig.prefix,
     setup.bonConfig.separator, setup.bonConfig.digitLength, setup.dateFormat]
  );
  // Reconcile sales
  for (let i=0; i<setup.salesList.length; i++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO sales (name, color, display_order) VALUES (?,?,?)`,
      [setup.salesList[i], COLORS[i % COLORS.length], i]
    );
  }
}

async function updateSettings(db, fields) {
  const sets = [];
  const vals = [];
  if (fields.companyName!=null){ sets.push('company_name=?');    vals.push(fields.companyName); }
  if (fields.dateFormat !=null){ sets.push('date_format=?');     vals.push(fields.dateFormat); }
  if (fields.bonPrefix  !=null){ sets.push('bon_prefix=?');      vals.push(fields.bonPrefix); }
  if (fields.bonSeparator!=null){ sets.push('bon_separator=?');  vals.push(fields.bonSeparator); }
  if (fields.bonDigits  !=null){ sets.push('bon_digit_length=?');vals.push(fields.bonDigits); }
  if (fields.activeYear !=null){ sets.push('active_year=?');     vals.push(fields.activeYear); }
  if (fields.themeMode     !=null){ sets.push('theme_mode=?');       vals.push(fields.themeMode); }
  if (fields.pinLockEnabled!=null){ sets.push('pin_lock_enabled=?'); vals.push(fields.pinLockEnabled?1:0); }
  if (!sets.length) return;
  await db.runAsync(`UPDATE settings SET ${sets.join(',')} WHERE id=1`, vals);
}

async function addSales(db, name, color, order) {
  await db.runAsync(
    `INSERT OR IGNORE INTO sales (name,color,display_order) VALUES (?,?,?)`,
    [name.toUpperCase(), color || COLORS[order%COLORS.length], order]
  );
}

async function deactivateSales(db, name) {
  await db.runAsync(`UPDATE sales SET active=0 WHERE name=?`, [name]);
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function getWeekBounds(refDate) {
  const mon = getMondayOfWeek(refDate);
  const d   = new Date(mon + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  const sun = d.toISOString().slice(0,10);
  return { mon, sun };
}

function filterByPeriod(txns, period, year, month) {
  const today = todayStr();
  switch(period) {
    case 'today': return txns.filter(t => t.date === today);
    case 'week': {
      const { mon, sun } = getWeekBounds(today);
      return txns.filter(t => t.date >= mon && t.date <= sun);
    }
    case 'month': {
      const ym = `${year}-${String(month).padStart(2,'0')}`;
      return txns.filter(t => t.date.startsWith(ym));
    }
    default: // year
      return txns.filter(t => t.date.startsWith(String(year)));
  }
}

function getRanking(txns, sales) {
  const map = {};
  txns.filter(t => t.sales === sales && !t.deletedAt).forEach(t => {
    const k = getNorm(t.customerName);
    if (!map[k]) map[k] = { name:t.customerName, total:0, count:0, last:'' };
    map[k].total += t.amount;
    map[k].count += 1;
    if (t.date > map[k].last) map[k].last = t.date;
  });
  return Object.values(map).sort((a,b) => b.total-a.total);
}

function getAutocomplete(query, txns, sales, limit=5) {
  if (query.length < 2) return [];
  const q = query.trim().toLowerCase();
  const map = {};
  txns.filter(t => t.sales===sales && !t.deletedAt).forEach(t => {
    const k = getNorm(t.customerName);
    if (!map[k]) map[k] = { name:t.customerName, count:0 };
    map[k].count++;
  });
  const all = Object.values(map);
  const ini = n => n.split(' ').filter(Boolean).map(w=>w[0]).join('').toLowerCase();
  const L1 = all.filter(c => c.name.toLowerCase().startsWith(q));
  const L2 = all.filter(c => !L1.includes(c) && ini(c.name).startsWith(q));
  const L3 = all.filter(c => !L1.includes(c) && !L2.includes(c) && c.name.toLowerCase().includes(q));
  return [...L1,...L2,...L3].sort((a,b)=>b.count-a.count).slice(0,limit);
}

// ─── CSV IMPORT PARSER ────────────────────────────────────────────────────────
// Format sheet: No.Bon | Sales | - | Tanggal(dd/mm/yyyy) | Pelanggan | Nominal | Catatan
function parseCsvText(text, bonConfig) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // Auto-detect delimiter (semicolon vs comma)
  const sample = lines.slice(0, 6).join('');
  const delim  = (sample.match(/;/g)||[]).length > (sample.match(/,/g)||[]).length ? ';' : ',';

  const splitLine = (line) => {
    const fields = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (c === delim && !inQ) { fields.push(cur.trim()); cur=''; }
      else cur += c;
    }
    fields.push(cur.trim());
    return fields;
  };

  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = splitLine(line);
    // Col 0: bon seq — must be parseable as positive integer
    const bonSeq = parseInt((f[0]||'').replace(/\D/g,''), 10);
    if (!bonSeq) continue;
    // Col 1: sales name
    const sales = (f[1]||'').trim().toUpperCase();
    if (!sales || sales === 'SALES') continue;
    // Auto-detect separator column: jika col 2 mengandung '/' → itu tanggal (tidak ada sep col)
    // Sheet dengan kolom '-' → hasSepCol true → tanggal di col 3
    // CSV export yang kolom '-' tidak ikut → hasSepCol false → tanggal di col 2
    const hasSepCol = !(f[2]||'').includes('/');
    const dateIdx  = hasSepCol ? 3 : 2;
    const nameIdx  = hasSepCol ? 4 : 3;
    const amtIdx   = hasSepCol ? 5 : 4;
    const notesIdx = hasSepCol ? 6 : 5;
    // Date dd/mm/yyyy
    const dRaw   = (f[dateIdx]||'').trim();
    const dParts = dRaw.split('/');
    if (dParts.length !== 3) continue;
    const date = `${dParts[2].padStart(4,'0')}-${dParts[1].padStart(2,'0')}-${dParts[0].padStart(2,'0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    // Customer name
    const customerName = (f[nameIdx]||'').trim();
    if (!customerName) continue;
    // Amount — strip semua non-digit (handles "2,399,500" dan "2.399.500")
    const amount = parseInt((f[amtIdx]||'').replace(/[^\d]/g,''), 10);
    if (!amount || amount <= 0) continue;
    // Notes (optional)
    const notes = (f[notesIdx]||'').trim();
    // Generate bon number using current app prefix config
    const bonNumber = genBon(bonSeq, bonConfig);
    rows.push({ bonSeq, bonNumber, sales, date, customerName, amount, notes });
  }
  return rows;
}

// ─── STYLE HELPERS (outside StyleSheet to avoid closure issues) ───────────────
const btnStyle = (bg, fg='#fff') => ({
  backgroundColor: bg, borderRadius: 16,
  paddingVertical: 16, alignItems: 'center',
  justifyContent: 'center', width: '100%',
});
const chipStyle = (active, color) => ({
  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
  backgroundColor: active ? (color || C.primary) : C.input,
  marginRight: 8,
});

// StyleSheet moved to getStyles(C) — called inside each component

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
const SalesChip = ({ name, active, color, onPress }) => (
  <TouchableOpacity onPress={onPress} style={chipStyle(active, color)}>
    <Text style={{ color: active ? '#fff' : C.muted, fontSize:14, fontWeight:'700' }}>
      {name}
    </Text>
  </TouchableOpacity>
);

const KpiCard = ({ label, value, sub, color, style }) => {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  return (
  <View style={[st.card, { padding:12, flex:1 }, style]}>
    <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.7, textTransform:'uppercase', marginBottom:4 }}>
      {label}
    </Text>
    <Text style={[st.mono, { color:color||C.text, fontSize:18, fontWeight:'800' }]}
      numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
      {value}
    </Text>
    {sub ? <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{sub}</Text> : null}
  </View>
  );
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const [name, setName] = useState('');
  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:24, backgroundColor:C.bg }}>
      <Image source={require('./assets/icon.png')}
        style={{ width:90, height:90, borderRadius:20, marginBottom:16 }} />
      <Text style={{ color:C.text, fontSize:24, fontWeight:'800', marginBottom:8 }}>
        OmsetKu
      </Text>
      <Text style={{ color:C.muted, fontSize:14, marginBottom:28, textAlign:'center' }}>
        Masukkan nama bisnis kamu
      </Text>
      <TextInput
        value={name} onChangeText={setName}
        placeholder="Contoh: Toko Maju Jaya" placeholderTextColor={C.muted}
        style={[st.input, { width:'100%', maxWidth:320, textAlign:'center', fontSize:17 }]}
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && onLogin(name.trim())}
      />
      <TouchableOpacity
        onPress={() => name.trim() && onLogin(name.trim())}
        style={[btnStyle(C.primary), { maxWidth:320, marginTop:14 }]}
      >
        <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>MASUK</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SETUP WIZARD ─────────────────────────────────────────────────────────────
function SetupWizard({ data, onComplete }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const [step, setStep]         = useState(1);
  const [company, setCompany]   = useState(data?.companyName || '');
  const [numS, setNumS]         = useState('2');
  // FIX: use ref (not state) for sales names to prevent Android double-input bug
  // onChangeText updating state causes IME to re-fire on some Android keyboards
  const salesNamesRef = useRef({});
  const [prefix, setPrefix]     = useState('INV');
  const [sep, setSep]           = useState('-');
  const [digits, setDigits]     = useState('5');
  const [fmt, setFmt]           = useState('dd/mm/yyyy');

  // Note: sales name values are managed via salesNamesRef, no useEffect needed

  const finish = () => {
    const numSalesInt2 = Math.min(20, Math.max(1, parseInt(numS)||1));
    const refValues = Array.from({length: numSalesInt2}, (_, i) => salesNamesRef.current[i] || '');
    const valid = refValues.filter(n => n.trim());
    if (!company.trim()) { Alert.alert('','Isi nama bisnis dulu'); return; }
    if (!valid.length)   { Alert.alert('','Minimal 1 sales'); return; }
    onComplete({
      companyName: company.trim(),
      salesList:   valid.map(s => s.toUpperCase()),
      bonConfig:   { prefix: prefix.toUpperCase(), separator: sep, digitLength: Math.max(1, parseInt(digits)||5) },
      dateFormat:  fmt,
    });
  };

  const Steps = [null,
    // Step 1: company
    <View key={1}>
      <Text style={{ color:C.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>Nama Bisnis</Text>
      <TextInput value={company} onChangeText={setCompany}
        placeholder="Toko Mainan Ceria" placeholderTextColor={C.muted} style={st.input} />
    </View>,
    // Step 2: num sales
    <View key={2}>
      <Text style={{ color:C.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>Jumlah Sales</Text>
      <TextInput value={numS} onChangeText={v => setNumS(v.replace(/\D/g,''))}
        keyboardType="number-pad" style={[st.input, {width:100}]} />
    </View>,
    // Step 3: sales names
    <View key={3}>
      <Text style={{ color:C.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>Nama Sales</Text>
      {Array.from({ length: Math.min(20, Math.max(1, parseInt(numS)||1)) }, (_, i) => (
        <TextInput
          key={`sales-${i}-${numS}`}
          defaultValue={salesNamesRef.current[i] || ''}
          onChangeText={v => { salesNamesRef.current[i] = v; }}
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="none"
          placeholder={`Sales ${i+1}`}
          placeholderTextColor={C.muted}
          style={[st.input, {marginBottom:8}]}
        />
      ))}
    </View>,
    // Step 4: bon format
    <View key={4}>
      <Text style={{ color:C.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>Format Nomor Bon</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
        <View style={{ flex:1 }}>
          <Text style={st.label}>Prefix</Text>
          <TextInput value={prefix} onChangeText={v=>setPrefix(v.toUpperCase())} style={st.input} placeholderTextColor={C.muted}/>
        </View>
        <View style={{ width:60 }}>
          <Text style={st.label}>Sep.</Text>
          <TextInput value={sep} onChangeText={setSep} style={st.input} placeholderTextColor={C.muted}/>
        </View>
        <View style={{ width:60 }}>
          <Text style={st.label}>Digit</Text>
          <TextInput value={digits} onChangeText={v=>setDigits(v.replace(/\D/g,''))}
            keyboardType="number-pad" style={st.input} placeholderTextColor={C.muted}/>
        </View>
      </View>
      <Text style={[st.mono, { color:C.accent, fontSize:18, fontWeight:'800' }]}>
        {prefix}{sep}{padNum(1, parseInt(digits)||5)}
      </Text>
    </View>,
    // Step 5: date format
    <View key={5}>
      <Text style={{ color:C.text, fontSize:20, fontWeight:'800', marginBottom:12 }}>Format Tanggal</Text>
      {['dd/mm/yyyy','mm/dd/yyyy','yyyy/mm/dd'].map(f => (
        <TouchableOpacity key={f} onPress={() => setFmt(f)}
          style={[st.card, { flexDirection:'row', justifyContent:'space-between', marginBottom:8 }]}>
          <Text style={{ color:C.text, fontSize:14 }}>{f.toUpperCase()}</Text>
          {fmt===f && <Text style={{ color:C.success }}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>,
  ];

  return (
    <KeyboardAvoidingView style={st.flex1} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={st.container} contentContainerStyle={{ padding:20 }}>
        <Text style={{ color:C.muted, fontSize:12, fontWeight:'700', marginBottom:16 }}>
          LANGKAH {step} / 5
        </Text>
        {Steps[step]}
        <View style={{ flexDirection:'row', gap:10, marginTop:20, marginBottom:40 }}>
          {step>1 && (
            <TouchableOpacity onPress={() => setStep(step-1)}
              style={[btnStyle(C.input), {flex:1}]}>
              <Text style={{ color:C.text, fontSize:15, fontWeight:'700' }}>Kembali</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => step<5 ? setStep(step+1) : finish()}
            style={[btnStyle(C.primary), {flex:2}]}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>
              {step<5 ? 'Lanjut →' : '🚀 Mulai'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── INPUT SCREEN ─────────────────────────────────────────────────────────────
function InputScreen({ data, onSave, dirtyRef }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, transactions, lastSales, lastDate, nextSeq, bonConfig, dateFormat } = data;

  const [sales, setSales]         = useState(lastSales || salesList[0] || '');
  const [customer, setCustomer]   = useState('');
  const [amount, setAmount]       = useState('');
  const [date, setDate]           = useState(lastDate || todayStr());
  const [notes, setNotes]         = useState('');
  const [bonNo, setBonNo]         = useState(() => genBon(nextSeq, bonConfig));
  const [bonEditing, setBonEditing] = useState(false);
  const [bonEditValue, setBonEditValue] = useState(''); // numeric only during edit
  const [bonOverride, setBonOverride] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [justSaved, setJustSaved]   = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const amtRef      = useRef(null);
  const customerRef = useRef(null);

  // Update dirtyRef saat customer atau amount berubah
  useEffect(() => {
    if (dirtyRef) dirtyRef.current = customer.trim().length > 0 || amount.length > 0;
  }, [customer, amount, dirtyRef]);

  useEffect(() => {
    if (!bonOverride) setBonNo(genBon(nextSeq, bonConfig));
  }, [nextSeq, bonConfig, bonOverride]);

  const suggests = useMemo(
    () => getAutocomplete(customer, transactions, sales),
    [customer, transactions, sales]
  );

  const currentBonSeq = useMemo(() => {
    const numPart = (bonNo.match(/(\d+)$/) || ['1'])[0];
    return parseInt(numPart, 10) || 1;
  }, [bonNo]);

  const handleBonPrev = () => {
    if (currentBonSeq <= 1) return;
    setBonNo(genBon(currentBonSeq - 1, bonConfig));
    setBonOverride(true);
    setBonEditing(false);
  };

  const handleBonNext = () => {
    setBonNo(genBon(currentBonSeq + 1, bonConfig));
    setBonOverride(true);
    setBonEditing(false);
  };

  const handleDatePrev = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };

  const handleDateNext = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };

  const doSave = async (tx) => {
    await onSave(tx);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (dirtyRef) dirtyRef.current = false;
    setJustSaved(true);
    setCustomer('');
    setAmount('');
    setNotes('');
    setSuggestDismissed(false);
    setBonOverride(false);
    setBonEditing(false);
    setSaving(false);
    setTimeout(() => setJustSaved(false), 1500);
    setTimeout(() => customerRef.current?.focus(), 150);
  };

  const handleSave = async () => {
    const cleanAmt = parseInt(amount.replace(/\D/g,'')) || 0;
    if (!customer.trim() || cleanAmt <= 0 || saving) return;
    setSaving(true);
    const tx = {
      bonNumber: bonNo,
      nextSeq,
      bonManual: bonOverride,
      sales,
      customerName: customer.trim(),
      amount: cleanAmt,
      date,
      notes: notes.trim(),
    };
    // Cek duplikat: tanggal + pelanggan + nominal identik
    const norm = getNorm(customer.trim());
    const duplicate = transactions.find(t =>
      !t.deletedAt && t.date === date &&
      getNorm(t.customerName) === norm && t.amount === cleanAmt
    );
    if (duplicate) {
      setSaving(false);
      Alert.alert(
        '⚠️ Mungkin Double Input',
        `Sudah ada bon ${duplicate.bonNumber} untuk:\n"${duplicate.customerName}" · ${toIdr(duplicate.amount)}\npada ${fmtDate(duplicate.date, dateFormat)}\n\nYakin mau simpan lagi?`,
        [
          { text: 'Cek Dulu', style: 'cancel' },
          { text: 'Simpan Tetap', onPress: () => { setSaving(true); doSave(tx); } },
        ]
      );
      return;
    }
    await doSave(tx);
  };

  const salesColor = COLORS[salesList.indexOf(sales) % COLORS.length];
  const amtNum = parseInt(amount.replace(/\D/g,'')) || 0;
  const canSave = customer.trim().length > 0 && amtNum > 0;

  return (
    <KeyboardAvoidingView style={st.flex1} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={st.container} contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled">

        {/* Bon number */}
        <View style={[st.card, { paddingVertical:14 }]}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:1, textTransform:'uppercase', marginBottom:8, textAlign:'center' }}>
            NO. BON  (tap angka untuk edit)
          </Text>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <TouchableOpacity
              onPress={handleBonPrev}
              disabled={currentBonSeq <= 1}
              style={{ backgroundColor:C.input, borderRadius:10, paddingHorizontal:16, paddingVertical:12, opacity: currentBonSeq <= 1 ? 0.3 : 1 }}>
              <Text style={{ color:C.text, fontSize:22, fontWeight:'700' }}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const numPart = (bonNo.match(/(\d+)$/) || ['1'])[0];
                setBonEditValue(numPart.replace(/^0+/, '') || '1');
                setBonEditing(true);
              }}
              style={{ flex:1, alignItems:'center', paddingHorizontal:8 }}>
              {bonEditing ? (
                <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
                  {(bonConfig.prefix || bonConfig.separator) ? (
                    <Text style={[st.mono, { color:C.muted, fontSize:20, fontWeight:'700' }]}>
                      {bonConfig.prefix}{bonConfig.separator}
                    </Text>
                  ) : null}
                  <TextInput
                    value={bonEditValue}
                    onChangeText={v => {
                      const digits = v.replace(/\D/g, '');
                      setBonEditValue(digits);
                      setBonOverride(true);
                    }}
                    onBlur={() => {
                      if (bonEditValue) {
                        setBonNo(genBon(parseInt(bonEditValue, 10) || 1, bonConfig));
                      }
                      setBonEditing(false);
                    }}
                    autoFocus
                    keyboardType="number-pad"
                    maxLength={10}
                    style={[st.mono, { color:C.accent, fontSize:26, fontWeight:'800',
                      borderBottomWidth:2, borderBottomColor:C.accent,
                      minWidth:120, paddingVertical:4, textAlign:'center' }]}
                  />
                </View>
              ) : (
                <Text style={[st.mono, { color:C.accent, fontSize:28, fontWeight:'800', letterSpacing:1.5 }]}>
                  {bonNo}
                  {bonOverride && <Text style={{ color:C.muted, fontSize:11 }}> *</Text>}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBonNext}
              style={{ backgroundColor:C.input, borderRadius:10, paddingHorizontal:16, paddingVertical:12 }}>
              <Text style={{ color:C.text, fontSize:22, fontWeight:'700' }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date */}
        <View style={{ marginBottom:14 }}>
          <Text style={st.label}>📅 Tanggal</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <TouchableOpacity
              onPress={handleDatePrev}
              style={{ backgroundColor:C.input, borderRadius:10, paddingHorizontal:16, paddingVertical:14 }}>
              <Text style={{ color:C.text, fontSize:22, fontWeight:'700' }}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[st.input, { flex:1, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}>
              <Text style={{ color:C.text, fontSize:16 }}>{fmtDate(date, dateFormat)}</Text>
              <Text style={{ color:C.muted, fontSize:14 }}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDateNext}
              style={{ backgroundColor:C.input, borderRadius:10, paddingHorizontal:16, paddingVertical:14 }}>
              <Text style={{ color:C.text, fontSize:22, fontWeight:'700' }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(date + 'T12:00:00')}
            mode="date"
            display={Platform.OS === 'android' ? 'calendar' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const y = selectedDate.getFullYear();
                const m = String(selectedDate.getMonth()+1).padStart(2,'0');
                const d = String(selectedDate.getDate()).padStart(2,'0');
                setDate(`${y}-${m}-${d}`);
              }
            }}
          />
        )}

        {/* Sales */}
        <View style={{ marginBottom:14 }}>
          <Text style={st.label}>Sales</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {salesList.map((sl, i) => (
              <SalesChip key={sl} name={sl} active={sales===sl}
                color={COLORS[i%COLORS.length]} onPress={() => setSales(sl)} />
            ))}
          </ScrollView>
        </View>

        {/* Customer + autocomplete */}
        <View style={{ marginBottom:14 }}>
          <Text style={st.label}>Nama Pelanggan ({sales})</Text>
          <TextInput
            ref={customerRef}
            value={customer}
            onChangeText={v => { setCustomer(v); setSuggestDismissed(false); }}
            placeholder={`Pelanggan ${sales}...`} placeholderTextColor={C.muted}
            style={[st.input, customer && { borderColor:salesColor }]}
            autoCorrect={false} autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => amtRef.current?.focus()}
          />
          {suggests.length > 0 && !suggestDismissed && (
            <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.primary, borderTopWidth:0, borderBottomLeftRadius:12, borderBottomRightRadius:12, overflow:'hidden' }}>
              {suggests.map(sg => (
                <TouchableOpacity key={sg.name}
                  onPress={() => { setCustomer(sg.name); setSuggestDismissed(true); amtRef.current?.focus(); }}
                  style={{ padding:12, borderBottomWidth:1, borderBottomColor:C.border }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                    <Text style={{ color:C.text, fontSize:14 }}>{sg.name}</Text>
                    <Text style={{ color:C.muted, fontSize:11 }}>{sg.count}x bon</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={{ marginBottom:14 }}>
          <Text style={st.label}>Total Belanja (Rp)</Text>
          <TextInput ref={amtRef}
            value={amount} onChangeText={v => setAmount(v.replace(/\D/g,''))}
            keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}
            style={[st.input, st.mono, { fontSize:24, fontWeight:'800' }, amtNum>0 && { borderColor:C.accent }]}
          />
          {amtNum > 0 && (
            <Text style={[st.mono, { color:C.accent, fontSize:13, marginTop:5 }]}>
              {toIdr(amtNum)}
            </Text>
          )}
        </View>

        {/* Notes */}
        <View style={{ marginBottom:22 }}>
          <Text style={st.label}>Catatan (opsional)</Text>
          <TextInput value={notes} onChangeText={setNotes}
            placeholder="..." placeholderTextColor={C.muted} style={st.input} />
        </View>

        {/* Save */}
        <TouchableOpacity onPress={handleSave} disabled={!canSave || saving}
          style={[btnStyle(justSaved ? C.success : canSave ? salesColor : C.input), !canSave && { opacity:0.4 }]}>
          <Text style={{ color: canSave ? '#fff' : C.muted, fontSize:16, fontWeight:'800' }}>
            {saving ? 'Menyimpan...' : justSaved ? '✓  TERSIMPAN!' : 'SIMPAN BON →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardScreen({ data, onYearChange }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, transactions, activeYear, dateFormat } = data;
  const [busyMonthFilter, setBusyMonthFilter] = useState(0); // 0 = all, 1-12 = bulan

  const activeTxns = useMemo(() =>
    transactions.filter(t => !t.deletedAt), [transactions]);

  const today  = todayStr();
  const { mon, sun } = getWeekBounds(today);

  const todayTxns = activeTxns.filter(t => t.date === today);
  const weekTxns  = activeTxns.filter(t => t.date >= mon && t.date <= sun);
  const yearTxns  = activeTxns.filter(t => t.date.startsWith(String(activeYear)));

  const yearTotal = yearTxns.reduce((a,t) => a+t.amount, 0);
  const yearCount = yearTxns.length;
  const todayTotal = todayTxns.reduce((a,t) => a+t.amount, 0);
  const weekTotal  = weekTxns.reduce((a,t) => a+t.amount, 0);

  const bySales = salesList.map((s,i) => {
    const sTx = yearTxns.filter(t => t.sales===s);
    return { name:s, total:sTx.reduce((a,t)=>a+t.amount,0), count:sTx.length, color:COLORS[i%COLORS.length] };
  });

  const monthly = MONTHS.map((m,i) => {
    const mo = String(i+1).padStart(2,'0');
    const mTx = yearTxns.filter(t => t.date.slice(5,7)===mo);
    const totals = {};
    salesList.forEach(s => {
      totals[s] = mTx.filter(t=>t.sales===s).reduce((a,t)=>a+t.amount,0);
    });
    return { name:m, ...totals, total:mTx.reduce((a,t)=>a+t.amount,0) };
  });

  // Hari tersibuk: hitung omset per hari dalam seminggu, bisa difilter per bulan
  const DAY_LABELS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const busyBaseTxns = busyMonthFilter === 0
    ? yearTxns
    : yearTxns.filter(t => parseInt(t.date.slice(5,7), 10) === busyMonthFilter);
  const busyDays = DAY_LABELS.map((lbl, dow) => {
    const total = busyBaseTxns
      .filter(t => new Date(t.date + 'T12:00:00').getDay() === dow)
      .reduce((a, t) => a + t.amount, 0);
    return { label: lbl, total };
  });
  const busyMax = busyDays.reduce((mx, d) => Math.max(mx, d.total), 0);

  return (
    <ScrollView style={st.container} contentContainerStyle={st.scroll}>
      {/* Year */}
      <View style={[st.card, { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:24 }]}>
        <TouchableOpacity onPress={() => onYearChange(activeYear-1)}
          style={{ backgroundColor:C.input, borderRadius:10, padding:10 }}>
          <Text style={{ color:C.text, fontSize:20 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems:'center' }}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:1 }}>TAHUN</Text>
          <Text style={[st.mono, { color:C.accent, fontSize:34, fontWeight:'800' }]}>
            {activeYear}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onYearChange(activeYear+1)}
          style={{ backgroundColor:C.input, borderRadius:10, padding:10 }}>
          <Text style={{ color:C.text, fontSize:20 }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Today + Week */}
      <View style={[st.card, { borderLeftWidth:3, borderLeftColor:C.accent }]}>
        {/* Header row: label + share button */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase' }}>
            HARI INI · {fmtDate(today, dateFormat)}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              const lines = [
                `📊 *Rekap Omset Hari Ini*`,
                `🏪 ${data.companyName || 'Toko'}  |  ${fmtDate(today, dateFormat)}`,
                ``,
                `💰 Total: *${toIdr(todayTotal)}*`,
                `🧾 Jumlah Bon: ${todayTxns.length}`,
                ``,
              ];
              if (todayTxns.length > 0) {
                salesList.forEach(s => {
                  const sTx = todayTxns.filter(t => t.sales === s);
                  if (sTx.length > 0) lines.push(`• ${s}: ${toIdr(sTx.reduce((a,t)=>a+t.amount,0))} (${sTx.length} bon)`);
                });
                lines.push('');
              }
              lines.push(`_via OmsetKu_`);
              try { await Share.share({ message: lines.join('\n') }); } catch(e) {}
            }}
            style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}>
            <Text style={{ color:C.muted, fontSize:12 }}>📤 Share</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
          <View>
            <Text style={[st.mono, { color:C.text, fontSize:20, fontWeight:'800' }]}>
              {toIdr(todayTotal)}
            </Text>
            <Text style={{ color:C.muted, fontSize:12 }}>{todayTxns.length} bon</Text>
          </View>
          <View style={{ alignItems:'flex-end' }}>
            <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase' }}>MINGGU INI</Text>
            <Text style={[st.mono, { color:C.text, fontSize:18, fontWeight:'800' }]}>
              {toShort(weekTotal)}
            </Text>
            <Text style={{ color:C.muted, fontSize:12 }}>{weekTxns.length} bon</Text>
          </View>
        </View>
        {salesList.map(sl => {
          const sT = todayTxns.filter(t=>t.sales===sl);
          return sT.length ? (
            <Text key={sl} style={{ color:C.muted, fontSize:12, marginTop:2 }}>
              {sl}: {toIdr(sT.reduce((a,t)=>a+t.amount,0))} ({sT.length})
            </Text>
          ) : null;
        })}
      </View>

      {/* KPIs */}
      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        <KpiCard label="Total Omset" value={toIdr(yearTotal)} sub={yearCount+' bon'} color={C.accent} />
        <KpiCard label="Rata-rata"   value={toIdr(yearCount>0?Math.round(yearTotal/yearCount):0)} sub="per bon" />
      </View>

      {/* Per-sales breakdown */}
      <View style={st.card}>
        <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
          OMSET PER SALES {activeYear}
        </Text>
        {bySales.map(bs => (
          <View key={bs.name} style={{ marginBottom:10 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:13 }}>{bs.name}</Text>
              <Text style={[st.mono, { color:bs.color, fontWeight:'700', fontSize:13 }]}>
                {toIdr(bs.total)}
              </Text>
            </View>
            <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
              <View style={{ flex:1, backgroundColor:C.input, borderRadius:4, height:6, overflow:'hidden' }}>
                <View style={{ backgroundColor:bs.color, height:6, borderRadius:4, width: yearTotal>0 ? `${Math.round(bs.total/yearTotal*100)}%` : '0%' }} />
              </View>
              <Text style={{ color:C.muted, fontSize:11, minWidth:30, textAlign:'right' }}>
                {yearTotal>0 ? Math.round(bs.total/yearTotal*100) : 0}%
              </Text>
            </View>
            <Text style={{ color:C.muted, fontSize:11 }}>{bs.count} bon</Text>
          </View>
        ))}
      </View>

      {/* Monthly bar chart — stacked per sales */}
      {yearTotal > 0 && (
        <View style={st.card}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
            GRAFIK BULANAN {activeYear}
          </Text>
          {/* Legend */}
          {salesList.length > 1 && (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              {salesList.map((s, i) => (
                <View key={s} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor:COLORS[i%COLORS.length] }} />
                  <Text style={{ color:C.muted, fontSize:10 }}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ flexDirection:'row', alignItems:'flex-end', height:80, gap:2 }}>
            {monthly.map((m, i) => {
              const maxH = monthly.reduce((mx, x) => Math.max(mx, x.total), 0);
              return (
                <View key={i} style={{ flex:1, alignItems:'center', justifyContent:'flex-end', height:80 }}>
                  {/* Bar kiri-kanan per sales */}
                  <View style={{ flexDirection:'row', alignItems:'flex-end', width:'100%', gap:1 }}>
                    {salesList.length > 0 ? salesList.map((s, si) => {
                      const sTotal = m[s] || 0;
                      const barH   = maxH > 0 ? Math.max((sTotal / maxH) * 72, sTotal > 0 ? 3 : 0) : 0;
                      return (
                        <View key={s} style={{ flex:1, height:barH, backgroundColor:COLORS[si%COLORS.length], borderRadius:2 }} />
                      );
                    }) : (
                      <View style={{ flex:1, height:maxH>0?Math.max((m.total/maxH)*72,m.total>0?3:0):0,
                        backgroundColor:C.primary, borderRadius:2 }} />
                    )}
                  </View>
                  <Text style={{ color:C.muted, fontSize:7, marginTop:3 }}>{m.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Distribusi Omset (Pie style) */}
      {yearTotal > 0 && salesList.length > 1 && (
        <View style={st.card}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
            DISTRIBUSI OMSET {activeYear}
          </Text>
          {/* Proportion bar */}
          <View style={{ height:18, borderRadius:9, overflow:'hidden', flexDirection:'row', marginBottom:14 }}>
            {bySales.filter(bs => bs.total > 0).map(bs => (
              <View key={bs.name} style={{ flex:bs.total, backgroundColor:bs.color }} />
            ))}
          </View>
          {bySales.map(bs => (
            <View key={bs.name} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
              <View style={{ width:10, height:10, borderRadius:5, backgroundColor:bs.color, marginRight:8 }} />
              <Text style={{ color:C.text, fontSize:13, flex:1, fontWeight:'600' }}>{bs.name}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginRight:10 }}>
                {yearTotal > 0 ? Math.round(bs.total / yearTotal * 100) : 0}%
              </Text>
              <Text style={[st.mono, { color:bs.color, fontSize:13, fontWeight:'800' }]}>
                {toShort(bs.total)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Hari Tersibuk */}
      {yearTotal > 0 && (
        <View style={st.card}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:8 }}>
            HARI TERSIBUK — {busyMonthFilter === 0 ? `ALL ${activeYear}` : `${MONTHS_F[busyMonthFilter-1]} ${activeYear}`}
          </Text>
          {/* Filter bulan: All + Jan–Des */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
            {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
              const active = busyMonthFilter === m;
              return (
                <TouchableOpacity key={m} onPress={() => setBusyMonthFilter(m)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:8, marginRight:6,
                    backgroundColor: active ? C.accent : C.input }}>
                  <Text style={{ color: active ? '#fff' : C.muted, fontSize:11, fontWeight:'700' }}>
                    {m === 0 ? 'All' : MONTHS[m-1]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {busyBaseTxns.length === 0 ? (
            <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>Belum ada data</Text>
          ) : busyDays.map((d, i) => {
            const pct = busyMax > 0 ? d.total / busyMax : 0;
            const isBusiest = d.total === busyMax && busyMax > 0;
            return (
              <View key={d.label} style={{ flexDirection:'row', alignItems:'center', marginBottom:8, gap:8 }}>
                <Text style={{ color: isBusiest ? C.accent : C.muted, fontSize:12, fontWeight: isBusiest ? '800' : '600', width:28 }}>
                  {d.label}
                </Text>
                <View style={{ flex:1, backgroundColor:C.input, borderRadius:4, height:10, overflow:'hidden' }}>
                  <View style={{ width:`${pct*100}%`, height:'100%', backgroundColor: isBusiest ? C.accent : C.primary, borderRadius:4 }} />
                </View>
                <Text style={[st.mono, { color: isBusiest ? C.accent : C.muted, fontSize:11, width:52, textAlign:'right' }]}>
                  {d.total > 0 ? toShort(d.total) : '-'}
                </Text>
                {isBusiest && <Text style={{ fontSize:10 }}>🔥</Text>}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function HistoryScreen({ data, onDelete, onEdit, onRestore }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, transactions, dateFormat } = data;
  const [search, setSearch]   = useState('');
  const [salesF, setSalesF]   = useState('ALL');
  const [editTx, setEditTx]   = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLogTx, setEditLogTx] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const HIST_PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions]
      .sort((a,b) => b.id - a.id)
      .filter(t => salesF==='ALL' || t.sales===salesF)
      .filter(t =>
        !q ||
        t.customerName.toLowerCase().includes(q) ||
        (t.bonNumber||'').toLowerCase().includes(q)
      );
  }, [transactions, salesF, search]);

  // Reset page saat filter/search berubah
  useEffect(() => { setHistPage(1); }, [search, salesF]);

  const displayedHistory = useMemo(
    () => filtered.slice(0, histPage * HIST_PAGE_SIZE),
    [filtered, histPage]
  );

  const openEdit = (tx) => {
    // Pisahkan bagian numerik dari bon number untuk editing
    const numPart = (tx.bonNumber.match(/(\d+)$/) || ['1'])[0];
    setEditForm({
      bonNumOnly:   numPart.replace(/^0+/, '') || '1',
      sales:        tx.sales,
      customerName: tx.customerName,
      amount:       String(tx.amount),
      date:         tx.date,
      notes:        tx.notes,
    });
    setEditTx(tx);
  };

  const saveEdit = async () => {
    const amt    = parseInt((editForm.amount||'').replace(/\D/g,''))||0;
    const bonSeq = parseInt(editForm.bonNumOnly, 10) || 1;
    const bonNumber = genBon(bonSeq, data.bonConfig);
    if (!editForm.customerName.trim() || amt<=0) {
      Alert.alert('','Nama dan nominal harus diisi'); return;
    }
    await onEdit(editTx.id, { ...editForm, bonNumber, amount: amt });
    setEditTx(null);
  };

  const confirmDelete = (tx) => {
    Alert.alert(
      'Hapus Transaksi',
      `Bon ${tx.bonNumber} · ${tx.customerName} · ${toIdr(tx.amount)}`,
      [
        { text:'Batal', style:'cancel' },
        { text:'Hapus', style:'destructive', onPress: () => onDelete(tx.id) },
      ]
    );
  };

  const renderItem = ({ item: tx }) => {
    const isDeleted  = !!tx.deletedAt;
    const salesColor = COLORS[salesList.indexOf(tx.sales) % COLORS.length] || C.primary;
    return (
      <View style={[st.card, { borderLeftWidth:4, borderLeftColor: isDeleted ? C.muted : salesColor, opacity: isDeleted ? 0.6 : 1 }]}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
          <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
            <Text style={[st.mono, { color:C.muted, fontSize:11 }]}>#{tx.bonNumber||'?'}</Text>
            <View style={{ backgroundColor:salesColor+'22', paddingHorizontal:8, paddingVertical:2, borderRadius:6 }}>
              <Text style={{ color:salesColor, fontSize:10, fontWeight:'700' }}>{tx.sales}</Text>
            </View>
            {isDeleted && <Text style={{ color:C.muted, fontSize:10, fontStyle:'italic' }}>dihapus</Text>}
            {!isDeleted && tx.editedAt && (
              <TouchableOpacity onPress={() => setEditLogTx(tx)}>
                <Text style={{ color:C.warning, fontSize:10, fontWeight:'700' }}>✎ edited</Text>
              </TouchableOpacity>
            )}
          </View>
          {isDeleted ? (
            <TouchableOpacity onPress={() => onRestore(tx.id)}
              style={{ backgroundColor:C.success+'22', borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
              <Text style={{ color:C.success, fontSize:11, fontWeight:'700' }}>↩ Pulihkan</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection:'row', gap:8 }}>
              <TouchableOpacity onPress={() => openEdit(tx)}
                style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:8, paddingVertical:4 }}>
                <Text style={{ color:C.muted, fontSize:13 }}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(tx)}
                style={{ backgroundColor:'transparent', paddingHorizontal:4, paddingVertical:4 }}>
                <Text style={{ color:'#334155', fontSize:16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={{ color:C.text, fontSize:15, fontWeight:'700' }}>{tx.customerName}</Text>
        {tx.notes ? <Text style={{ color:C.muted, fontSize:12 }}>{tx.notes}</Text> : null}
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
          <Text style={{ color:C.muted, fontSize:12 }}>{fmtDate(tx.date, dateFormat)}</Text>
          <Text style={[st.mono, { color:C.accent, fontSize:16, fontWeight:'800' }]}>
            {toIdr(tx.amount)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={st.flex1}>
      {/* Search + filter */}
      <View style={{ padding:14, paddingBottom:0 }}>
        <TextInput value={search} onChangeText={setSearch}
          placeholder="🔍  Cari nama / no. bon..." placeholderTextColor={C.muted}
          style={[st.input, { marginBottom:10, fontSize:14 }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
          {['ALL', ...salesList].map((sl, i) => (
            <TouchableOpacity key={sl} onPress={() => setSalesF(sl)}
              style={chipStyle(salesF===sl, i===0?C.accent:COLORS[(i-1)%COLORS.length])}>
              <Text style={{ color:salesF===sl?'#fff':C.muted, fontSize:12, fontWeight:'700' }}>
                {sl}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color:C.muted, fontSize:12, alignSelf:'center', marginLeft:8 }}>
            {filtered.length} bon
          </Text>
        </ScrollView>
      </View>

      <FlatList data={displayedHistory} renderItem={renderItem} keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding:14, paddingBottom:110 }}
        onEndReached={() => { if (histPage * HIST_PAGE_SIZE < filtered.length) setHistPage(p => p+1); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          histPage * HIST_PAGE_SIZE < filtered.length ? (
            <View style={{ alignItems:'center', paddingVertical:16 }}>
              <ActivityIndicator color={C.primary} />
              <Text style={{ color:C.muted, fontSize:11, marginTop:6 }}>
                {displayedHistory.length}/{filtered.length} bon
              </Text>
            </View>
          ) : filtered.length > HIST_PAGE_SIZE ? (
            <Text style={{ color:C.muted, fontSize:11, textAlign:'center', paddingVertical:12 }}>
              Semua {filtered.length} bon ditampilkan
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems:'center', paddingVertical:60 }}>
            <Text style={{ fontSize:40, marginBottom:12 }}>📋</Text>
            <Text style={{ color:C.muted, fontSize:14 }}>Tidak ada data</Text>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal visible={!!editTx} animationType="slide" transparent>
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}>
            <ScrollView style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, maxHeight:'85%' }}>
              <Text style={{ color:C.text, fontSize:18, fontWeight:'800', marginBottom:16 }}>
                ✎  Edit Transaksi
              </Text>
              {/* Nomor Bon — prefix static + angka saja */}
              <View style={{ marginBottom:14 }}>
                <Text style={st.label}>Nomor Bon</Text>
                <View style={[st.input, { flexDirection:'row', alignItems:'center', gap:2 }]}>
                  {(data.bonConfig?.prefix || data.bonConfig?.separator) ? (
                    <Text style={[st.mono, { color:C.muted, fontSize:16, fontWeight:'700' }]}>
                      {data.bonConfig.prefix}{data.bonConfig.separator}
                    </Text>
                  ) : null}
                  <TextInput
                    value={editForm.bonNumOnly||''}
                    onChangeText={v => setEditForm(f=>({...f, bonNumOnly:v.replace(/\D/g,'')}))}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholderTextColor={C.muted}
                    style={[st.mono, { color:C.accent, fontSize:18, fontWeight:'800', flex:1, padding:0 }]}
                  />
                </View>
              </View>
              {[
                ['Nama Pelanggan','customerName','words'],
                ['Nominal (Rp)','amount','number-pad'],
                ['Catatan','notes','default'],
              ].map(([lbl,key,kb]) => (
                <View key={key} style={{ marginBottom:14 }}>
                  <Text style={st.label}>{lbl}</Text>
                  <TextInput
                    value={editForm[key]||''}
                    onChangeText={v => setEditForm(f=>({...f,[key]:v}))}
                    keyboardType={kb} placeholderTextColor={C.muted} style={st.input}
                  />
                </View>
              ))}
              {/* Tanggal — DateTimePicker */}
              <View style={{ marginBottom:14 }}>
                <Text style={st.label}>📅 Tanggal</Text>
                <TouchableOpacity
                  onPress={() => setShowEditDatePicker(true)}
                  style={[st.input, { flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}>
                  <Text style={{ color:C.text, fontSize:16 }}>{fmtDate(editForm.date||'', dateFormat)}</Text>
                  <Text style={{ color:C.muted, fontSize:14 }}>📅</Text>
                </TouchableOpacity>
                {showEditDatePicker && (
                  <DateTimePicker
                    value={new Date((editForm.date||todayStr()) + 'T12:00:00')}
                    mode="date"
                    display={Platform.OS==='android' ? 'calendar' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowEditDatePicker(false);
                      if (selectedDate) {
                        const y = selectedDate.getFullYear();
                        const m = String(selectedDate.getMonth()+1).padStart(2,'0');
                        const d = String(selectedDate.getDate()).padStart(2,'0');
                        setEditForm(f => ({...f, date:`${y}-${m}-${d}`}));
                      }
                    }}
                  />
                )}
              </View>
              {/* Sales selector */}
              <View style={{ marginBottom:16 }}>
                <Text style={st.label}>Sales</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {salesList.map((sl,i) => (
                    <SalesChip key={sl} name={sl} active={editForm.sales===sl}
                      color={COLORS[i%COLORS.length]}
                      onPress={() => setEditForm(f=>({...f,sales:sl}))} />
                  ))}
                </ScrollView>
              </View>
              <View style={{ flexDirection:'row', gap:10, marginBottom:30 }}>
                <TouchableOpacity onPress={() => setEditTx(null)}
                  style={[btnStyle(C.input), {flex:1}]}>
                  <Text style={{ color:C.muted, fontSize:15, fontWeight:'700' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit}
                  style={[btnStyle(C.primary), {flex:2}]}>
                  <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* Edit Log Modal */}
      {editLogTx && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setEditLogTx(null)}>
          <TouchableOpacity style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}
            onPress={() => setEditLogTx(null)} activeOpacity={1}>
            <View style={{ backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:36 }}>
              <Text style={{ color:C.text, fontSize:16, fontWeight:'800', marginBottom:16 }}>
                📋 Log Perubahan
              </Text>
              <Text style={{ color:C.muted, fontSize:11, marginBottom:8 }}>
                Terakhir diedit: {editLogTx.editedAt ? new Date(editLogTx.editedAt).toLocaleString('id-ID') : '-'}
              </Text>
              {editLogTx.originalValues ? <>
                <Text style={{ color:C.warning, fontSize:12, fontWeight:'700', marginBottom:6 }}>SEBELUM DIEDIT:</Text>
                {[
                  ['No. Bon', editLogTx.originalValues.bonNumber],
                  ['Sales',   editLogTx.originalValues.sales],
                  ['Pelanggan', editLogTx.originalValues.customerName],
                  ['Nominal', toIdr(editLogTx.originalValues.amount)],
                  ['Tanggal', editLogTx.originalValues.date],
                  ['Catatan', editLogTx.originalValues.notes || '-'],
                ].map(([label, val]) => (
                  <View key={label} style={{ flexDirection:'row', marginBottom:4 }}>
                    <Text style={{ color:C.muted, fontSize:12, width:80 }}>{label}:</Text>
                    <Text style={{ color:C.text, fontSize:12, flex:1 }}>{val}</Text>
                  </View>
                ))}
                <View style={{ height:1, backgroundColor:C.border, marginVertical:10 }} />
                <Text style={{ color:C.success, fontSize:12, fontWeight:'700', marginBottom:6 }}>SESUDAH DIEDIT:</Text>
                {[
                  ['No. Bon', editLogTx.bonNumber],
                  ['Sales',   editLogTx.sales],
                  ['Pelanggan', editLogTx.customerName],
                  ['Nominal', toIdr(editLogTx.amount)],
                  ['Tanggal', editLogTx.date],
                  ['Catatan', editLogTx.notes || '-'],
                ].map(([label, val]) => (
                  <View key={label} style={{ flexDirection:'row', marginBottom:4 }}>
                    <Text style={{ color:C.muted, fontSize:12, width:80 }}>{label}:</Text>
                    <Text style={{ color:C.text, fontSize:12, flex:1 }}>{val}</Text>
                  </View>
                ))}
              </> : (
                <Text style={{ color:C.muted, fontSize:13 }}>Tidak ada data original (edited sebelum fitur log aktif)</Text>
              )}
              <TouchableOpacity onPress={() => setEditLogTx(null)}
                style={{ marginTop:16, backgroundColor:C.input, borderRadius:12, padding:12, alignItems:'center' }}>
                <Text style={{ color:C.text, fontWeight:'700' }}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ─── RANKING ──────────────────────────────────────────────────────────────────
function RankingScreen({ data }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, transactions, dateFormat } = data;
  const [activeSales, setActiveSales] = useState(salesList[0]||'');
  const [period, setPeriod]           = useState('year');
  const [rankYear, setRankYear]       = useState(new Date().getFullYear());
  const [rankMonth, setRankMonth]     = useState(new Date().getMonth()+1);
  const [rankDate, setRankDate]       = useState(todayStr()); // untuk navigasi hari & minggu

  const activeTxns = useMemo(() =>
    transactions.filter(t => !t.deletedAt), [transactions]);

  const ranked = useMemo(() => {
    let filtered;
    if (period === 'today') {
      filtered = activeTxns.filter(t => t.date === rankDate);
    } else if (period === 'week') {
      const { mon, sun } = getWeekBounds(rankDate);
      filtered = activeTxns.filter(t => t.date >= mon && t.date <= sun);
    } else {
      filtered = filterByPeriod(activeTxns, period, rankYear, rankMonth);
    }
    return getRanking(filtered, activeSales);
  }, [activeTxns, activeSales, period, rankYear, rankMonth, rankDate]);

  const shiftDate = (days) => {
    const d = new Date(rankDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setRankDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };

  const salesColor = COLORS[salesList.indexOf(activeSales) % COLORS.length] || C.primary;
  const medals = ['🥇','🥈','🥉'];

  const periodLabel = () => {
    if (period==='today') return fmtDate(rankDate, dateFormat);
    if (period==='week') {
      const { mon, sun } = getWeekBounds(rankDate);
      return `${fmtDate(mon,dateFormat)} – ${fmtDate(sun,dateFormat)}`;
    }
    if (period==='month') return `${MONTHS_F[rankMonth-1]} ${rankYear}`;
    return `Tahun ${rankYear}`;
  };

  return (
    <ScrollView style={st.container} contentContainerStyle={st.scroll}>
      {/* Header card */}
      <View style={st.card}>
        <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:10 }}>
          RANKING PELANGGAN
        </Text>

        {/* Period selector */}
        <View style={{ flexDirection:'row', gap:6, marginBottom:10 }}>
          {[['today','Hari'],['week','Minggu'],['month','Bulan'],['year','Tahun']].map(([id,lbl]) => (
            <TouchableOpacity key={id} onPress={() => setPeriod(id)}
              style={{ flex:1, backgroundColor:period===id?C.accent:C.input, borderRadius:10, paddingVertical:8, alignItems:'center' }}>
              <Text style={{ color:period===id?'#fff':C.muted, fontSize:12, fontWeight:'700' }}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigasi periode — semua 4 mode punya ‹ › */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.input, borderRadius:10, padding:8, marginBottom:10 }}>
          <TouchableOpacity onPress={() => {
            if (period==='today')  shiftDate(-1);
            else if (period==='week')  shiftDate(-7);
            else if (period==='month') {
              if (rankMonth===1) { setRankMonth(12); setRankYear(y=>y-1); }
              else setRankMonth(m=>m-1);
            } else setRankYear(y=>y-1);
          }} style={{ width:32, height:32, backgroundColor:C.card, borderRadius:8, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color:C.text, fontSize:18 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'800', fontSize:13, flex:1, textAlign:'center' }}>{periodLabel()}</Text>
          <TouchableOpacity onPress={() => {
            if (period==='today')  shiftDate(1);
            else if (period==='week')  shiftDate(7);
            else if (period==='month') {
              if (rankMonth===12) { setRankMonth(1); setRankYear(y=>y+1); }
              else setRankMonth(m=>m+1);
            } else setRankYear(y=>y+1);
          }} style={{ width:32, height:32, backgroundColor:C.card, borderRadius:8, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color:C.text, fontSize:18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Sales tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {salesList.map((sl,i) => (
            <SalesChip key={sl} name={sl} active={activeSales===sl}
              color={COLORS[i%COLORS.length]} onPress={() => setActiveSales(sl)} />
          ))}
        </ScrollView>
        <Text style={{ color:C.muted, fontSize:10, marginTop:8 }}>
          Pelanggan dipisah per sales
        </Text>
      </View>

      {ranked.length === 0 ? (
        <View style={{ alignItems:'center', paddingVertical:48 }}>
          <Text style={{ fontSize:40, marginBottom:12 }}>🏆</Text>
          <Text style={{ color:C.muted, fontSize:14 }}>Belum ada data untuk periode ini</Text>
        </View>
      ) : (
        <>
          {/* Podium top 3 */}
          {ranked.length >= 3 && (
            <View style={{ flexDirection:'row', alignItems:'flex-end', gap:8, marginBottom:16 }}>
              {[1,0,2].map(idx => {
                const p = ranked[idx];
                const h = [95,75,58][idx];
                return (
                  <View key={idx} style={{ flex:1, alignItems:'center' }}>
                    <Text style={{ color:C.text, fontSize:11, fontWeight:'700', marginBottom:3 }} numberOfLines={1}>
                      {medals[idx]} {p.name}
                    </Text>
                    <Text style={[st.mono, { color:C.accent, fontSize:11, fontWeight:'700', marginBottom:5 }]}>
                      {toShort(p.total)}
                    </Text>
                    <View style={{ backgroundColor:salesColor, borderRadius:8, height:h, width:'100%', alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ fontSize:22 }}>{medals[idx]}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Full list */}
          {ranked.map((r, i) => (
            <View key={r.name+i} style={[st.card, { flexDirection:'row', gap:12, alignItems:'center', borderWidth:1, borderColor:i<3?salesColor+'44':C.border }]}>
              <View style={{ width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center',
                backgroundColor: i===0?C.accent : i===1?'#475569' : i===2?'#92400e' : C.input }}>
                <Text style={{ color:'#fff', fontSize:13, fontWeight:'800' }}>{i+1}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={{ color:C.muted, fontSize:11 }}>
                  {r.count} bon · terakhir {fmtDate(r.last, dateFormat)}
                </Text>
              </View>
              <Text style={[st.mono, { color:C.accent, fontSize:14, fontWeight:'800' }]}>
                {toIdr(r.total)}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────
function SettingsModal({ data, onUpdate, onImport, onClose }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, bonConfig, dateFormat, companyName } = data;
  const [themeMode, setThemeMode]   = useState(data.themeMode||'dark');
  const [pinLockEnabled, setPinLockEnabled] = useState(data.pinLockEnabled||false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting]         = useState(false);
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [excelChecked, setExcelChecked]   = useState({ transaksi:true, per_sales:true, bulanan:true, pelanggan:false, ranking:false });
  const [exporting, setExporting]         = useState(false);
  const [company, setCompany]   = useState(companyName||'');
  const [prefix,  setPrefix]    = useState(bonConfig?.prefix||'INV');
  const [sep,     setSep]       = useState(bonConfig?.separator||'-');
  const [digits,  setDigits]    = useState(String(bonConfig?.digitLength||5));
  const [fmt,     setFmt]       = useState(dateFormat||'dd/mm/yyyy');
  const [newSales, setNewSales] = useState('');

  const save = async () => {
    await onUpdate({
      companyName:   company.trim(),
      bonPrefix:     prefix.toUpperCase(),
      bonSeparator:  sep,
      bonDigits:     Math.max(1, parseInt(digits)||5),
      dateFormat:    fmt,
    });
    onClose();
  };

  const handleAddSales = async () => {
    const nm = newSales.trim().toUpperCase();
    if (!nm || salesList.includes(nm)) {
      Alert.alert('','Nama sudah ada atau kosong'); return;
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
    Alert.alert('Reset Semua Data',
      'Semua transaksi akan dihapus permanen. Settings tidak dihapus.',
      [
        { text:'Batal', style:'cancel' },
        { text:'Hapus Semua', style:'destructive', onPress: () => onUpdate({ resetData: true }) },
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

  const handleExportExcel = async () => {
    if (!Object.values(excelChecked).some(Boolean)) {
      Alert.alert('', 'Pilih minimal 1 sheet untuk diexport'); return;
    }
    try {
      setExporting(true);
      const wb       = XLSX.utils.book_new();
      const activeTxns = (data.transactions||[]).filter(t => !t.deletedAt);
      const dfmt     = data.dateFormat || 'dd/mm/yyyy';

      if (excelChecked.transaksi) {
        // Sheet terpisah per sales (max 31 karakter nama sheet Excel)
        (data.salesList||[]).forEach(s => {
          const rows = [...activeTxns]
            .filter(t => t.sales === s)
            .sort((a,b) => a.date.localeCompare(b.date))
            .map(t => ({
              'No. Bon':        t.bonNumber,
              'Tanggal':        fmtDate(t.date, dfmt),
              'Nama Pelanggan': t.customerName,
              'Total (Rp)':     t.amount,
              'Catatan':        t.notes || '',
            }));
          const sheetName = `Txn-${s}`.slice(0, 31);
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{'Info':'Belum ada data'}]), sheetName);
        });
      }

      if (excelChecked.per_sales) {
        const rows = (data.salesList||[]).map(s => {
          const sTx = activeTxns.filter(t => t.sales === s);
          return { 'Sales': s, 'Jumlah Bon': sTx.length, 'Total Omset (Rp)': sTx.reduce((a,t)=>a+t.amount,0) };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Per Sales');
      }

      if (excelChecked.bulanan) {
        const yr   = data.activeYear || new Date().getFullYear();
        const rows = MONTHS_F.map((month, i) => {
          const mo  = String(i+1).padStart(2,'0');
          const mTx = activeTxns.filter(t => t.date.slice(0,7) === `${yr}-${mo}`);
          const row = { 'Bulan': month, 'Total (Rp)': mTx.reduce((a,t)=>a+t.amount,0) };
          (data.salesList||[]).forEach(s => { row[s] = mTx.filter(t=>t.sales===s).reduce((a,t)=>a+t.amount,0); });
          return row;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Bulanan ${yr}`);
      }

      if (excelChecked.pelanggan) {
        const custMap = {};
        activeTxns.forEach(t => {
          const key = `${t.sales}|||${getNorm(t.customerName)}`;
          if (!custMap[key]) custMap[key] = { name:t.customerName, sales:t.sales, count:0, total:0, last:'' };
          custMap[key].count++;
          custMap[key].total += t.amount;
          if (t.date > custMap[key].last) custMap[key].last = t.date;
        });
        const rows = Object.values(custMap)
          .sort((a,b) => a.name.localeCompare(b.name,'id'))
          .map((c, i) => ({
            'No': i+1, 'Nama Pelanggan': c.name, 'Sales': c.sales,
            'Jumlah Bon': c.count, 'Total Belanja (Rp)': c.total,
            'Terakhir': fmtDate(c.last, dfmt),
          }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pelanggan');
      }

      if (excelChecked.ranking) {
        const rows = [];
        (data.salesList||[]).forEach(s => {
          getRanking(activeTxns, s).forEach((r, i) => {
            rows.push({ 'Rank':i+1, 'Sales':s, 'Nama':r.name, 'Jumlah Bon':r.count, 'Total (Rp)':r.total, 'Terakhir':fmtDate(r.last,dfmt) });
          });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Ranking');
      }

      const base64   = XLSX.write(wb, { type:'base64', bookType:'xlsx' });
      const filename = `omsetku-${todayStr()}.xlsx`;
      const uri      = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
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
          {/* Company */}
          <View style={st.card}>
            <Text style={st.label}>Nama Bisnis</Text>
            <TextInput value={company} onChangeText={setCompany}
              placeholder="Nama bisnis..." placeholderTextColor={C.muted} style={st.input} />
          </View>

          {/* Sales management */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              TIM SALES
            </Text>
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
            <Text style={[st.mono, { color:C.accent, fontSize:16, fontWeight:'800' }]}>
              {prefix}{sep}{padNum(1, parseInt(digits)||5)}
            </Text>
          </View>

          {/* Date format */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:10 }}>
              FORMAT TANGGAL
            </Text>
            {['dd/mm/yyyy','mm/dd/yyyy','yyyy/mm/dd'].map(f => (
              <TouchableOpacity key={f} onPress={() => setFmt(f)}
                style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ color:C.text, fontSize:14 }}>{f.toUpperCase()}</Text>
                {fmt===f && <Text style={{ color:C.success }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Data actions */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              DATA
            </Text>
            <TouchableOpacity onPress={handlePickCsv}
              style={{ backgroundColor:C.primary+'18', borderWidth:1.5, borderColor:C.primary, borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10 }}>
              <Text style={{ color:C.primary, fontSize:14, fontWeight:'800' }}>📥  Import dari CSV (Google Sheets)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowExcelMenu(true)}
              style={{ backgroundColor:C.success+'18', borderWidth:1.5, borderColor:C.success, borderRadius:16, paddingVertical:16, alignItems:'center', marginBottom:10 }}>
              <Text style={{ color:C.success, fontSize:14, fontWeight:'800' }}>📊  Export ke Excel (.xlsx)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={[btnStyle(C.input), {marginBottom:10}]}>
              <Text style={{ color:C.text, fontSize:14, fontWeight:'700' }}>📤  Export Backup (JSON)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} style={btnStyle(C.danger+'33')}>
              <Text style={{ color:C.danger, fontSize:14, fontWeight:'700' }}>🗑  Reset Semua Data</Text>
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
                  Fingerprint / PIN HP saat buka app
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const newVal = !pinLockEnabled;
                  setPinLockEnabled(newVal);
                  onUpdate({ pinLockEnabled: newVal });
                }}
                style={{ width:50, height:28, borderRadius:14,
                  backgroundColor: pinLockEnabled ? C.success : C.input,
                  justifyContent:'center', paddingHorizontal:3 }}>
                <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
                  alignSelf: pinLockEnabled ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Theme */}
          <View style={st.card}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:10 }}>
              TAMPILAN
            </Text>
            {[['dark','🌙  Mode Gelap'],['light','☀️  Mode Terang'],['system','📱  Ikuti HP']].map(([val,lbl]) => (
              <TouchableOpacity key={val} onPress={() => { setThemeMode(val); onUpdate({ themeMode: val }); }}
                style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ color:C.text, fontSize:14 }}>{lbl}</Text>
                {themeMode===val && <Text style={{ color:C.success }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Save */}
          <TouchableOpacity onPress={save} style={[btnStyle(C.success), {marginTop:4}]}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>✓  Simpan Pengaturan</Text>
          </TouchableOpacity>

          <Text style={{ color:C.muted, fontSize:11, textAlign:'center', marginTop:16 }}>
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
              <Text style={{ color:C.text, fontSize:18, fontWeight:'800', marginBottom:6 }}>📊 Export ke Excel</Text>
              <Text style={{ color:C.muted, fontSize:12, marginBottom:16 }}>Pilih sheet yang ingin diexport dalam 1 file .xlsx</Text>
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
    </Modal>
  );
}


// ─── CUSTOMER LIST + DETAIL ───────────────────────────────────────────────────
function getCustomerList(transactions, salesFilter) {
  const map = {};
  transactions
    .filter(t => !t.deletedAt && (salesFilter === 'ALL' || t.sales === salesFilter))
    .forEach(t => {
      const key = `${t.sales}|||${getNorm(t.customerName)}`;
      if (!map[key]) map[key] = {
        name: t.customerName,
        sales: t.sales,
        total: 0, count: 0,
        lastDate: '', firstDate: '9999-99-99',
      };
      map[key].total += t.amount;
      map[key].count += 1;
      if (t.date > map[key].lastDate)  map[key].lastDate  = t.date;
      if (t.date < map[key].firstDate) map[key].firstDate = t.date;
    });
  return Object.values(map).sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
  );
}

function CustomersScreen({ data }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { salesList, transactions, dateFormat } = data;
  const [salesF, setSalesF]       = useState('ALL');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('nama'); // 'nama' | 'total' | 'terbaru'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const allCustomers = useMemo(() => {
    const list = getCustomerList(transactions, salesF);
    if (sortBy === 'total')   return [...list].sort((a,b) => b.total - a.total);
    if (sortBy === 'terbaru') return [...list].sort((a,b) => b.lastDate.localeCompare(a.lastDate));
    return list; // nama A-Z (default)
  }, [transactions, salesF, sortBy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCustomers;
    const q = search.trim().toLowerCase();
    return allCustomers.filter(c => c.name.toLowerCase().includes(q));
  }, [allCustomers, search]);

  // Group A-Z hanya saat sort by nama
  const grouped = useMemo(() => {
    if (sortBy !== 'nama') return null; // flat list untuk sort lain
    const sections = {};
    filtered.forEach(c => {
      const letter = (c.name[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!sections[key]) sections[key] = [];
      sections[key].push(c);
    });
    return Object.entries(sections).sort(([a],[b]) => a.localeCompare(b));
  }, [filtered, sortBy]);

  const renderCustomerItem = ({ item: c }) => {
    const salesColor = COLORS[salesList.indexOf(c.sales) % COLORS.length] || C.primary;
    return (
      <TouchableOpacity onPress={() => setSelectedCustomer(c)}
        style={[st.card, { flexDirection:'row', alignItems:'center', marginBottom:8, paddingVertical:12 }]}>
        {/* Avatar */}
        <View style={{ width:44, height:44, borderRadius:22, backgroundColor:salesColor+'33',
          alignItems:'center', justifyContent:'center', marginRight:12 }}>
          <Text style={{ color:salesColor, fontSize:18, fontWeight:'800' }}>
            {c.name[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ color:C.text, fontSize:15, fontWeight:'700' }}>{c.name}</Text>
          <Text style={{ color:C.muted, fontSize:11, marginTop:1 }}>
            <Text style={{ color:salesColor }}>{c.sales}</Text>
            {'  ·  '}{c.count} bon {'·'} terakhir {fmtDate(c.lastDate, dateFormat)}
          </Text>
        </View>
        <Text style={[st.mono, { color:C.accent, fontSize:13, fontWeight:'800' }]}>
          {toShort(c.total)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={st.flex1}>
      {/* Search + filter */}
      <View style={{ padding:14, paddingBottom:0 }}>
        <TextInput value={search} onChangeText={setSearch}
          placeholder="🔍  Cari nama pelanggan..." placeholderTextColor={C.muted}
          style={[st.input, { marginBottom:10, fontSize:14 }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:10, maxHeight:46 }}>
          <View style={{ flexDirection:'row', gap:8 }}>
            {['ALL', ...salesList].map((sl, i) => {
              const active = salesF === sl;
              const color  = i === 0 ? C.accent : COLORS[(i-1) % COLORS.length];
              return (
                <TouchableOpacity key={sl} onPress={() => setSalesF(sl)}
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:8,
                    backgroundColor: active ? color : C.input }}>
                  <Text style={{ color: active ? '#fff' : C.muted, fontSize:12, fontWeight:'700' }}>{sl}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        {/* Sort chips */}
        <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
          {[['nama','A–Z'],['total','Terbesar'],['terbaru','Terbaru']].map(([key,lbl]) => (
            <TouchableOpacity key={key} onPress={() => setSortBy(key)}
              style={{ paddingHorizontal:12, paddingVertical:5, borderRadius:8,
                backgroundColor: sortBy===key ? C.primary : C.input }}>
              <Text style={{ color: sortBy===key ? '#fff' : C.muted, fontSize:11, fontWeight:'700' }}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color:C.muted, fontSize:11, marginBottom:6 }}>
          {filtered.length} pelanggan
        </Text>
      </View>

      {/* List — A-Z grouped (nama) atau flat (total/terbaru) */}
      {grouped === null ? (
        /* Flat list untuk sort total/terbaru */
        filtered.length === 0 ? (
          <View style={{ alignItems:'center', paddingVertical:60 }}>
            <Text style={{ fontSize:40, marginBottom:12 }}>👥</Text>
            <Text style={{ color:C.muted }}>Belum ada pelanggan</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={c => `${c.sales}|${c.name}`}
            contentContainerStyle={{ paddingHorizontal:14, paddingBottom:110 }}
            renderItem={({ item: c }) => renderCustomerItem({ item: c })}
          />
        )
      ) : grouped.length === 0 ? (
        <View style={{ alignItems:'center', paddingVertical:60 }}>
          <Text style={{ fontSize:40, marginBottom:12 }}>👥</Text>
          <Text style={{ color:C.muted }}>Belum ada pelanggan</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={([letter]) => letter}
          contentContainerStyle={{ paddingHorizontal:14, paddingBottom:110 }}
          renderItem={({ item: [letter, customers] }) => (
            <View key={letter}>
              <Text style={{ color:C.primary, fontSize:13, fontWeight:'800',
                marginTop:12, marginBottom:4, letterSpacing:0.5 }}>
                {letter}
              </Text>
              {customers.map(c => renderCustomerItem({ item: c }))}
            </View>
          )}
        />
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          transactions={transactions}
          dateFormat={dateFormat}
          salesList={salesList}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </View>
  );
}

function CustomerDetailModal({ customer, transactions, dateFormat, salesList, onClose }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const salesColor = COLORS[salesList.indexOf(customer.sales) % COLORS.length] || C.primary;

  // All transactions for this customer+sales
  const custTxns = useMemo(() =>
    transactions
      .filter(t => !t.deletedAt &&
        t.sales === customer.sales &&
        getNorm(t.customerName) === getNorm(customer.name))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, customer]
  );

  const totalSpent  = custTxns.reduce((a, t) => a + t.amount, 0);
  const avgPerBon   = custTxns.length > 0 ? Math.round(totalSpent / custTxns.length) : 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[st.container, { paddingTop: Platform.OS==='ios' ? 44 : StatusBar.currentHeight||0 }]}>
        {/* Header */}
        <View style={{ backgroundColor:salesColor, padding:20, paddingBottom:24 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom:12 }}>
            <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:14 }}>← Kembali</Text>
          </TouchableOpacity>
          <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
            <View style={{ width:56, height:56, borderRadius:28, backgroundColor:'rgba(255,255,255,0.25)',
              alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'#fff', fontSize:24, fontWeight:'800' }}>
                {customer.name[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View>
              <Text style={{ color:'#fff', fontSize:20, fontWeight:'800' }}>{customer.name}</Text>
              <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>{customer.sales}</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection:'row', gap:0, backgroundColor:C.card,
          borderBottomWidth:1, borderBottomColor:C.border }}>
          {[
            ['Total Belanja', toIdr(totalSpent)],
            ['Jumlah Bon', String(custTxns.length) + ' bon'],
            ['Rata-rata', toShort(avgPerBon)],
          ].map(([lbl, val], i) => (
            <View key={i} style={{ flex:1, padding:14, borderRightWidth: i<2 ? 1 : 0, borderRightColor:C.border }}>
              <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase', marginBottom:4 }}>
                {lbl}
              </Text>
              <Text style={[st.mono, { color: i===0 ? C.accent : C.text, fontSize:14, fontWeight:'800' }]}>
                {val}
              </Text>
            </View>
          ))}
        </View>

        {/* Transaction list */}
        <FlatList
          data={custTxns}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ padding:14, paddingBottom:40 }}
          ListEmptyComponent={
            <Text style={{ color:C.muted, textAlign:'center', marginTop:40 }}>
              Belum ada transaksi
            </Text>
          }
          renderItem={({ item: t }) => (
            <View style={[st.card, { marginBottom:8, borderLeftWidth:3, borderLeftColor:salesColor }]}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                <Text style={[st.mono, { color:C.muted, fontSize:11 }]}>#{t.bonNumber}</Text>
                {t.editedAt && <Text style={{ color:C.warning, fontSize:10 }}>✎ edited</Text>}
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color:C.muted, fontSize:12 }}>{fmtDate(t.date, dateFormat)}</Text>
                <Text style={[st.mono, { color:C.accent, fontSize:15, fontWeight:'800' }]}>
                  {toIdr(t.amount)}
                </Text>
              </View>
              {t.notes ? <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{t.notes}</Text> : null}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}


// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const TABS = [
  { id:'input',      icon:'✚', label:'Input'      },
  { id:'dashboard',  icon:'◈', label:'Dashboard'  },
  { id:'riwayat',    icon:'☰', label:'Riwayat'    },
  { id:'ranking',    icon:'★', label:'Ranking'    },
  { id:'pelanggan',  icon:'👥', label:'Pelanggan'  },
];

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

  // Keep module-level C in sync for non-component helpers
  C = currentTheme;
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
        {tab==='pelanggan' && <CustomersScreen data={data} />}
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
          onClose={() => setShowSett(false)}
        />
      )}
    </View>
    </ThemeContext.Provider>
  );
}
