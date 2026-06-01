import React, { useState, useRef, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { ThemeContext, getStyles, btnStyle } from '../theme';
import { padNum } from '../utils';

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

export default SetupWizard;
