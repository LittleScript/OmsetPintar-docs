/**
 * PaywallOverlay — kartu gelap menutupi konten yang terkunci
 * Konten asli tetap dirender di belakang (opacity rendah)
 * Tap mana saja → buka PaywallSheet
 */
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemeContext } from '../theme';
import { fmtPrice, PRODUCTS, PAYWALL_MAP } from '../premium';

export function PaywallOverlay({
  children,       // konten yang dikunci (chart, list, dll)
  locked,         // boolean — kalau false, render children normal
  featureKey,     // key dari PAYWALL_MAP, misal 'hari_tersibuk'
  title,          // override title jika perlu
  subtitle,       // deskripsi singkat fitur
  onUnlock,       // callback tap → buka PaywallSheet
  minHeight = 160,
}) {
  if (!locked) return <>{children}</>;

  const map = PAYWALL_MAP[featureKey] || {};
  const displayTitle = title || map.title || 'Unlock Fitur Premium';

  // Harga produk pertama yang relevan (untuk price preview)
  const firstProductId = map.products?.[0];
  const firstProduct   = firstProductId ? PRODUCTS[firstProductId] : null;
  const priceHint      = firstProduct ? `Mulai ${fmtPrice(firstProduct.price)}` : null;

  return (
    <View style={{ position: 'relative', minHeight }}>
      {/* Konten asli — tetap dirender tapi sangat transparan (user "lihat" ada data) */}
      <View style={{ opacity: 0.12 }} pointerEvents="none">
        {children}
      </View>

      {/* Overlay gelap menutupi */}
      <TouchableOpacity
        onPress={onUnlock}
        activeOpacity={0.85}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 16,
          backgroundColor: 'rgba(7,16,24,0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>

        {/* Gembok */}
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🔒</Text>

        {/* Judul */}
        <Text style={{
          color: '#fff', fontSize: 16, fontWeight: '800',
          textAlign: 'center', marginBottom: 6,
        }}>
          {displayTitle}
        </Text>

        {/* Subtitle */}
        {subtitle ? (
          <Text style={{
            color: 'rgba(255,255,255,0.55)', fontSize: 12,
            textAlign: 'center', marginBottom: 14, lineHeight: 18,
          }}>
            {subtitle}
          </Text>
        ) : null}

        {/* Tombol unlock */}
        <View style={{
          backgroundColor: '#2563eb', borderRadius: 12,
          paddingHorizontal: 22, paddingVertical: 10,
        }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
            Buka Sekarang {priceHint ? `— ${priceHint}` : '→'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
