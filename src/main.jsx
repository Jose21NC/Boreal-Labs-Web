import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

const printBorealConsoleGreeting = () => {
  if (typeof window === 'undefined') return;

  console.log('%c██████   ██████  ██████  ███████  █████  ██', 'color:#69e6af; font-size:12px; font-weight:800;');
  console.log('%c██   ██ ██    ██ ██   ██ ██      ██   ██ ██', 'color:#69e6af; font-size:12px; font-weight:800;');
  console.log('%c██████  ██    ██ ██████  █████   ███████ ██', 'color:#69e6af; font-size:12px; font-weight:800;');
  console.log('%c██   ██ ██    ██ ██   ██ ██      ██   ██ ██', 'color:#69e6af; font-size:12px; font-weight:800;');
  console.log('%c██████   ██████  ██   ██ ███████ ██   ██ ███████', 'color:#69e6af; font-size:12px; font-weight:800;');
  console.log(
    '%cBienvenido a Boreal Labs%c\nJuventud que innova, crea y transforma.',
    'color:#69e6af; font-size:16px; font-weight:800;',
    'color:#d1d5db; font-size:12px; font-weight:500;'
  );
  console.log(
    '%cSi estas leyendo esto, te invitamos a postularte para formar parte de nuestro STAFF en el area de TI.%c\nEncuentra como hacerlo en la pagina de Equipo.',
    'color:#60a5fa; font-size:13px; font-weight:700;',
    'color:#d1d5db; font-size:12px; font-weight:500;'
  );
};

if (import.meta.env.DEV) {
  printBorealConsoleGreeting();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);