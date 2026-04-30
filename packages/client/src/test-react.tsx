import { createRoot } from 'react-dom/client';

function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>React Test App</h1>
      <p>If you can see this, React is working!</p>
      <p>Current time: {new Date().toLocaleString()}</p>
      <button onClick={() => alert('Button clicked!')}>
        Click me
      </button>
    </div>
  );
}

// Simple test without routing
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<TestApp />);
} else {
  console.error('Root element not found!');
}