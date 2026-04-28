import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

console.log('Starting application...');

try {
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);

  if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<h1>Error: Root element not found!</h1>';
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log('App rendered successfully!');
  }
} catch (error) {
  console.error('Error rendering app:', error);
  document.body.innerHTML = `<h1>Error: ${error.message}</h1><pre>${error.stack}</pre>`;
}