/**
 * PaywallSheet — bottom sheet upgrade dengan decoy pricing
 * Menampilkan produk relevan berdasarkan featureKey
 * + subscription sebagai alternatif di bawah
 */
import React, { useContext } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Platform,
} from 'react-native';
import { ThemeContext } from '../theme';
import { PRODUCTS, PAYWALL_MAP, PID, fmtPrice } from '../premium';

function ProductCard({ product, onBuy, highlight }) {
  const C = useContext(ThemeContext);
  const isSubscription = product.type === 'monthly' || product.type === 'yearly';

  return (
    <TouchableOpacity
      onPress={() => onBuy(product.id)}
      activeOpacity={0.8}
      style={{
        borderRadius: 14,
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? C.primary : C.border,
        backgroundColor: highlight ? C.primary + '18' : C.card,
        padding: 14, marginBottom: 10,
      }}>

      {/* Badge */}
      {product.badge ? (
        <View style={{
          alignSelf: 'flex-start',
          backgroundColor: highlight ? C.primary : C.warning + '33',
          borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
        }}>
          <Text style={{
            color: highlight ? '#fff' : C.warning,
            fontSize: 10, fontWeight: '800',
          }}>
            {product.badge}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 2 }}>
            {product.name}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>{product.tagline}</Text>

          {/* Fitur list */}
          <View style={{ marginTop: 8, gap: 3 }}>
            {product.features.map((f, i) => (
              <Text key={i} style={{ color: C.muted, fontSize: 11 }}>
                ✓ {f}
              </Text>
            ))}
          </View>

          {/* Note untuk Sales Pro / Ultimate */}
          {product.note ? (
            <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700', marginTop: 6 }}>
              {product.note}
            </Text>
          ) : null}

          {/* Savings */}
          {product.savings ? (
            <Text style={{ color: C.success, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
              Hemat {fmtPrice(product.savings)} vs beli satuan
            </Text>
          ) : null}
        </View>

        {/* Harga */}
        <View style={{ alignItems: 'flex-end' }}>
          {isSubscription && product.pricePerMonth ? (
            <>
              <Text style={{ color: C.accent, fontSize: 18, fontWeight: '800' }}>
                {fmtPrice(product.pricePerMonth)}
              </Text>
              <Text style={{ color: C.muted, fontSize: 10 }}>/ bulan</Text>
              <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>
                ({fmtPrice(product.price)}/thn)
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: C.accent, fontSize: 18, fontWeight: '800' }}>
                {fmtPrice(product.price)}
              </Text>
              <Text style={{ color: C.muted, fontSize: 10 }}>sekali bayar</Text>
            </>
          )}
        </View>
      </View>

      {/* Tombol beli di card yang di-highlight */}
      {highlight ? (
        <View style={{
          marginTop: 12, backgroundColor: C.primary,
          borderRadius: 10, padding: 10, alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
            Beli Sekarang →
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function PaywallSheet({ featureKey, visible, onClose, onBuy }) {
  const C = useContext(ThemeContext);
  if (!visible || !featureKey) return null;

  const map       = PAYWALL_MAP[featureKey] || {};
  const mainProds = (map.products || []).map(id => PRODUCTS[id]).filter(Boolean);
  const subProds  = [PRODUCTS[PID.MONTHLY_PLUS], PRODUCTS[PID.YEARLY_PLUS]];

  // Produk terakhir di mainProds biasanya adalah yang "target" (bundle/ultimate)
  const targetIdx = mainProds.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        activeOpacity={1}
        onPress={onClose}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={1}>
          <View style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: Platform.OS === 'ios' ? 36 : 24,
            maxHeight: '90%',
          }}>
            {/* Handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: C.border, alignSelf: 'center', marginTop: 12, marginBottom: 4,
            }} />

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Header */}
              <Text style={{ fontSize: 20, marginBottom: 4, textAlign: 'center' }}>🔓</Text>
              <Text style={{
                color: C.text, fontSize: 18, fontWeight: '800',
                textAlign: 'center', marginBottom: 4,
              }}>
                {map.title || 'Upgrade ke Premium'}
              </Text>
              <Text style={{
                color: C.muted, fontSize: 12,
                textAlign: 'center', marginBottom: 20,
              }}>
                Pilih paket yang paling sesuai kebutuhan Anda
              </Text>

              {/* Produk utama (specific + bundle) */}
              {mainProds.map((prod, idx) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onBuy={onBuy}
                  highlight={idx === targetIdx} // produk terakhir = target (decoy effect)
                />
              ))}

              {/* Divider subscription */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8,
              }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ color: C.muted, fontSize: 11 }}>atau berlangganan</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>

              {/* Subscription (Yearly di-highlight sebagai target) */}
              {subProds.map((prod, idx) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onBuy={onBuy}
                  highlight={idx === 1} // Yearly Plus = target
                />
              ))}

              {/* Restore purchases */}
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  Sudah beli sebelumnya? Restore pembelian
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
