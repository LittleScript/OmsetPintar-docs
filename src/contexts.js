/**
 * Shared contexts — diimport oleh App.js dan semua screens
 * Menghindari circular import (App → screens → App)
 */
import { createContext } from 'react';

export const PurchasesContext = createContext({
  purchases:    {},
  openPaywall: () => {},
});
