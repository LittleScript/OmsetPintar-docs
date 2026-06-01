import { Platform } from 'react-native';
import { MONTHS_F } from './constants';

// ─── FORMAT ───────────────────────────────────────────────────────────────────
export const toIdr   = n => 'Rp ' + (n||0).toLocaleString('id-ID');
export const toShort = n => n>=1e9?(n/1e9).toFixed(1)+'M':n>=1e6?(n/1e6).toFixed(1)+'Jt':n>=1e3?(n/1e3).toFixed(0)+'K':String(n||0);
export const padNum  = (n, len) => String(n).padStart(len, '0');
export const getNorm = name => (name||'').trim().toLowerCase().replace(/\s+/g,' ');

// ─── DATE ─────────────────────────────────────────────────────────────────────
export const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

export const fmtDate = (s, fmt='dd/mm/yyyy') => {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  if (!y||!m||!d) return s;
  if (fmt==='mm/dd/yyyy') return `${m}/${d}/${y}`;
  if (fmt==='yyyy/mm/dd') return `${y}/${m}/${d}`;
  return `${d}/${m}/${y}`;
};

export const getMondayOfWeek = (date) => {
  const d = new Date(date + 'T12:00:00');
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

export const getWeekBounds = (refDate) => {
  const mon = getMondayOfWeek(refDate);
  const d   = new Date(mon + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  const sun = d.toISOString().slice(0,10);
  return { mon, sun };
};

// ─── BON ──────────────────────────────────────────────────────────────────────
export const genBon = (seq, cfg) =>
  (cfg.prefix||'') + (cfg.separator||'') + padNum(seq, cfg.digitLength||5);

export const parseBon = (bonStr, cfg) => {
  if (!bonStr) return 0;
  const p = cfg.prefix || '';
  const s = cfg.separator || '';
  let rest = bonStr.startsWith(p + s) ? bonStr.slice((p+s).length) : bonStr;
  if (s && rest.includes(s)) {
    const parts = rest.split(s);
    rest = parts[parts.length - 1];
  }
  return parseInt(rest, 10) || 0;
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
export function filterByPeriod(txns, period, year, month) {
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
    default:
      return txns.filter(t => t.date.startsWith(String(year)));
  }
}

export function getRanking(txns, sales) {
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

export function getAutocomplete(query, txns, sales, limit=5) {
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

// ─── JARO-WINKLER SIMILARITY ─────────────────────────────────────────────────
function jaro(a, b) {
  if (a === b) return 1;
  const l1 = a.length, l2 = b.length;
  if (!l1 || !l2) return 0;
  const win = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const aM = Array(l1).fill(false), bM = Array(l2).fill(false);
  let m = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - win), hi = Math.min(i + win + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true; m++; break;
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < l1; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (m/l1 + m/l2 + (m - t/2)/m) / 3;
}

function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let pfx = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) pfx++; else break;
  }
  return j + pfx * 0.1 * (1 - j);
}

export function nameSimilarity(normA, normB) {
  if (normA === normB) return 1;
  const scoreOrig = jaroWinkler(normA, normB);
  const sortA = normA.split(' ').sort().join(' ');
  const sortB = normB.split(' ').sort().join(' ');
  const scoreSort = jaroWinkler(sortA, sortB);
  return Math.max(scoreOrig, scoreSort);
}

// ─── TYPO DETECTION ───────────────────────────────────────────────────────────
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m+1 }, (_, i) => {
    const row = [i];
    for (let j = 1; j <= n; j++) row[j] = i === 0 ? j : 0;
    return row;
  });
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

const COMMON_NAME_WORDS = new Set(['pak','bu','mas','mba','mbak','ibu','bapak','bang','kak','om','tante','nak','dek']);

export function getSignificantWords(name) {
  return getNorm(name).split(' ').filter(w => w.length >= 3 && !COMMON_NAME_WORDS.has(w));
}

export function hasWordOverlap(nameA, nameB) {
  const wordsA = getSignificantWords(nameA);
  const wordsB = getSignificantWords(nameB);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  if (wordsA.join(' ') === wordsB.join(' ')) return false;
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer  = wordsA.length <= wordsB.length ? wordsB : wordsA;
  const allMatch = shorter.every(w => longer.includes(w));
  if (!allMatch) return false;
  return shorter.some(w => w.length >= 5);
}

export function findSimilarNames(transactions) {
  const nameMap = {};
  transactions.filter(t => !t.deletedAt).forEach(t => {
    const key = `${t.sales}|||${getNorm(t.customerName)}`;
    if (!nameMap[key]) nameMap[key] = { name: t.customerName, sales: t.sales, count: 0 };
    nameMap[key].count++;
  });
  const entries = Object.values(nameMap);
  const pairs   = [];
  const seen    = new Set();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (a.sales !== b.sales) continue;
      const normA   = getNorm(a.name), normB = getNorm(b.name);
      const pairKey = [normA, normB].sort().join('|||');
      if (seen.has(pairKey)) continue;

      const minLen = Math.min(normA.length, normB.length);
      if (minLen < 3) continue;

      const JW_THRESHOLD = 0.88;
      const similarity   = nameSimilarity(normA, normB);
      const isTypo       = similarity >= JW_THRESHOLD && similarity < 1.0;
      const isPartial    = !isTypo && hasWordOverlap(normA, normB);

      if (isTypo || isPartial) {
        seen.add(pairKey);
        pairs.push({
          nameA: a.name, countA: a.count,
          nameB: b.name, countB: b.count,
          sales: a.sales,
          similarity,
          reason: isTypo ? `Mirip ${(similarity*100).toFixed(0)}%` : 'Nama parsial',
        });
      }
    }
  }
  return pairs;
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
export function parseCsvText(text, bonConfig) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
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
    const bonSeq = parseInt((f[0]||'').replace(/\D/g,''), 10);
    if (!bonSeq) continue;
    const sales = (f[1]||'').trim().toUpperCase();
    if (!sales || sales === 'SALES') continue;
    const hasSepCol = !(f[2]||'').includes('/');
    const dateIdx  = hasSepCol ? 3 : 2;
    const nameIdx  = hasSepCol ? 4 : 3;
    const amtIdx   = hasSepCol ? 5 : 4;
    const notesIdx = hasSepCol ? 6 : 5;
    const dRaw   = (f[dateIdx]||'').trim();
    const dParts = dRaw.split('/');
    if (dParts.length !== 3) continue;
    const date = `${dParts[2].padStart(4,'0')}-${dParts[1].padStart(2,'0')}-${dParts[0].padStart(2,'0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const customerName = (f[nameIdx]||'').trim();
    if (!customerName) continue;
    const amount = parseInt((f[amtIdx]||'').replace(/[^\d]/g,''), 10);
    if (!amount || amount <= 0) continue;
    const notes = (f[notesIdx]||'').trim();
    const bonNumber = genBon(bonSeq, bonConfig);
    rows.push({ bonSeq, bonNumber, sales, date, customerName, amount, notes });
  }
  return rows;
}
