import { describe, expect, it } from 'vitest';
import { botConfig, loadConfig } from './config';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', BOT_TOKEN: '123:ABC' };
const KEY = 'k'.repeat(48);

describe('botConfig', () => {
  it('без ключа — выключен', () => {
    expect(botConfig(loadConfig({ ...base, BOT_API_KEY: '' })).disabled).toMatch(/BOT_API_KEY/);
  });

  it('ключ без username — выключен, но конфиг грузится', () => {
    const c = loadConfig({ ...base, BOT_API_KEY: KEY, BOT_USERNAME: '' });
    expect(botConfig(c)).toEqual({ disabled: expect.stringMatching(/BOT_USERNAME/) });
  });

  it('всё задано — включён', () => {
    const c = loadConfig({
      ...base,
      BOT_API_KEY: KEY,
      BOT_USERNAME: 'hyzmat_bot',
      WEBAPP_URL: 'https://x.me',
    });
    expect(botConfig(c)).toEqual({
      bot: { apiKey: KEY, botUsername: 'hyzmat_bot', webappUrl: 'https://x.me' },
    });
  });

  it('короткий ключ — ошибка конфигурации', () => {
    expect(() => loadConfig({ ...base, BOT_API_KEY: 'short' })).toThrow(/BOT_API_KEY/);
  });
});
