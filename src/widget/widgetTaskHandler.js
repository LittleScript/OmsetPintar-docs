import React from 'react';
import { getDb } from '../db';
import { COLORS } from '../constants';
import { OmsetPintarWidget } from './OmsetPintarWidget';

// Handler ini dipanggil Android saat widget perlu di-render
// (WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED, WIDGET_DELETED, WIDGET_CLICK)
// Berjalan dalam headless JS context — akses DB langsung

async function widgetTaskHandler(props) {
  const { widgetAction, widgetInfo, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  try {
    const db = await getDb();

    // Hitung omset hari ini
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const row = await db.getFirstAsync(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE transaction_date=? AND deleted_at IS NULL`,
      [todayStr]
    );

    // Per-sales breakdown (maks 3 sales)
    const salesRows = await db.getAllAsync(
      `SELECT sales_name, COUNT(*) as cnt, SUM(amount) as total
       FROM transactions
       WHERE transaction_date=? AND deleted_at IS NULL
       GROUP BY sales_name
       ORDER BY total DESC
       LIMIT 3`,
      [todayStr]
    );

    const toShort = (n) => {
      if (n >= 1e6) return (n/1e6).toFixed(1) + 'Jt';
      if (n >= 1e3) return (n/1e3).toFixed(0) + 'K';
      return String(n);
    };
    const salesLines = salesRows.map(r => `${r.sales_name}: ${toShort(r.total)}`).join('  ');

    // Nama bisnis dari settings
    const settings = await db.getFirstAsync(
      'SELECT company_name FROM settings WHERE id=1'
    );

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    renderWidget(
      <OmsetPintarWidget
        todayTotal  = {row?.total  || 0}
        todayCount  = {row?.cnt    || 0}
        companyName = {settings?.company_name || 'Omset Pintar'}
        salesLines  = {salesLines}
        lastUpdated = {now}
      />
    );
  } catch(e) {
    // Fallback jika DB belum siap (install baru / app belum pernah dibuka)
    renderWidget(
      <OmsetPintarWidget
        todayTotal={0}
        todayCount={0}
        companyName="Omset Pintar"
        lastUpdated="Buka app untuk mulai"
      />
    );
  }
}

export { widgetTaskHandler };
