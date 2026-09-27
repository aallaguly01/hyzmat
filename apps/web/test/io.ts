import { vi } from 'vitest';

// jsdom не умеет IntersectionObserver — даём управляемую заглушку
type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
export const intersectionObservers: { cb: IOCallback; el?: Element }[] = [];

class MockIntersectionObserver {
  private entry: { cb: IOCallback; el?: Element };
  constructor(cb: IOCallback) {
    this.entry = { cb };
    intersectionObservers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.el = el;
  }
  unobserve() {}
  disconnect() {
    const i = intersectionObservers.indexOf(this.entry);
    if (i >= 0) intersectionObservers.splice(i, 1);
  }
  takeRecords() {
    return [];
  }
}

export function installIntersectionObserver() {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}
