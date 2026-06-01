import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemeContext, getStyles, SalesChip, chipStyle } from '../theme';
import { COLORS } from '../constants';
import { todayStr, fmtDate, genBon, parseBon, getNorm, getAutocomplete } from '../utils';

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
    try {
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
      setTimeout(() => setJustSaved(false), 1500);
      setTimeout(() => customerRef.current?.focus(), 150);
    } finally {
      setSaving(false); // selalu reset — bahkan jika onSave() throw error
    }
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
    // Cek duplikat: bon number + pelanggan + nominal identik (tanpa cek tanggal)
    const norm = getNorm(customer.trim());
    const duplicate = transactions.find(t =>
      !t.deletedAt &&
      t.bonNumber === bonNo &&
      getNorm(t.customerName) === norm &&
      t.amount === cleanAmt
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
export default InputScreen;
