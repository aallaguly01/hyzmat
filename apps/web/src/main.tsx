import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/ui/global.css';

async function bootstrap() {
  if (import.meta.env.VITE_MOCK_TELEGRAM === 'true') {
    const { installMockTelegram } = await import('./shared/telegram/mock');
    await installMockTelegram();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
