import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, StatusBar, Share, Dimensions, Image } from 'react-native';
import * as Sharing from 'expo-sharing';
import { ThemeContext, getStyles, SalesChip, btnStyle, KpiCard } from '../theme';
import { COLORS, MONTHS, MONTHS_F } from '../constants';
import { toIdr, toShort, todayStr, fmtDate, getWeekBounds } from '../utils';
import { PurchasesContext, LanguageContext } from '../contexts';
import { can, FREE } from '../premium';
import { PaywallOverlay } from '../components/PaywallOverlay';

let captureRef = null;
try { captureRef = require('react-native-view-shot').captureRef; } catch(_) {}

// PctTag di luar component agar identity stabil (tidak remount setiap render parent)
function PctTag({ pct, C }) {
  if (pct === null || pct === undefined) return null;
  const abs = Math.abs(pct), flat = abs < 0.5;
  const col = flat ? C.muted : pct > 0 ? C.success : C.danger;
  return (
    <Text style={{ color:col, fontSize:10, fontWeight:'700', marginTop:1 }}>
      {flat ? '→ 0%' : (pct > 0 ? '↑ ' : '↓ ') + abs.toFixed(1) + '%'}
    </Text>
  );
}

// ── Daily Line Chart — omset harian per sales dalam 1 bulan ────────────────────
function DailyLineChart({ activeTxns, salesList, month, year, setMonth, setYear, C, st, t }) {
  const CHART_H = 100;
  const screenW = Dimensions.get('window').width - 32 - 32; // card padding

  // Hitung hari dalam bulan
  const daysInMonth = new Date(year, month, 0).getDate();
  const ymStr = `${year}-${String(month).padStart(2,'0')}`;

  // Omset per hari per sales
  const dailyData = useMemo(() => {
    const map = {}; // salesName → [day1Total, day2Total, ...]
    salesList.forEach(s => { map[s] = Array(daysInMonth).fill(0); });
    activeTxns.forEach(tx => {
      if (!tx.date.startsWith(ymStr)) return;
      const day = parseInt(tx.date.slice(8, 10), 10) - 1; // 0-indexed
      if (day >= 0 && day < daysInMonth && map[tx.sales]) {
        map[tx.sales][day] += tx.amount;
      }
    });
    return map;
  }, [activeTxns, salesList, ymStr, daysInMonth]);

  // Nilai max untuk normalisasi
  const globalMax = useMemo(() => {
    let mx = 0;
    Object.values(dailyData).forEach(arr => arr.forEach(v => { if (v > mx) mx = v; }));
    return mx || 1;
  }, [dailyData]);

  // Prev / next month
  const prevMonth = () => {
    let m = month - 1, y = year;
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };
  const nextMonth = () => {
    let m = month + 1, y = year;
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const hasData = globalMax > 1;
  const monthName = MONTHS_F[month - 1];

  // Build polyline points for each sales
  const buildPoints = (arr) => {
    const step = screenW / Math.max(daysInMonth - 1, 1);
    return arr.map((v, i) => ({
      x: i * step,
      y: CHART_H - (v / globalMax) * CHART_H * 0.9,
    }));
  };

  return (
    <View style={st.card}>
      {/* Header + month nav */}
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase' }}>
          {t('omset_dist')}
        </Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <TouchableOpacity onPress={prevMonth}
            style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
            <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color:C.accent, fontSize:13, fontWeight:'800', minWidth:80, textAlign:'center' }}>
            {monthName} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth}
            style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
            <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend */}
      {salesList.length > 1 && (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 }}>
          {salesList.map((s, i) => (
            <View key={s} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
              <View style={{ width:16, height:3, borderRadius:2, backgroundColor:COLORS[i % COLORS.length] }} />
              <Text style={{ color:C.muted, fontSize:10 }}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* SVG-like line chart using absolute-positioned Views */}
      {!hasData ? (
        <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:12 }}>{t('no_data')}</Text>
      ) : (
        <View style={{ height: CHART_H + 20, position:'relative', marginBottom:4 }}>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <View key={pct} style={{
              position:'absolute', left:0, right:0,
              top: CHART_H * (1 - pct * 0.9) - 1,
              height:1, backgroundColor: C.border + '66'
            }} />
          ))}
          {/* Line segments per sales */}
          {salesList.map((s, si) => {
            const pts = buildPoints(dailyData[s] || []);
            const color = COLORS[si % COLORS.length];
            return (
              <React.Fragment key={`lines_${s}`}>
                {pts.slice(0, -1).map((p, i) => {
                  const next = pts[i + 1];
                  const dx = next.x - p.x;
                  const dy = next.y - p.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  if (dailyData[s][i] === 0 && dailyData[s][i+1] === 0) return null;
                  return (
                    <View key={`${s}_${i}`} style={{
                      position:'absolute',
                      left: p.x + dx/2 - len/2, top: p.y + dy/2 - 1.25,
                      width: len, height: 2.5,
                      backgroundColor: color,
                      borderRadius: 2,
                      transform: [{ rotate: `${angle}deg` }],
                      opacity: 0.85,
                    }} />
                  );
                })}
              </React.Fragment>
            );
          })}
          {/* Dots at data points with non-zero values */}
          {salesList.map((s, si) => {
            const pts = buildPoints(dailyData[s] || []);
            const color = COLORS[si % COLORS.length];
            return (
              <React.Fragment key={`dots_${s}`}>
                {pts.map((p, i) => {
                  if (!dailyData[s][i]) return null;
                  return (
                    <View key={`dot_${s}_${i}`} style={{
                      position:'absolute',
                      left: p.x - 3, top: p.y - 3,
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: color,
                      borderWidth: 1.5, borderColor: C.card,
                    }} />
                  );
                })}
              </React.Fragment>
            );
          })}
          {/* X-axis day labels — setiap 5 hari */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1)
            .filter(d => d === 1 || d % 5 === 0 || d === daysInMonth)
            .map(d => {
              const step = screenW / Math.max(daysInMonth - 1, 1);
              return (
                <Text key={d} style={{
                  position:'absolute', left: (d-1) * step - 8,
                  top: CHART_H + 4, color: C.muted, fontSize: 8
                }}>{d}</Text>
              );
            })
          }
        </View>
      )}

      {/* Total bulan ini */}
      {hasData && (() => {
        const monthTotal = activeTxns
          .filter(tx => tx.date.startsWith(ymStr))
          .reduce((a, t) => a + t.amount, 0);
        const monthCount = activeTxns.filter(tx => tx.date.startsWith(ymStr)).length;
        return (
          <View style={{ borderTopWidth:1, borderTopColor:C.border, paddingTop:8, marginTop:4 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color:C.muted, fontSize:11 }}>{t('total_omset')} {monthName}</Text>
              <Text style={[st.mono, { color:C.accent, fontSize:13, fontWeight:'800' }]}>{toShort(monthTotal)}</Text>
            </View>
            <Text style={{ color:C.muted, fontSize:10, marginTop:2 }}>{monthCount} {t('bon')}</Text>
          </View>
        );
      })()}
    </View>
  );
}

function DashboardScreen({ data, onYearChange }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { purchases, openPaywall } = useContext(PurchasesContext);
  const { t, lang } = useContext(LanguageContext);
  const hasDashPct   = can.dashboardPct(purchases);
  const hasHariTsb   = can.hariTersibuk(purchases);
  const hasChartFull = can.chartFull(purchases);
  const hasShareKartu = can.shareKartu(purchases);

  const { salesList, transactions, activeYear, dateFormat } = data;
  const [busyMonthFilter,  setBusyMonthFilter]  = useState(0);
  const [lineChartMonth,   setLineChartMonth]   = useState(() => new Date().getMonth()+1); // 1-12
  const [lineChartYear,    setLineChartYear]    = useState(() => new Date().getFullYear());
  const [showShareModal,   setShowShareModal]    = useState(false);
  const [shareType,        setShareType]         = useState('hari');
  const [shareDay,         setShareDay]          = useState(() => todayStr());
  const [shareWeekRef,     setShareWeekRef]      = useState(() => todayStr());
  const [shareMonthY,      setShareMonthY]       = useState(() => new Date().getFullYear());
  const [shareMonthM,      setShareMonthM]       = useState(() => new Date().getMonth()+1);
  const [shareYearVal,     setShareYearVal]      = useState(activeYear);
  const [showShareDatePicker, setShowShareDatePicker] = useState(false);
  const rekapCardRef = useRef(null);

  const DAY_NAMES_ID = lang === 'en'
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    : ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  const activeTxns = useMemo(() =>
    (transactions || []).filter(t => !t.deletedAt), [transactions]);

  const today  = todayStr();
  const { mon, sun } = getWeekBounds(today);

  const todayTxns = activeTxns.filter(t => t.date === today);
  const weekTxns  = activeTxns.filter(t => t.date >= mon && t.date <= sun);
  const yearTxns  = activeTxns.filter(t => t.date.startsWith(String(activeYear)));

  const yearTotal  = yearTxns.reduce((a,t) => a+t.amount, 0);
  const yearCount  = yearTxns.length;
  const todayTotal = todayTxns.reduce((a,t) => a+t.amount, 0);
  const weekTotal  = weekTxns.reduce((a,t) => a+t.amount, 0);

  // ── Perbandingan vs periode sebelumnya ─────────────────────────────────────
  const yesterdayStr  = useMemo(() => {
    const d = new Date(today+'T12:00:00'); d.setDate(d.getDate()-1);
    return d.toISOString().slice(0,10);
  }, [today]);
  const yesterdayTotal = useMemo(() =>
    activeTxns.filter(t => t.date === yesterdayStr).reduce((a,t) => a+t.amount, 0),
    [activeTxns, yesterdayStr]);

  const lastWeekBounds = useMemo(() => {
    const d = new Date(today+'T12:00:00'); d.setDate(d.getDate()-7);
    return getWeekBounds(d.toISOString().slice(0,10));
  }, [today]);
  const lastWeekTotal  = useMemo(() =>
    activeTxns.filter(t => t.date >= lastWeekBounds.mon && t.date <= lastWeekBounds.sun)
      .reduce((a,t) => a+t.amount, 0),
    [activeTxns, lastWeekBounds]);

  // Hitung % perubahan — null jika periode lalu kosong (belum ada data)
  const dayPct  = yesterdayTotal > 0 ? (todayTotal  - yesterdayTotal) / yesterdayTotal * 100 : null;
  const weekPct = lastWeekTotal  > 0 ? (weekTotal   - lastWeekTotal)  / lastWeekTotal  * 100 : null;

  const bySales = salesList.map((s,i) => {
    const sTx = yearTxns.filter(t => t.sales===s);
    return { name:s, total:sTx.reduce((a,t)=>a+t.amount,0), count:sTx.length, color:COLORS[i%COLORS.length] };
  });

  // Free: hanya tampilkan FREE.CHART_MONTHS_VISIBLE bulan terakhir
  const currentMonth   = new Date().getMonth(); // 0-indexed
  const visibleMonths  = hasChartFull
    ? new Set([0,1,2,3,4,5,6,7,8,9,10,11])
    : new Set(Array.from({ length: FREE.CHART_MONTHS_VISIBLE }, (_, k) =>
        (currentMonth - k + 12) % 12));

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

  // ── Share rekap dengan pilihan periode bebas ────────────────────────────────
  const shareWeekBounds = useMemo(() => getWeekBounds(shareWeekRef), [shareWeekRef]);

  const sharePreview = useMemo(() => {
    const active = (transactions || []).filter(t => !t.deletedAt);
    let txns, header, sub;
    if (shareType === 'hari') {
      txns   = active.filter(t => t.date === shareDay);
      header = 'Rekap Omset';
      sub    = `${DAY_NAMES_ID[new Date(shareDay+'T12:00:00').getDay()]}, ${fmtDate(shareDay, dateFormat)}`;
    } else if (shareType === 'minggu') {
      txns   = active.filter(t => t.date >= shareWeekBounds.mon && t.date <= shareWeekBounds.sun);
      header = 'Rekap Omset Minggu';
      sub    = `${fmtDate(shareWeekBounds.mon, dateFormat)} – ${fmtDate(shareWeekBounds.sun, dateFormat)}`;
    } else if (shareType === 'bulan') {
      const ym = `${shareMonthY}-${String(shareMonthM).padStart(2,'0')}`;
      txns   = active.filter(t => t.date.startsWith(ym));
      header = `Rekap Omset ${MONTHS_F[shareMonthM-1]} ${shareMonthY}`;
      sub    = null;
    } else {
      txns   = active.filter(t => t.date.startsWith(String(shareYearVal)));
      header = `Rekap Omset Tahun ${shareYearVal}`;
      sub    = null;
    }
    return { txns, total: txns.reduce((a,t) => a+t.amount, 0), header, sub };
  }, [shareType, shareDay, shareWeekBounds, shareMonthY, shareMonthM, shareYearVal, transactions, dateFormat]);

  const handleShareExecute = async () => {
    // Share sebagai gambar — premium (Laporan & Ekspor)
    if (hasShareKartu && captureRef && rekapCardRef.current) {
      try {
        const uri = await captureRef(rekapCardRef, { format:'png', quality:1 });
        await Sharing.shareAsync(uri, {
          mimeType:'image/png', dialogTitle:'Bagikan Rekap Omset Pintar'
        });
        return;
      } catch(_) {} // fallback ke teks jika gagal
    }
    // Jika belum premium: buka paywall untuk share kartu
    if (!hasShareKartu && captureRef) {
      openPaywall('share_kartu');
      return;
    }
    // Fallback: share sebagai teks
    const { txns, total, header, sub } = sharePreview;
    const lines = [
      `📊 *${header}*`,
      `🏪 ${data.companyName || 'Toko'}${sub ? '  |  ' + sub : ''}`,
      '',
      `💰 Total: *${toIdr(total)}*`,
      `🧾 Jumlah bon: ${txns.length}`,
      '',
    ];
    if (txns.length > 0) {
      salesList.forEach(s => {
        const sTx = txns.filter(t => t.sales === s);
        if (sTx.length > 0)
          lines.push(`• ${s}: ${toIdr(sTx.reduce((a,t)=>a+t.amount,0))} (${sTx.length} bon)`);
      });
      lines.push('');
    }
    lines.push('_via Omset Pintar_');
    try { await Share.share({ message: lines.join('\n') }); } catch(e) {}
  };

  return (
    <View style={st.flex1}>
    <ScrollView style={st.container} contentContainerStyle={st.scroll}>
      {/* Year */}
      <View style={[st.card, { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:24 }]}>
        <TouchableOpacity onPress={() => onYearChange(activeYear-1)}
          style={{ backgroundColor:C.input, borderRadius:10, padding:10 }}>
          <Text style={{ color:C.text, fontSize:20 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems:'center' }}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:1 }}>{t('year_label')}</Text>
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
            {t('today_label')} · {fmtDate(today, dateFormat)}
          </Text>
          <TouchableOpacity
            onPress={() => setShowShareModal(true)}
            style={{ backgroundColor:C.primary+'22', borderRadius:8, paddingHorizontal:10, paddingVertical:5,
              borderWidth:1, borderColor:C.primary+'44' }}>
            <Text style={{ color:C.primary, fontSize:12, fontWeight:'700' }}>{t('share_rekap')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
          <View>
            <Text style={[st.mono, { color:C.text, fontSize:20, fontWeight:'800' }]}>
              {toIdr(todayTotal)}
            </Text>
            <Text style={{ color:C.muted, fontSize:12 }}>{todayTxns.length} bon</Text>
            {hasDashPct
              ? <PctTag pct={dayPct} C={C} />
              : <TouchableOpacity onPress={() => openPaywall('dashboard_pct')}>
                  <Text style={{ color:C.primary, fontSize:10, fontWeight:'700', marginTop:1 }}>🔒 ↑↓ %</Text>
                </TouchableOpacity>
            }
            {hasDashPct && dayPct !== null && (
              <Text style={{ color:C.muted, fontSize:9 }}>{t('vs_yesterday')}</Text>
            )}
          </View>
          <View style={{ alignItems:'flex-end' }}>
            <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase' }}>{t('this_week')}</Text>
            <Text style={[st.mono, { color:C.text, fontSize:18, fontWeight:'800' }]}>
              {toShort(weekTotal)}
            </Text>
            <Text style={{ color:C.muted, fontSize:12 }}>{weekTxns.length} bon</Text>
            {hasDashPct
              ? <PctTag pct={weekPct} C={C} />
              : <TouchableOpacity onPress={() => openPaywall('dashboard_pct')}>
                  <Text style={{ color:C.primary, fontSize:10, fontWeight:'700', marginTop:1 }}>🔒 ↑↓ %</Text>
                </TouchableOpacity>
            }
            {hasDashPct && weekPct !== null && (
              <Text style={{ color:C.muted, fontSize:9 }}>{t('vs_last_week')}</Text>
            )}
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
        <KpiCard label={t('total_omset')} value={toIdr(yearTotal)} sub={yearCount+' '+t('bon')} color={C.accent} />
        <KpiCard label={t('avg_per_bon')} value={toIdr(yearCount>0?Math.round(yearTotal/yearCount):0)} sub={t('per_bon')} />
      </View>

      {/* Per-sales breakdown */}
      <View style={st.card}>
        <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
          {t('sales_omset')} {activeYear}
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
            {t('monthly_chart')} {activeYear}
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
              const maxH    = monthly.reduce((mx, x) => Math.max(mx, x.total), 0);
              const visible = visibleMonths.has(i); // free: hanya 2 bulan terakhir
              return (
                <View key={i} style={{ flex:1, alignItems:'center', justifyContent:'flex-end', height:80 }}>
                  {visible ? (
                    <>
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
                    </>
                  ) : (
                    // Bulan terkunci — bar abu + gembok kecil
                    <TouchableOpacity
                      onPress={() => openPaywall('chart_full')}
                      style={{ flex:1, width:'100%', alignItems:'center', justifyContent:'flex-end' }}>
                      <View style={{ flex:1, width:'60%', backgroundColor:C.input, borderRadius:2, opacity:0.4 }} />
                      <Text style={{ fontSize:8, marginTop:2 }}>🔒</Text>
                      <Text style={{ color:C.muted, fontSize:7, marginTop:1 }}>{m.name}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Daily Line Chart per Sales ── */}
      {yearTotal > 0 && <DailyLineChart
        activeTxns={activeTxns}
        salesList={salesList}
        month={lineChartMonth}
        year={lineChartYear}
        setMonth={setLineChartMonth}
        setYear={setLineChartYear}
        C={C} st={st} t={t}
      />}

      {/* Hari Tersibuk — FREE: blur overlay */}
      {yearTotal > 0 && (
        <View style={st.card}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:8 }}>
            {t('busiest_day')} — {busyMonthFilter === 0 ? `ALL ${activeYear}` : `${MONTHS_F[busyMonthFilter-1]} ${activeYear}`}
          </Text>
          <PaywallOverlay
            locked={!hasHariTsb}
            featureKey="hari_tersibuk"
            subtitle={t('busiest_hint')}
            onUnlock={() => openPaywall('hari_tersibuk')}
            minHeight={200}>
            {/* Filter bulan */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}>
              {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                const active = busyMonthFilter === m;
                return (
                  <TouchableOpacity key={m} onPress={() => setBusyMonthFilter(m)}
                    style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:8, marginRight:6,
                      backgroundColor: active ? C.accent : C.input }}>
                    <Text style={{ color: active ? '#fff' : C.muted, fontSize:11, fontWeight:'700' }}>
                      {m === 0 ? t('all') : MONTHS[m-1]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {busyBaseTxns.length === 0 ? (
              <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>{t('no_data')}</Text>
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
          </PaywallOverlay>
        </View>
      )}
    </ScrollView>

      {/* ── Share Rekap Modal ── */}
      {showShareModal && (
        <Modal visible animationType="slide" onRequestClose={() => setShowShareModal(false)}>
          <View style={[st.container, { paddingTop: Platform.OS==='ios'?44:StatusBar.currentHeight||0 }]}>
            {/* Header */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center',
              paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.text, fontSize:17, fontWeight:'800' }}>{t('share_title')}</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}
                style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
                <Text style={{ color:C.muted }}>✕ {t('close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
              {/* Tab selector */}
              <View style={{ flexDirection:'row', gap:6, marginBottom:16 }}>
                {[['hari', t('day_tab')],['minggu', t('week_tab')],['bulan', t('month_tab')],['tahun', t('year_tab')]].map(([v,l]) => (
                  <TouchableOpacity key={v} onPress={() => setShareType(v)}
                    style={{ flex:1, paddingVertical:9, borderRadius:10, alignItems:'center',
                      backgroundColor: shareType===v ? C.primary : C.input }}>
                    <Text style={{ color: shareType===v ? '#fff' : C.muted, fontSize:12, fontWeight:'700' }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Navigator per tipe */}
              <View style={[st.card, { flexDirection:'row', alignItems:'center',
                justifyContent:'space-between', marginBottom:16, paddingVertical:18 }]}>
                {shareType === 'hari' && (<>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(shareDay+'T12:00:00'); d.setDate(d.getDate()-1);
                    setShareDay(d.toISOString().slice(0,10));
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowShareDatePicker(true)} style={{ alignItems:'center' }}>
                    <Text style={{ color:C.accent, fontSize:16, fontWeight:'800' }}>
                      {DAY_NAMES_ID[new Date(shareDay+'T12:00:00').getDay()]}
                    </Text>
                    <Text style={{ color:C.text, fontSize:15, fontWeight:'700', marginTop:2 }}>
                      {fmtDate(shareDay, dateFormat)}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:10, marginTop:3 }}>{t('tap_select_date')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(shareDay+'T12:00:00'); d.setDate(d.getDate()+1);
                    setShareDay(d.toISOString().slice(0,10));
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </>)}
                {shareType === 'minggu' && (<>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(shareWeekRef+'T12:00:00'); d.setDate(d.getDate()-7);
                    setShareWeekRef(d.toISOString().slice(0,10));
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ color:C.text, fontSize:13, fontWeight:'800' }}>
                      {fmtDate(shareWeekBounds.mon, dateFormat)}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:11, marginVertical:2 }}>{t('to_label')}</Text>
                    <Text style={{ color:C.text, fontSize:13, fontWeight:'800' }}>
                      {fmtDate(shareWeekBounds.sun, dateFormat)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(shareWeekRef+'T12:00:00'); d.setDate(d.getDate()+7);
                    setShareWeekRef(d.toISOString().slice(0,10));
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </>)}
                {shareType === 'bulan' && (<>
                  <TouchableOpacity onPress={() => {
                    let m = shareMonthM-1, y = shareMonthY;
                    if (m < 1) { m=12; y--; }
                    setShareMonthM(m); setShareMonthY(y);
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ color:C.accent, fontSize:18, fontWeight:'800' }}>{MONTHS_F[shareMonthM-1]}</Text>
                    <Text style={{ color:C.text, fontSize:14, fontWeight:'700', marginTop:2 }}>{shareMonthY}</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    let m = shareMonthM+1, y = shareMonthY;
                    if (m > 12) { m=1; y++; }
                    setShareMonthM(m); setShareMonthY(y);
                  }} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </>)}
                {shareType === 'tahun' && (<>
                  <TouchableOpacity onPress={() => setShareYearVal(v => v-1)} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[st.mono, { color:C.accent, fontSize:32, fontWeight:'800' }]}>{shareYearVal}</Text>
                  <TouchableOpacity onPress={() => setShareYearVal(v => v+1)} style={{ padding:10 }}>
                    <Text style={{ color:C.text, fontSize:24, fontWeight:'700' }}>›</Text>
                  </TouchableOpacity>
                </>)}
              </View>

              {/* Kartu Rekap — clean, profesional, mudah dibaca */}
              <View ref={rekapCardRef} collapsable={false}
                style={{ backgroundColor:'#FFFFFF', borderRadius:16, marginBottom:16,
                  overflow:'hidden', borderWidth:1, borderColor:'#e2e8f0' }}>

                {/* Header hijau dengan logo */}
                <View style={{ backgroundColor:'#f0fdf4', paddingHorizontal:16, paddingVertical:12,
                  flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  borderBottomWidth:1, borderBottomColor:'#dcfce7' }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <View style={{ width:32, height:32, borderRadius:8, backgroundColor:'#16a34a',
                      alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      <Image source={require('../../assets/logo_header.png')}
                        style={{ width:28, height:28, borderRadius:4 }} />
                    </View>
                    <Text style={{ color:'#16a34a', fontSize:14, fontWeight:'800', letterSpacing:0.5 }}>
                      {t('rekap_header_title')}
                    </Text>
                  </View>
                  <Text style={{ color:'#64748b', fontSize:10, fontWeight:'600' }}>
                    {data.companyName || 'Toko'}
                  </Text>
                </View>

                <View style={{ padding:16 }}>
                  {/* Judul periode */}
                  <Text style={{ color:'#16a34a', fontSize:9, fontWeight:'800',
                    letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>
                    {sharePreview.header}
                  </Text>
                  {sharePreview.sub ? (
                    <Text style={{ color:'#334155', fontSize:13, fontWeight:'700', marginBottom:12 }}>
                      {sharePreview.sub}
                    </Text>
                  ) : <View style={{ marginBottom:10 }} />}

                  {/* Total besar */}
                  <View style={{ backgroundColor:'#f0fdf4', borderRadius:12, padding:14,
                    alignItems:'center', marginBottom:14 }}>
                    <Text style={{ color:'#64748b', fontSize:9, letterSpacing:1.5,
                      textTransform:'uppercase', marginBottom:4 }}>{t('total_omset_label')}</Text>
                    {sharePreview.txns.length > 0 ? (
                      <>
                        <Text style={{ color:'#16a34a', fontSize:28, fontWeight:'800',
                          fontFamily: Platform.OS==='ios'?'Courier New':'monospace' }}>
                          {toIdr(sharePreview.total)}
                        </Text>
                        <Text style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>
                          {sharePreview.txns.length} transaksi
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color:'#94a3b8', fontSize:12, fontStyle:'italic', marginVertical:8 }}>
                        {t('no_transactions')}
                      </Text>
                    )}
                  </View>

                  {/* Per sales — hanya jika ada transaksi */}
                  {sharePreview.txns.length > 0 && (
                    <View style={{ borderTopWidth:1, borderTopColor:'#f1f5f9', paddingTop:10 }}>
                      {salesList.map((s,i) => {
                        const sTx = sharePreview.txns.filter(t => t.sales === s);
                        if (!sTx.length) return null;
                        const stotal = sTx.reduce((a,t)=>a+t.amount,0);
                        return (
                          <View key={s} style={{ flexDirection:'row', justifyContent:'space-between',
                            alignItems:'center', paddingVertical:6,
                            borderBottomWidth:1, borderBottomColor:'#f8fafc' }}>
                            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                              <View style={{ width:8, height:8, borderRadius:4,
                                backgroundColor: COLORS[i%COLORS.length] }} />
                              <Text style={{ color:'#334155', fontSize:12, fontWeight:'600' }}>{s}</Text>
                            </View>
                            <View style={{ alignItems:'flex-end' }}>
                              <Text style={{ color:'#1e293b', fontSize:13, fontWeight:'800' }}>
                                {toIdr(stotal)}
                              </Text>
                              <Text style={{ color:'#94a3b8', fontSize:9 }}>{sTx.length} bon</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Footer */}
                <View style={{ backgroundColor:'#f8fafc', paddingHorizontal:16, paddingVertical:8,
                  borderTopWidth:1, borderTopColor:'#f1f5f9', flexDirection:'row',
                  justifyContent:'space-between', alignItems:'center' }}>
                  <Text style={{ color:'#94a3b8', fontSize:9 }}>{t('via_app')}</Text>
                  <Text style={{ color:'#94a3b8', fontSize:9 }}>
                    {new Date().toLocaleDateString('id-ID',
                      { day:'numeric', month:'short', year:'numeric',
                        hour:'2-digit', minute:'2-digit' })}
                  </Text>
                </View>
              </View>

              {/* Tombol share — gambar = premium, teks = gratis */}
              <TouchableOpacity onPress={handleShareExecute}
                disabled={sharePreview.txns.length === 0}
                style={[btnStyle(sharePreview.txns.length > 0 ? C.primary : C.input),
                  sharePreview.txns.length === 0 && { opacity:0.4 }]}>
                <Text style={{ color: sharePreview.txns.length > 0 ? '#fff' : C.muted,
                  fontSize:16, fontWeight:'800' }}>
                  {hasShareKartu ? t('share_image_btn') : t('share_text_btn')}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {showShareDatePicker && (
              <DateTimePicker
                value={new Date(shareDay+'T12:00:00')}
                mode="date"
                display={Platform.OS==='android'?'calendar':'default'}
                onChange={(event, selectedDate) => {
                  setShowShareDatePicker(false);
                  if (selectedDate) {
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth()+1).padStart(2,'0');
                    const d = String(selectedDate.getDate()).padStart(2,'0');
                    setShareDay(`${y}-${m}-${d}`);
                  }
                }}
              />
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
export default DashboardScreen;
