import React, { useState, useMemo, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ThemeContext, getStyles, SalesChip } from '../theme';
import { COLORS, MONTHS_F } from '../constants';
import { toIdr, toShort, todayStr, fmtDate, getWeekBounds, filterByPeriod, getRanking } from '../utils';
import { PurchasesContext } from '../../App';
import { can, FREE } from '../premium';
import { LockRow } from '../components/LockRow';

function RankingScreen({ data }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { purchases, openPaywall } = useContext(PurchasesContext);
  const hasRankingFull = can.rankingFull(purchases);
  const MAX_RANK = hasRankingFull ? Infinity : FREE.MAX_RANKING;

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
          {ranked.slice(0, MAX_RANK).map((r, i) => (
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
          {/* Lock row jika ada lebih dari MAX_RANK */}
          <LockRow
            hiddenCount={ranked.length > MAX_RANK ? ranked.length - MAX_RANK : 0}
            label="pelanggan"
            onUnlock={() => openPaywall('ranking_full')}
          />
        </>
      )}
    </ScrollView>
  );
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────
export default RankingScreen;
