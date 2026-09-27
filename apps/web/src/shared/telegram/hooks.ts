import { useEffect, useRef } from 'react';
import { getWebApp } from './webapp';

/** Инициализация WebApp: ready/expand, цвета заголовка и фона, реакция на смену темы. */
export function useTelegramInit(): void {
  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    const applyColors = () => {
      wa.setHeaderColor('bg_color');
      wa.setBackgroundColor('bg_color');
    };
    wa.ready();
    wa.expand();
    applyColors();
    wa.onEvent('themeChanged', applyColors);
    return () => wa.offEvent('themeChanged', applyColors);
  }, []);
}

export interface MainButtonOptions {
  text: string;
  visible: boolean;
  active: boolean;
  progress: boolean;
  onClick: () => void;
}

/** Декларативная обёртка над Telegram MainButton. При размонтировании кнопка скрывается. */
export function useMainButton({ text, visible, active, progress, onClick }: MainButtonOptions) {
  const handlerRef = useRef(onClick);
  handlerRef.current = onClick;

  useEffect(() => {
    const mb = getWebApp()?.MainButton;
    if (!mb) return;
    const handler = () => handlerRef.current();
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hideProgress();
      mb.hide();
    };
  }, []);

  useEffect(() => {
    const mb = getWebApp()?.MainButton;
    if (!mb) return;
    mb.setText(text);
    if (visible) mb.show();
    else mb.hide();
    if (active) mb.enable();
    else mb.disable();
    if (progress) mb.showProgress(false);
    else mb.hideProgress();
  }, [text, visible, active, progress]);
}

/** Telegram BackButton, видимая пока компонент смонтирован. */
export function useBackButton(onBack: () => void) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    const bb = getWebApp()?.BackButton;
    if (!bb) return;
    const handler = () => handlerRef.current();
    bb.onClick(handler);
    bb.show();
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, []);
}

/** Отключает свайп-закрытие мини-аппа (защита от потери введённых данных). */
export function useDisableVerticalSwipes() {
  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.isVersionAtLeast('7.7') || !wa.disableVerticalSwipes) return;
    wa.disableVerticalSwipes();
    return () => wa.enableVerticalSwipes?.();
  }, []);
}
