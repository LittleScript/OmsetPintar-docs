import React, { createContext, useContext } from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import { DARK_THEME } from './constants';

// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
export const ThemeContext = createContext(DARK_THEME);

// Dynamic style object — buat ulang setiap kali tema berubah
export const getStyles = (C) => ({
  flex1:     { flex: 1 },
  container: { flex:1, backgroundColor:C.bg },
  scroll:    { paddingHorizontal:14, paddingTop:12, paddingBottom:110 },
  card:      { backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:C.border, padding:16, marginBottom:12 },
  input:     { backgroundColor:C.input, borderWidth:1.5, borderColor:C.border, borderRadius:12, padding:14, color:C.text, fontSize:16 },
  label:     { color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  mono:      { fontFamily: Platform.OS==='ios' ? 'Courier New' : 'monospace' },
  row:       { flexDirection:'row', alignItems:'center' },
  sep:       { height:1, backgroundColor:C.border, marginVertical:8 },
});

// Style helpers
export const btnStyle = (bg) => ({
  backgroundColor: bg, borderRadius: 16,
  paddingVertical: 16, alignItems: 'center',
  justifyContent: 'center', width: '100%',
});

export const chipStyle = (active, color, C) => ({
  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
  backgroundColor: active ? (color || C.primary) : C.input,
  marginRight: 8,
});

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
export const SalesChip = ({ name, active, color, onPress }) => {
  const C = useContext(ThemeContext);
  return (
    <TouchableOpacity onPress={onPress} style={chipStyle(active, color, C)}>
      <Text style={{ color: active ? '#fff' : C.muted, fontSize:14, fontWeight:'700' }}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

export const KpiCard = ({ label, value, sub, color, style }) => {
  const C  = useContext(ThemeContext);
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
