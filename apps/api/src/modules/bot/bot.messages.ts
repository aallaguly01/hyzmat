export interface WebAppKeyboard {
  inline_keyboard: { text: string; web_app: { url: string } }[][];
}

export const WELCOME_TEXT = [
  '👋 Добро пожаловать!',
  'Здесь находят людей для передачи посылок и перевода денег.',
  '⚠️ Важно: Бот — это только площадка для связи. Мы не несем ответственности за ваши деньги, вещи и добросовестность других людей. Все сделки совершаются строго на ваш страх и риск.',
  'Нажимая «Понятно, продолжить», вы принимаете эти условия.',
].join('\n\n');

export function welcomeKeyboard(webappUrl: string): WebAppKeyboard {
  return { inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: webappUrl } }]] };
}
