import React, { useState, useMemo, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, Alert, Platform, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { ThemeContext, getStyles } from '../theme';
import { COLORS } from '../constants';
import { toIdr, toShort, fmtDate, getNorm, findSimilarNames } from '../utils';

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

function CustomersScreen({ data, onMerge, onIgnoreTypo }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);
  const { salesList, transactions, dateFormat } = data;
  const [salesF, setSalesF]       = useState('ALL');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('nama');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [typoPairs,   setTypoPairs]   = useState([]);
  const [showTypo,    setShowTypo]    = useState(false);
  const [typoLoading, setTypoLoading] = useState(false);
  const [dismissedPairs, setDismissedPairs] = useState(new Set());

  const handleTypoCheck = () => {
    setTypoLoading(true);
    // setTimeout agar React sempat re-render "Mengecek..." sebelum komputasi dimulai
    setTimeout(() => {
      const ignored = data.ignoredTypoPairs || new Set();
      const allPairs = findSimilarNames(transactions);
      // Filter pasangan yang sudah pernah di-abaikan (persisten lintas sesi)
      const pairs = allPairs.filter(p => {
        const [a, b] = [getNorm(p.nameA), getNorm(p.nameB)].sort();
        return !ignored.has(`${p.sales}|||${a}|||${b}`);
      });
      setTypoPairs(pairs);
      setDismissedPairs(new Set());
      setTypoLoading(false);
      setShowTypo(true);
    }, 80);
  };

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
        {/* Tombol cek typo */}
        <TouchableOpacity onPress={handleTypoCheck}
          style={{ flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start',
            backgroundColor:C.warning+'22', borderRadius:8, paddingHorizontal:10, paddingVertical:5, marginBottom:4 }}>
          <Text style={{ color:C.warning, fontSize:11, fontWeight:'700' }}>
            {typoLoading ? 'Mengecek...' : '🔍 Cek Typo Nama'}
          </Text>
        </TouchableOpacity>
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

      {/* Typo Detection Modal */}
      {showTypo && (
        <Modal visible animationType="slide" onRequestClose={() => setShowTypo(false)}>
          <View style={[st.container, { paddingTop: Platform.OS==='ios'?44:StatusBar.currentHeight||0 }]}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
              paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.text, fontSize:17, fontWeight:'800' }}>🔍 Cek Typo Nama</Text>
              <TouchableOpacity onPress={() => setShowTypo(false)}
                style={{ backgroundColor:C.input, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
                <Text style={{ color:C.muted }}>✕ Tutup</Text>
              </TouchableOpacity>
            </View>

            {(() => {
              // Hitung sekali saja untuk menghindari double-filter
              const visiblePairs = typoPairs.filter(
                p => !dismissedPairs.has(`${p.nameA}|||${p.nameB}`)
              );
              if (visiblePairs.length === 0) return (
                <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:48, marginBottom:16 }}>✅</Text>
                  <Text style={{ color:C.text, fontSize:16, fontWeight:'700' }}>Tidak ada typo terdeteksi</Text>
                  <Text style={{ color:C.muted, fontSize:13, marginTop:8, textAlign:'center', paddingHorizontal:32 }}>
                    Semua nama pelanggan tampak unik dan berbeda
                  </Text>
                </View>
              );
              return (
              <FlatList
                data={visiblePairs}
                keyExtractor={(_, idx) => String(idx)}
                contentContainerStyle={{ padding:16, paddingBottom:40 }}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <Text style={{ color:C.muted, fontSize:12, marginBottom:16 }}>
                    Ditemukan {visiblePairs.length} pasangan nama yang mungkin sama.
                    Pilih nama yang benar untuk mengganti semua transaksi.
                  </Text>
                }
                renderItem={({ item: pair }) => {
                    const salesColor = COLORS[salesList.indexOf(pair.sales) % COLORS.length] || C.primary;
                    return (
                      <View key={idx} style={[st.card, { marginBottom:12 }]}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:12 }}>
                          <View style={{ width:8, height:8, borderRadius:4, backgroundColor:salesColor }} />
                          <Text style={{ color:salesColor, fontSize:11, fontWeight:'700' }}>{pair.sales}</Text>
                          <Text style={{ color:C.muted, fontSize:10 }}>• {pair.reason}</Text>
                        </View>
                        <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                          {/* Nama A */}
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Ganti ke nama ini?',
                                `Semua "${pair.nameB}" (${pair.countB} bon) akan diganti menjadi "${pair.nameA}"`,
                                [
                                  { text:'Batal', style:'cancel' },
                                  { text:'Ya, Ganti', onPress: async () => {
                                    await onMerge(pair.nameB, pair.nameA, pair.sales);
                                    setDismissedPairs(prev => new Set([...prev, `${pair.nameA}|||${pair.nameB}`]));
                                  }},
                                ]
                              );
                            }}
                            style={{ flex:1, backgroundColor:C.primary+'22', borderWidth:1.5,
                              borderColor:C.primary, borderRadius:12, padding:12, alignItems:'center' }}>
                            <Text style={{ color:C.primary, fontSize:15, fontWeight:'800' }}>{pair.nameA}</Text>
                            <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{pair.countA} bon</Text>
                            <Text style={{ color:C.primary, fontSize:10, marginTop:4, fontWeight:'700' }}>Pakai ini ✓</Text>
                          </TouchableOpacity>
                          <View style={{ alignItems:'center', justifyContent:'center', paddingHorizontal:4 }}>
                            <Text style={{ color:C.muted, fontSize:18 }}>↔</Text>
                          </View>
                          {/* Nama B */}
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Ganti ke nama ini?',
                                `Semua "${pair.nameA}" (${pair.countA} bon) akan diganti menjadi "${pair.nameB}"`,
                                [
                                  { text:'Batal', style:'cancel' },
                                  { text:'Ya, Ganti', onPress: async () => {
                                    await onMerge(pair.nameA, pair.nameB, pair.sales);
                                    setDismissedPairs(prev => new Set([...prev, `${pair.nameA}|||${pair.nameB}`]));
                                  }},
                                ]
                              );
                            }}
                            style={{ flex:1, backgroundColor:C.accent+'22', borderWidth:1.5,
                              borderColor:C.accent, borderRadius:12, padding:12, alignItems:'center' }}>
                            <Text style={{ color:C.accent, fontSize:15, fontWeight:'800' }}>{pair.nameB}</Text>
                            <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{pair.countB} bon</Text>
                            <Text style={{ color:C.accent, fontSize:10, marginTop:4, fontWeight:'700' }}>Pakai ini ✓</Text>
                          </TouchableOpacity>
                        </View>
                        {/* Abaikan — disimpan ke DB, tidak muncul lagi di sesi berikutnya */}
                        <TouchableOpacity
                          onPress={async () => {
                            // Sembunyikan langsung di sesi ini
                            setDismissedPairs(prev => new Set([...prev, `${pair.nameA}|||${pair.nameB}`]));
                            // Simpan ke DB agar tidak muncul lagi saat Cek Typo berikutnya
                            const [a, b] = [getNorm(pair.nameA), getNorm(pair.nameB)].sort();
                            await onIgnoreTypo(pair.sales, a, b);
                          }}
                          style={{ backgroundColor:C.input, borderRadius:8, paddingVertical:8, alignItems:'center' }}>
                          <Text style={{ color:C.muted, fontSize:12 }}>Bukan typo — Abaikan</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
              />
              );
            })()}
          </View>
        </Modal>
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


export { getCustomerList };
export default CustomersScreen;
