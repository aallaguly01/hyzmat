/**
 * Dev/E2E-мок Telegram.WebApp для запуска вне Telegram (VITE_MOCK_TELEGRAM=true).
 * initData подписывается VITE_DEV_BOT_TOKEN — тем же токеном должен быть запущен API.
 * В продакшен-сборку не попадает: импортируется динамически только при включённом флаге.
 */
import type { BackButtonApi, BottomButton, TelegramWebApp, TelegramWebAppUser } from './types';

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}

async function signInitData(user: TelegramWebAppUser, botToken: string): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'dev',
    user: JSON.stringify(user),
  });
  const dcs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const hash = await hmac(secret, dcs);
  params.set(
    'hash',
    [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  );
  return params.toString();
}

function createDomButton(id: string, label: string, style: Partial<CSSStyleDeclaration>) {
  const el = document.createElement('button');
  el.id = id;
  el.type = 'button';
  el.textContent = label;
  Object.assign(el.style, { position: 'fixed', zIndex: '1000', display: 'none', ...style });
  document.body.appendChild(el);
  const handlers = new Set<() => void>();
  el.addEventListener('click', () => {
    if (!el.disabled) handlers.forEach((h) => h());
  });
  return { el, handlers };
}

function mainButton(): BottomButton {
  const { el, handlers } = createDomButton('mock-main-button', '', {
    left: '0',
    right: '0',
    bottom: '0',
    height: '56px',
    border: '0',
    background: 'var(--c-accent)',
    color: 'var(--c-accent-text)',
    fontWeight: '600',
  });
  const btn: BottomButton = {
    text: '',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    setText: (t) => ((btn.text = t), (el.textContent = t), btn),
    show: () => ((btn.isVisible = true), (el.style.display = 'block'), btn),
    hide: () => ((btn.isVisible = false), (el.style.display = 'none'), btn),
    enable: () => ((btn.isActive = true), (el.disabled = false), (el.style.opacity = '1'), btn),
    disable: () => ((btn.isActive = false), (el.disabled = true), (el.style.opacity = '0.5'), btn),
    showProgress: () => ((btn.isProgressVisible = true), (el.textContent = '…'), btn),
    hideProgress: () => ((btn.isProgressVisible = false), (el.textContent = btn.text), btn),
    setParams: () => btn,
    onClick: (cb) => (handlers.add(cb), btn),
    offClick: (cb) => (handlers.delete(cb), btn),
  };
  return btn;
}

function backButton(): BackButtonApi {
  const { el, handlers } = createDomButton('mock-back-button', '‹ Назад', {
    top: '8px',
    right: '8px',
    padding: '4px 10px',
  });
  const btn: BackButtonApi = {
    isVisible: false,
    show: () => ((btn.isVisible = true), (el.style.display = 'block'), btn),
    hide: () => ((btn.isVisible = false), (el.style.display = 'none'), btn),
    onClick: (cb) => (handlers.add(cb), btn),
    offClick: (cb) => (handlers.delete(cb), btn),
  };
  return btn;
}

export async function installMockTelegram(): Promise<void> {
  const env = import.meta.env;
  const user: TelegramWebAppUser = {
    id: Number(new URLSearchParams(location.search).get('uid') ?? env.VITE_MOCK_USER_ID ?? 777),
    first_name: env.VITE_MOCK_FIRST_NAME ?? 'Dev',
    username: env.VITE_MOCK_USERNAME || undefined,
  };
  const initData = await signInitData(user, env.VITE_DEV_BOT_TOKEN ?? '123456:DEV-TOKEN');
  const noop = () => {};

  const wa: TelegramWebApp = {
    initData,
    initDataUnsafe: { user },
    version: '8.0',
    colorScheme: 'light',
    themeParams: {},
    MainButton: mainButton(),
    BackButton: backButton(),
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    ready: noop,
    expand: noop,
    isVersionAtLeast: () => true,
    setHeaderColor: noop,
    setBackgroundColor: noop,
    disableVerticalSwipes: noop,
    enableVerticalSwipes: noop,
    openLink: (url) => void window.open(url, '_blank'),
    openTelegramLink: (url) => void window.open(url, '_blank'),
    showAlert: (m, cb) => (window.alert(m), cb?.()),
    showConfirm: (m, cb) => cb?.(window.confirm(m)),
    onEvent: noop,
    offEvent: noop,
  };
  window.Telegram = { WebApp: wa };
}
