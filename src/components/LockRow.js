import React, { useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemeContext } from '../theme';

export function LockRow({ hiddenCount, label = 'item', onUnlock }) {
  const C = useContext(ThemeContext);
  if (!hiddenCount || hiddenCount <= 0) return null;

  return (
    <TouchableOpacity
      onPress={onUnlock}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.card, borderRadius: 12,
        borderWidth: 1, borderColor: C.border,
        borderStyle: 'dashed', padding: 14, marginTop: 6, gap: 8,
      }}>
      <Text style={{ fontSize: 16 }}>🔒</Text>
      <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>
        +{hiddenCount} {label} tersembunyi — Tap untuk unlock
      </Text>
    </TouchableOpacity>
  );
}
