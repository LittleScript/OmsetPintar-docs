/**
 * Shared contexts — diimport oleh App.js dan semua screens
 * Menghindari circular import (App → screens → App)
 */
import { createContext } from 'react';
import { makeT } from './i18n';

export const PurchasesContext = createContext({
  purchases:    {},
  openPaywall: () => {},
});

// LanguageContext — provides t() function untuk semua komponen
export const LanguageContext = createContext({
  lang: 'id',
  t:    makeT('id'),
  setLang: () => {},
});
