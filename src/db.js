import * as SQLite from 'expo-sqlite';
import { DB_NAME, COLORS } from './constants';
import { todayStr, getNorm } from './utils';

// ─── SINGLETON ────────────────────────────────────────────────────────────────
let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

// ─── INIT / MIGRATE ───────────────────────────────────────────────────────────
export async function initDb() {
  const db = await getDb();
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  // CREATE TABLES — fresh install mendapat semua kolom langsung
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
      current_seq        INTEGER NOT NULL DEFAULT 1,
      theme_mode         TEXT    NOT NULL DEFAULT 'dark',
      pin_lock_enabled   INTEGER NOT NULL DEFAULT 0,
      notif_enabled      INTEGER NOT NULL DEFAULT 0,
      notif_hour         INTEGER NOT NULL DEFAULT 20,
      onboarding_done    INTEGER NOT NULL DEFAULT 0
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
      deleted_at       TEXT,
      edited_at        TEXT,
      original_values  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_txn_date      ON transactions(transaction_date)  WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_year      ON transactions(year, sales_name)  WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_yearmonth ON transactions(year_month)        WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_txn_customer  ON transactions(sales_name, customer_norm) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS typo_ignored (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      sales   TEXT NOT NULL,
      norm_a  TEXT NOT NULL,
      norm_b  TEXT NOT NULL,
      UNIQUE(sales, norm_a, norm_b)
    );
  `);

  // MIGRASI install lama — ALTER gagal diam-diam jika kolom sudah ada
  try { await db.execAsync(`DROP INDEX IF EXISTS idx_bon_unique`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN edited_at TEXT`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE transactions ADD COLUMN original_values TEXT`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE settings ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'dark'`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE settings ADD COLUMN pin_lock_enabled INTEGER NOT NULL DEFAULT 0`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE settings ADD COLUMN notif_enabled INTEGER NOT NULL DEFAULT 0`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE settings ADD COLUMN notif_hour INTEGER NOT NULL DEFAULT 20`); } catch(e) {}
  try { await db.execAsync(`ALTER TABLE settings ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0`); } catch(e) {}
}

// ─── DATA ACCESS ──────────────────────────────────────────────────────────────
async function loadSettings(db) {
  return db.getFirstAsync('SELECT * FROM settings WHERE id=1');
}

async function loadSales(db) {
  return db.getAllAsync('SELECT * FROM sales WHERE active=1 ORDER BY display_order ASC');
}

async function loadTransactions(db) {
  return db.getAllAsync('SELECT * FROM transactions ORDER BY id DESC');
}

function dbRowToTx(row) {
  return {
    id:             row.id,
    bonNumber:      row.bon_number,
    bonSeq:         row.bon_seq,
    sales:          row.sales_name,
    customerName:   row.customer_name,
    customerId:     row.sales_name+'___'+row.customer_norm,
    amount:         row.amount,
    date:           row.transaction_date,
    notes:          row.notes || '',
    createdAt:      row.created_at,
    deletedAt:      row.deleted_at || null,
    editedAt:       row.edited_at  || null,
    originalValues: row.original_values ? JSON.parse(row.original_values) : null,
  };
}

export async function assembleData(db) {
  const cfg = await loadSettings(db);
  if (!cfg) return null;
  const salesRows = await loadSales(db);
  const txRows    = await loadTransactions(db);
  const ignoredTypoPairs = await loadIgnoredTypoPairs(db);
  return {
    themeMode:        cfg.theme_mode || 'dark',
    pinLockEnabled:   !!cfg.pin_lock_enabled,
    notifEnabled:     !!cfg.notif_enabled,
    notifHour:        cfg.notif_hour ?? 20,
    onboardingDone:   !!cfg.onboarding_done,
    companyName:      cfg.company_name,
    isSetupComplete:  !!cfg.is_setup_complete,
    bonConfig: {
      prefix:      cfg.bon_prefix,
      separator:   cfg.bon_separator,
      digitLength: cfg.bon_digit_length,
    },
    dateFormat:       cfg.date_format,
    activeYear:       cfg.active_year || new Date().getFullYear(),
    lastDate:         cfg.last_date   || todayStr(),
    lastSales:        cfg.last_sales  || (salesRows[0]?.name || ''),
    nextSeq:          cfg.current_seq || 1,
    salesList:        salesRows.map(s => s.name),
    salesData:        salesRows,
    transactions:     txRows.map(dbRowToTx),
    ignoredTypoPairs,
  };
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
export async function insertTransaction(db, tx) {
  const now  = new Date().toISOString();
  const year = parseInt(tx.date.slice(0,4), 10);
  const ym   = tx.date.slice(0,7);
  const norm = getNorm(tx.customerName);
  const exists = await db.getFirstAsync(
    'SELECT id FROM transactions WHERE bon_number=? AND deleted_at IS NULL', [tx.bonNumber]
  );
  if (exists) console.warn(`Bon ${tx.bonNumber} already exists`);
  const parsedBonSeq = parseInt((tx.bonNumber||'').match(/(\d+)$/)?.[1]||'0', 10)||0;
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

export async function updateTransaction(db, id, fields, originalTx) {
  const now  = new Date().toISOString();
  const sets = [], vals = [];
  if (fields.bonNumber   != null) { sets.push('bon_number=?');       vals.push(fields.bonNumber); }
  if (fields.sales       != null) { sets.push('sales_name=?');       vals.push(fields.sales); }
  if (fields.customerName!= null) {
    sets.push('customer_name=?'); vals.push(fields.customerName.trim());
    sets.push('customer_norm=?'); vals.push(getNorm(fields.customerName));
  }
  if (fields.amount      != null) { sets.push('amount=?');           vals.push(fields.amount); }
  if (fields.date        != null) {
    sets.push('transaction_date=?'); vals.push(fields.date);
    sets.push('year=?');             vals.push(parseInt(fields.date.slice(0,4),10));
    sets.push('year_month=?');       vals.push(fields.date.slice(0,7));
  }
  if (fields.notes       != null) { sets.push('notes=?');            vals.push(fields.notes); }
  if (!sets.length) return;
  if (originalTx && !originalTx.editedAt) {
    sets.push('edited_at=?'); vals.push(now);
    sets.push('original_values=?');
    vals.push(JSON.stringify({
      bonNumber:    originalTx.bonNumber,
      sales:        originalTx.sales,
      customerName: originalTx.customerName,
      amount:       originalTx.amount,
      date:         originalTx.date,
      notes:        originalTx.notes,
    }));
  } else if (originalTx) {
    sets.push('edited_at=?'); vals.push(now);
  }
  sets.push('updated_at=?'); vals.push(now);
  vals.push(id);
  await db.runAsync(`UPDATE transactions SET ${sets.join(',')} WHERE id=?`, vals);
}

export async function softDeleteTransaction(db, id) {
  await db.runAsync(`UPDATE transactions SET deleted_at=? WHERE id=?`, [new Date().toISOString(), id]);
}

export async function restoreTransaction(db, id) {
  await db.runAsync(`UPDATE transactions SET deleted_at=NULL, updated_at=? WHERE id=?`, [new Date().toISOString(), id]);
}

export async function setupBusiness(db, setup) {
  await db.runAsync(
    `UPDATE settings SET company_name=?,bon_prefix=?,bon_separator=?,
     bon_digit_length=?,date_format=?,is_setup_complete=1 WHERE id=1`,
    [setup.companyName, setup.bonConfig.prefix, setup.bonConfig.separator, setup.bonConfig.digitLength, setup.dateFormat]
  );
  for (let i=0; i<setup.salesList.length; i++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO sales (name, color, display_order) VALUES (?,?,?)`,
      [setup.salesList[i], COLORS[i % COLORS.length], i]
    );
  }
}

export async function updateSettings(db, fields) {
  const sets = [], vals = [];
  if (fields.companyName   !=null){ sets.push('company_name=?');    vals.push(fields.companyName); }
  if (fields.dateFormat    !=null){ sets.push('date_format=?');     vals.push(fields.dateFormat); }
  if (fields.bonPrefix     !=null){ sets.push('bon_prefix=?');      vals.push(fields.bonPrefix); }
  if (fields.bonSeparator  !=null){ sets.push('bon_separator=?');   vals.push(fields.bonSeparator); }
  if (fields.bonDigits     !=null){ sets.push('bon_digit_length=?');vals.push(fields.bonDigits); }
  if (fields.activeYear    !=null){ sets.push('active_year=?');     vals.push(fields.activeYear); }
  if (fields.themeMode     !=null){ sets.push('theme_mode=?');      vals.push(fields.themeMode); }
  if (fields.pinLockEnabled!=null){ sets.push('pin_lock_enabled=?');vals.push(fields.pinLockEnabled?1:0); }
  if (fields.notifEnabled  !=null){ sets.push('notif_enabled=?');   vals.push(fields.notifEnabled?1:0); }
  if (fields.notifHour     !=null){ sets.push('notif_hour=?');      vals.push(fields.notifHour); }
  if (!sets.length) return;
  await db.runAsync(`UPDATE settings SET ${sets.join(',')} WHERE id=1`, vals);
}

export async function addSales(db, name, color, order) {
  const { COLORS } = require('./constants');
  await db.runAsync(
    `INSERT OR IGNORE INTO sales (name,color,display_order) VALUES (?,?,?)`,
    [name.toUpperCase(), color || COLORS[order%COLORS.length], order]
  );
}

export async function deactivateSales(db, name) {
  await db.runAsync(`UPDATE sales SET active=0 WHERE name=?`, [name]);
}

export async function setOnboardingDone(db) {
  await db.runAsync(`UPDATE settings SET onboarding_done=1 WHERE id=1`);
}

export async function addIgnoredTypoPair(db, sales, normA, normB) {
  const [a, b] = [normA, normB].sort();
  await db.runAsync(
    `INSERT OR IGNORE INTO typo_ignored (sales, norm_a, norm_b) VALUES (?,?,?)`,
    [sales, a, b]
  );
}

export async function loadIgnoredTypoPairs(db) {
  const rows = await db.getAllAsync('SELECT sales, norm_a, norm_b FROM typo_ignored');
  return new Set(rows.map(r => `${r.sales}|||${r.norm_a}|||${r.norm_b}`));
}

export async function mergeCustomerName(db, oldName, newName, sales) {
  const newNorm = getNorm(newName);
  await db.runAsync(
    `UPDATE transactions SET customer_name=?, customer_norm=?, updated_at=?
     WHERE customer_norm=? AND sales_name=? AND deleted_at IS NULL`,
    [newName.trim(), newNorm, new Date().toISOString(), getNorm(oldName), sales]
  );
}
