import { expect, test, type Page } from '@playwright/test';

const inDays = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Каждый прогон — новый пользователь (uid читает мок Telegram), чтобы не упираться в лимиты. */
const uid = () => String(100_000 + Math.floor(Math.random() * 900_000_000));

const mainButton = (page: Page) => page.locator('#mock-main-button');

test('создать → увидеть в ленте → отредактировать → удалить', async ({ page, browser }) => {
  page.on('dialog', (d) => void d.accept());
  const city = `Город${Date.now()}`;

  await page.goto(`/feed?uid=${uid()}`);
  await page.getByRole('link', { name: /Мои заявки/ }).click();
  await expect(page.getByText('У вас пока нет заявок')).toBeVisible();

  // создание
  await page.getByRole('button', { name: 'Создать заявку' }).click();
  await page.getByRole('button', { name: /Почта/ }).click();
  await expect(mainButton(page)).toBeDisabled();
  await page.getByLabel('Откуда', { exact: true }).fill(city);
  await page.getByLabel('Куда', { exact: true }).fill('Москва');
  await page.getByLabel('Дата вылета').fill(inDays(10));
  await expect(page.getByText(/Ваш Telegram для связи:/)).toBeVisible();
  await expect(mainButton(page)).toHaveText('Опубликовать');
  await mainButton(page).click();

  const card = page.getByRole('article').filter({ hasText: city });
  await expect(card).toBeVisible();
  await expect(card.getByText('Почта')).toBeVisible();

  // в ленте у автора — «Ваша заявка»
  await page.getByRole('link', { name: /Лента/ }).click();
  await page.getByRole('searchbox').fill(city);
  const feedCard = page.getByRole('article').filter({ hasText: city });
  await expect(feedCard.getByText('Ваша заявка')).toBeVisible();

  // другой пользователь видит кнопку «Написать»
  const other = await browser.newPage();
  await other.goto(`/feed?uid=${uid()}`);
  await other.getByRole('searchbox').fill(city);
  await expect(
    other.getByRole('article').filter({ hasText: city }).getByRole('button', { name: 'Написать' }),
  ).toBeVisible();
  await other.close();

  // редактирование
  await page.getByRole('link', { name: /Мои заявки/ }).click();
  await card.getByRole('button', { name: 'Редактировать' }).click();
  await expect(mainButton(page)).toHaveText('Сохранить');
  await page.getByLabel('Куда', { exact: true }).fill('Казань');
  await mainButton(page).click();
  await expect(card.getByText('Казань')).toBeVisible();

  // удаление (confirm принимается обработчиком dialog)
  await card.getByRole('button', { name: 'Удалить' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('У вас пока нет заявок')).toBeVisible();
});

test('перевод: сумма в долларах отображается в ленте', async ({ page }) => {
  const city = `Перевод${Date.now()}`;
  await page.goto(`/listings/new?uid=${uid()}`);
  await page.getByRole('button', { name: /Перевод/ }).click();
  await page.getByLabel('Город, где отдаю деньги', { exact: true }).fill(city);
  await page.getByLabel('Город, где получат деньги', { exact: true }).fill('Стамбул');
  await page.getByLabel('Сумма, $').fill('1500');
  await page.getByLabel('Условия/Комиссия').fill('2%');
  await mainButton(page).click();
  await expect(page.getByRole('article').filter({ hasText: city })).toBeVisible();

  await page.getByRole('link', { name: /Лента/ }).click();
  await page.getByRole('radio', { name: 'Перевод' }).click();
  await page.getByRole('searchbox').fill(city);
  const card = page.getByRole('article').filter({ hasText: city });
  await expect(card).toContainText('$1 500');
  await expect(card).toContainText('2%');
});
