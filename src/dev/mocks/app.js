// Modo de prueba: sustituye 'firebase/app' (ver vite.config.js).
export const initializeApp = (config) => ({ name: '[DEFAULT]', options: config || {} });
export const getApp = () => ({ name: '[DEFAULT]', options: {} });
