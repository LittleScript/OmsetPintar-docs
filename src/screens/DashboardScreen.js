import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, StatusBar, Share, Dimensions } from 'react-native';
import * as Sharing from 'expo-sharing';
import { ThemeContext, getStyles, SalesChip, btnStyle, KpiCard } from '../theme';
import { COLORS, MONTHS, MONTHS_F } from '../constants';
import { toIdr, toShort, todayStr, fmtDate, getWeekBounds } from '../utils';
import { PurchasesContext } from '../contexts';
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

function DashboardScreen({ data, onYearChange }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { purchases, openPaywall } = useContext(PurchasesContext);
  const hasDashPct   = can.dashboardPct(purchases);
  const hasHariTsb   = can.hariTersibuk(purchases);
  const hasChartFull = can.chartFull(purchases);
  const hasShareKartu = can.shareKartu(purchases);

  const { salesList, transactions, activeYear, dateFormat } = data;
  const [busyMonthFilter,  setBusyMonthFilter]  = useState(0);
  const [showShareModal,   setShowShareModal]    = useState(false);
  const [shareType,        setShareType]         = useState('hari');
  const [shareDay,         setShareDay]          = useState(() => todayStr());
  const [shareWeekRef,     setShareWeekRef]      = useState(() => todayStr());
  const [shareMonthY,      setShareMonthY]       = useState(() => new Date().getFullYear());
  const [shareMonthM,      setShareMonthM]       = useState(() => new Date().getMonth()+1);
  const [shareYearVal,     setShareYearVal]      = useState(activeYear);
  const [showShareDatePicker, setShowShareDatePicker] = useState(false);
  const rekapCardRef = useRef(null);

  const DAY_NAMES_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

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
          mimeType:'image/png', dialogTitle:'Bagikan Rekap OmsetKu'
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
    lines.push('_via OmsetKu_');
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
            onPress={() => setShowShareModal(true)}
            style={{ backgroundColor:C.primary+'22', borderRadius:8, paddingHorizontal:10, paddingVertical:5,
              borderWidth:1, borderColor:C.primary+'44' }}>
            <Text style={{ color:C.primary, fontSize:12, fontWeight:'700' }}>📤 Share Rekap</Text>
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
              <Text style={{ color:C.muted, fontSize:9 }}>vs kemarin</Text>
            )}
          </View>
          <View style={{ alignItems:'flex-end' }}>
            <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase' }}>MINGGU INI</Text>
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
              <Text style={{ color:C.muted, fontSize:9 }}>vs minggu lalu</Text>
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

      {/* Hari Tersibuk — FREE: blur overlay */}
      {yearTotal > 0 && (
        <View style={st.card}>
          <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:8 }}>
            HARI TERSIBUK — {busyMonthFilter === 0 ? `ALL ${activeYear}` : `${MONTHS_F[busyMonthFilter-1]} ${activeYear}`}
          </Text>
          <PaywallOverlay
            locked={!hasHariTsb}
            featureKey="hari_tersibuk"
            subtitle="Lihat hari paling ramai toko Anda sepanjang tahun"
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
              <Text style={{ color:C.text, fontSize:17, fontWeight:'800' }}>📤 Bagikan Rekap</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}
                style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
                <Text style={{ color:C.muted }}>✕ Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
              {/* Tab selector */}
              <View style={{ flexDirection:'row', gap:6, marginBottom:16 }}>
                {[['hari','Hari'],['minggu','Minggu'],['bulan','Bulan'],['tahun','Tahun']].map(([v,l]) => (
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
                    <Text style={{ color:C.muted, fontSize:10, marginTop:3 }}>tap untuk pilih tanggal</Text>
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
                    <Text style={{ color:C.muted, fontSize:11, marginVertical:2 }}>sampai</Text>
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

              {/* Kartu Rekap — preview sekaligus yang akan di-capture & share */}
              <View ref={rekapCardRef} collapsable={false}
                style={{ backgroundColor:'#1E3A5F', borderRadius:16, padding:20,
                  marginBottom:16, overflow:'hidden' }}>
                {/* Header kartu */}
                <View style={{ flexDirection:'row', justifyContent:'space-between',
                  alignItems:'center', marginBottom:14 }}>
                  <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:10,
                    fontWeight:'800', letterSpacing:2 }}>◉ OMSETKU</Text>
                  <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:10 }}>
                    {data.companyName || 'Toko'}
                  </Text>
                </View>
                {/* Judul periode */}
                <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:9,
                  letterSpacing:1.5, textTransform:'uppercase', marginBottom:2 }}>
                  {sharePreview.header}
                </Text>
                {sharePreview.sub ? (
                  <Text style={{ color:'rgba(255,255,255,0.9)', fontSize:12,
                    fontWeight:'700', marginBottom:14 }}>
                    {sharePreview.sub}
                  </Text>
                ) : <View style={{ marginBottom:10 }} />}
                {/* Garis */}
                <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.1)', marginBottom:14 }} />
                {/* Total besar */}
                <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:9,
                  textAlign:'center', letterSpacing:1.5, textTransform:'uppercase' }}>
                  TOTAL OMSET
                </Text>
                {sharePreview.txns.length > 0 ? (
                  <>
                    <Text style={{ color:'#F59E0B', fontSize:26, fontWeight:'800',
                      textAlign:'center', marginTop:4,
                      fontFamily: Platform.OS==='ios'?'Courier New':'monospace' }}>
                      {toIdr(sharePreview.total)}
                    </Text>
                    <Text style={{ color:'rgba(255,255,255,0.4)', fontSize:11,
                      textAlign:'center', marginTop:4, marginBottom:14 }}>
                      {sharePreview.txns.length} transaksi
                    </Text>
                    {/* Garis */}
                    <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.1)', marginBottom:12 }} />
                    {/* Per sales */}
                    {salesList.map((s,i) => {
                      const sTx = sharePreview.txns.filter(t => t.sales === s);
                      if (!sTx.length) return null;
                      return (
                        <View key={s} style={{ flexDirection:'row', justifyContent:'space-between',
                          alignItems:'center', marginBottom:7 }}>
                          <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
                            <View style={{ width:6, height:6, borderRadius:3,
                              backgroundColor: COLORS[i%COLORS.length] }} />
                            <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{s}</Text>
                          </View>
                          <View style={{ alignItems:'flex-end' }}>
                            <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>
                              {toIdr(sTx.reduce((a,t)=>a+t.amount,0))}
                            </Text>
                            <Text style={{ color:'rgba(255,255,255,0.35)', fontSize:9 }}>
                              {sTx.length} bon
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <Text style={{ color:'rgba(255,255,255,0.3)', fontSize:12,
                    textAlign:'center', marginVertical:16, fontStyle:'italic' }}>
                    Tidak ada transaksi
                  </Text>
                )}
                {/* Footer */}
                <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.07)',
                  marginTop:10, marginBottom:10 }} />
                <Text style={{ color:'rgba(255,255,255,0.25)', fontSize:9, textAlign:'center' }}>
                  via OmsetKu  ·  {new Date().toLocaleDateString('id-ID',
                    { day:'numeric', month:'short', year:'numeric',
                      hour:'2-digit', minute:'2-digit' })}
                </Text>
              </View>

              {/* Tombol share — gambar = premium, teks = gratis */}
              <TouchableOpacity onPress={handleShareExecute}
                disabled={sharePreview.txns.length === 0}
                style={[btnStyle(sharePreview.txns.length > 0 ? C.primary : C.input),
                  sharePreview.txns.length === 0 && { opacity:0.4 }]}>
                <Text style={{ color: sharePreview.txns.length > 0 ? '#fff' : C.muted,
                  fontSize:16, fontWeight:'800' }}>
                  {hasShareKartu ? '📤  Bagikan sebagai Gambar' : '📤  Bagikan (Teks)  🔒 Gambar'}
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
