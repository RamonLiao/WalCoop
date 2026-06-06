import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dAppKit } from './dapp-kit';
import { RoleProvider } from './state/RoleContext';
import { ToastProvider } from './state/ToastContext';
import App from './App';
import './styles/global.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RoleProvider>
            <App />
          </RoleProvider>
        </ToastProvider>
      </QueryClientProvider>
    </DAppKitProvider>
  </StrictMode>,
);
