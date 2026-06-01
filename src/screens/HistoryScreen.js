import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, Alert, Platform, ScrollView, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { ThemeContext, getStyles, SalesChip, chipStyle, btnStyle } from '../theme';
import { COLORS } from '../constants';
import { toIdr, fmtDate, genBon } from '../utils';
import { getDb, loadTransactionsPaged, countTransactionsPaged } from '../db';

// refreshSignal naik setiap kali App.js memanggil reloadData — trigger reload History
function HistoryScreen({ data, onDelete, onEdit, onRestore, refreshSignal }) {
  const C = useContext(ThemeContext);
  const st = getStyles(C);

  const { salesList, dateFormat } = data;
  const [search, setSearch]   = useState('');
  const [salesF, setSalesF]   = useState('ALL');
  const [editTx, setEditTx]   = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLogTx, setEditLogTx] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // ── DB Pagination state ───────────────────────────────────────────────────
  const PAGE_SIZE = 30;
  const [dbItems,   setDbItems]   = useState([]);
  const [dbTotal,   setDbTotal]   = useState(0);
  const [dbPage,    setDbPage]    = useState(1);
  const [dbLoading, setDbLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (page, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setDbLoading(true);
    try {
      const db   = await getDb();
      const rows = await loadTransactionsPaged(db, { page, pageSize: PAGE_SIZE, salesFilter: salesF, search });
      if (reset) {
        setDbItems(rows);
        const cnt = await countTransactionsPaged(db, { salesFilter: salesF, search });
        setDbTotal(cnt);
        setDbPage(1);
      } else {
        setDbItems(prev => [...prev, ...rows]);
        setDbPage(page);
      }
    } finally {
      setDbLoading(false);
      loadingRef.current = false;
    }
  }, [salesF, search]);

  // Reload dari halaman 1 saat filter/search berubah ATAU data berubah (refreshSignal)
  useEffect(() => { loadPage(1, true); }, [search, salesF, refreshSignal, loadPage]);

  const handleLoadMore = () => {
    const nextPage = dbPage + 1;
    if (!dbLoading && dbItems.length < dbTotal) loadPage(nextPage, false);
  };

  // displayedHistory = dbItems (sudah dari DB, langsung render)
  const displayedHistory = dbItems;
  const filtered = dbItems; // alias untuk kompatibilitas kode di bawah

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
                <Text style={{ color:C.muted, fontSize:16 }}>✕</Text>
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
            {dbTotal} bon
          </Text>
        </ScrollView>
      </View>

      <FlatList data={displayedHistory} renderItem={renderItem} keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding:14, paddingBottom:110 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          dbLoading ? (
            <View style={{ alignItems:'center', paddingVertical:16 }}>
              <ActivityIndicator color={C.primary} />
              <Text style={{ color:C.muted, fontSize:11, marginTop:6 }}>
                {dbItems.length}/{dbTotal} bon
              </Text>
            </View>
          ) : dbItems.length < dbTotal ? null
          : dbTotal > PAGE_SIZE ? (
            <Text style={{ color:C.muted, fontSize:11, textAlign:'center', paddingVertical:12 }}>
              Semua {dbTotal} bon ditampilkan
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
                  ['Tanggal', fmtDate(editLogTx.originalValues.date, dateFormat)],
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
                  ['Tanggal', fmtDate(editLogTx.date, dateFormat)],
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
export default HistoryScreen;
