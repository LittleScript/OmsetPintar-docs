import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

// Widget OmsetKu — menampilkan omset hari ini di home screen Android
// Data diperbarui setiap kali user menyimpan transaksi di app
export function OmsetKuWidget({
  todayTotal  = 0,
  todayCount  = 0,
  companyName = 'OmsetKu',
  salesLines  = '',   // "ANDI: 3.2Jt  BUDI: 2.1Jt"
  lastUpdated = '',
}) {
  const toIdrShort = (n) => {
    if (n >= 1e9) return (n/1e9).toFixed(1) + 'M';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'Jt';
    if (n >= 1e3) return (n/1e3).toFixed(0) + 'K';
    return String(n);
  };

  const totalStr = 'Rp ' + todayTotal.toLocaleString('id-ID');

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width:  'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#0f1720',
        borderRadius: 20,
        padding: 16,
      }}>
      {/* Header */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget
          text="◉ OMSETKU"
          style={{ color: '#2563eb', fontSize: 10, fontWeight: '700' }}
        />
        <TextWidget
          text={companyName}
          style={{ color: '#475569', fontSize: 9 }}
        />
      </FlexWidget>

      {/* Label */}
      <TextWidget
        text="Omset Hari Ini"
        style={{ color: '#64748b', fontSize: 11, marginTop: 8 }}
      />

      {/* Total besar */}
      <TextWidget
        text={totalStr}
        style={{ color: '#F57F17', fontSize: 20, fontWeight: '800', marginTop: 4 }}
      />

      {/* Jumlah bon */}
      <TextWidget
        text={todayCount + ' transaksi'}
        style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}
      />

      {/* Per-sales breakdown */}
      {salesLines ? (
        <TextWidget
          text={salesLines}
          style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}
        />
      ) : null}

      {/* Last updated */}
      {lastUpdated ? (
        <TextWidget
          text={'⏱ ' + lastUpdated}
          style={{ color: '#334155', fontSize: 9, marginTop: 4 }}
        />
      ) : null}
    </FlexWidget>
  );
}
