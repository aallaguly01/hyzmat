/** Минимальный тип Telegram.WebApp — только то, что использует приложение. */
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface BottomButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText(text: string): BottomButton;
  show(): BottomButton;
  hide(): BottomButton;
  enable(): BottomButton;
  disable(): BottomButton;
  showProgress(leaveActive?: boolean): BottomButton;
  hideProgress(): BottomButton;
  setParams(params: { color?: string; text_color?: string }): BottomButton;
  onClick(cb: () => void): BottomButton;
  offClick(cb: () => void): BottomButton;
}

export interface BackButtonApi {
  isVisible: boolean;
  show(): BackButtonApi;
  hide(): BackButtonApi;
  onClick(cb: () => void): BackButtonApi;
  offClick(cb: () => void): BackButtonApi;
}

export interface TelegramWebApp {
  initData: string;
  /** start_param — из ссылки t.me/<бот>?startapp=<param> */
  initDataUnsafe: { user?: TelegramWebAppUser; start_param?: string };
  version: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  MainButton: BottomButton;
  BackButton: BackButtonApi;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  /** Bot API 6.9+: разрешение боту писать пользователю (нужно для уведомлений). */
  requestWriteAccess?(cb?: (granted: boolean) => void): void;
  onEvent(event: 'themeChanged', cb: () => void): void;
  offEvent(event: 'themeChanged', cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
