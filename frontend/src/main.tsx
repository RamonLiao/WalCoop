import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dAppKit } from './dapp-kit';
import { RoleProvider } from './state/RoleContext';
import { ToastProvider } from './state/ToastContext';
import App from './App';
import './styles/global.css';

// Tatum's free gateway rate-limits (HTTP 429). Tame request volume: cache reads,
// don't refetch on focus, and back off instead of hammering on failure.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

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
