import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { FeedPage } from '../features/feed/FeedPage';
import { MyListingsPage } from '../features/my-listings/MyListingsPage';
import { useTelegramInit } from '../shared/telegram/hooks';
import { getWebApp } from '../shared/telegram/webapp';
import { BottomTabs } from '../shared/ui/BottomTabs';
import ui from '../shared/ui/ui.module.css';
import { FeedFilterProvider } from './FeedFilter';
import { createQueryClient } from './queryClient';
import { useStartParam } from './useStartParam';

const CreateListingPage = lazy(() =>
  import('../features/listing-form/ListingFormPage').then((m) => ({
    default: m.CreateListingPage,
  })),
);
const EditListingPage = lazy(() =>
  import('../features/listing-form/ListingFormPage').then((m) => ({ default: m.EditListingPage })),
);

function OpenInTelegram() {
  const bot = import.meta.env.VITE_BOT_USERNAME as string | undefined;
  return (
    <div className={ui.center}>
      <h1 className={ui.title}>Откройте приложение в Telegram</h1>
      <p>Это мини-приложение работает только внутри Telegram.</p>
      {bot && (
        <a className={ui.button} href={`https://t.me/${bot}`}>
          Открыть @{bot}
        </a>
      )}
    </div>
  );
}

function TelegramGate({ children }: { children: ReactNode }) {
  useTelegramInit();
  if (!getWebApp()?.initData) return <OpenInTelegram />;
  return <>{children}</>;
}

function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomTabs />
    </>
  );
}

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TelegramGate>
        <FeedFilterProvider>{children}</FeedFilterProvider>
      </TelegramGate>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  useStartParam();
  return (
    <Suspense fallback={<div className={ui.spinner}>Загрузка…</div>}>
      <Routes>
        <Route element={<TabsLayout />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/my" element={<MyListingsPage />} />
        </Route>
        <Route path="/listings/new" element={<CreateListingPage />} />
        <Route path="/listings/:id/edit" element={<EditListingPage />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App({ queryClient = createQueryClient() }: { queryClient?: QueryClient }) {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders queryClient={queryClient}>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
