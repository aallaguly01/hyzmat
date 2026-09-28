import { describe, expect, it } from 'vitest';
import type { SafeParseReturnType } from 'zod';
import { makeSchemas } from './schemas';

const TODAY = '2026-09-27';
const s = makeSchemas({ today: () => TODAY });

const mail = {
  type: 'MAIL',
  fromCity: ' Ашхабад ',
  toCity: 'Москва',
  departureDate: '2026-10-07',
};
const transfer = {
  type: 'TRANSFER',
  fromCity: 'Ашхабад',
  toCity: 'Стамбул',
  amount: '1500',
  conditions: '2%',
};

const issues = (r: SafeParseReturnType<unknown, unknown>) => (r.success ? [] : r.error.issues);

describe('CreateListingInput — Почта', () => {
  it('Успешное создание: обрезает пробелы', () => {
    const r = s.CreateListingInput.parse(mail);
    expect(r).toMatchObject({
      type: 'MAIL',
      fromCity: 'Ашхабад',
      toCity: 'Москва',
      departureDate: '2026-10-07',
    });
  });

  it('Дата в прошлом', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, departureDate: '2026-09-26' });
    expect(r.success).toBe(false);
    expect(issues(r)[0]).toMatchObject({
      path: ['departureDate'],
      message: 'Дата вылета не может быть в прошлом',
    });
  });

  it('Сегодняшняя дата допустима', () => {
    expect(s.CreateListingInput.safeParse({ ...mail, departureDate: TODAY }).success).toBe(true);
  });

  it('Дата дальше чем через 365 дней', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, departureDate: '2027-09-28' });
    expect(r.success).toBe(false);
    expect(issues(r)[0]?.path).toEqual(['departureDate']);
  });

  it('Несуществующая дата', () => {
    expect(s.CreateListingInput.safeParse({ ...mail, departureDate: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('Одинаковые города', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, fromCity: 'москва ', toCity: ' МОСКВА' });
    expect(r.success).toBe(false);
    expect(issues(r)[0]).toMatchObject({
      path: ['toCity'],
      message: 'Города отправления и назначения должны различаться',
    });
  });

  it('Слишком короткий город', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, fromCity: 'A' });
    expect(issues(r)[0]).toMatchObject({ path: ['fromCity'], message: 'Минимум 2 символа' });
  });

  it('Обязательное поле', () => {
    const { toCity: _t, ...noTo } = mail;
    const r = s.CreateListingInput.safeParse(noTo);
    expect(issues(r)[0]).toMatchObject({ path: ['toCity'], message: 'Обязательное поле' });
  });

  it('Попытка подменить автора', () => {
    const r = s.CreateListingInput.parse({ ...mail, authorId: '1', author: { id: '1' } });
    expect(r).not.toHaveProperty('authorId');
    expect(r).not.toHaveProperty('author');
  });
});

describe('CreateListingInput — Перевод', () => {
  it('Успешное создание: сумма нормализована', () => {
    const r = s.CreateListingInput.parse(transfer);
    expect(r).toMatchObject({ type: 'TRANSFER', amount: '1500.00', conditions: '2%' });
  });

  it('Сумма с запятой', () => {
    expect(s.CreateListingInput.parse({ ...transfer, amount: '1500,5' })).toMatchObject({
      amount: '1500.50',
    });
  });

  it('Сумма числом', () => {
    expect(s.CreateListingInput.parse({ ...transfer, amount: 99.5 })).toMatchObject({
      amount: '99.50',
    });
  });

  it.each(['0', '-5', 'abc', '', '1.555', '1000000.01'])(
    'Неположительная или некорректная сумма: %s',
    (amount) => {
      const r = s.CreateListingInput.safeParse({ ...transfer, amount });
      expect(r.success).toBe(false);
      expect(issues(r)[0]?.path).toEqual(['amount']);
    },
  );

  it('Клиент передал валюту', () => {
    expect(s.CreateListingInput.parse({ ...transfer, currency: 'EUR' })).not.toHaveProperty(
      'currency',
    );
  });

  it('Поля другого типа', () => {
    expect(s.CreateListingInput.parse({ ...transfer, departureDate: TODAY })).not.toHaveProperty(
      'departureDate',
    );
  });

  it('Условия необязательны и не длиннее 200 символов', () => {
    const { conditions: _c, ...noConditions } = transfer;
    expect(s.CreateListingInput.safeParse(noConditions).success).toBe(true);
    expect(
      s.CreateListingInput.safeParse({ ...transfer, conditions: 'x'.repeat(201) }).success,
    ).toBe(false);
  });

  it('Пустые условия превращаются в undefined', () => {
    const r = s.CreateListingInput.parse({ ...transfer, conditions: '  ' });
    expect(r.type === 'TRANSFER' && r.conditions).toBeUndefined();
  });
});

describe('CreateListingInput — тип', () => {
  it('Неизвестный тип', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, type: 'TAXI' });
    expect(r.success).toBe(false);
    expect(issues(r)[0]?.path).toEqual(['type']);
  });
});

describe('Update-схемы', () => {
  it('частичное обновление почты', () => {
    expect(s.UpdateMailInput.parse({ toCity: ' Казань ' })).toEqual({ toCity: 'Казань' });
  });
  it('частичное обновление перевода', () => {
    expect(s.UpdateTransferInput.parse({ amount: '10' })).toEqual({ amount: '10.00' });
  });
  it('условия можно очистить', () => {
    expect(s.UpdateTransferInput.parse({ conditions: '' })).toEqual({ conditions: null });
  });
});

describe('Комментарий к заявке', () => {
  it('Создание с комментарием: обрезает пробелы', () => {
    const r = s.CreateListingInput.parse({ ...mail, comment: '  WhatsApp +99365000000  ' });
    expect(r.comment).toBe('WhatsApp +99365000000');
  });
  it('Комментарий у «Перевода»', () => {
    const r = s.CreateListingInput.parse({ ...transfer, comment: 'Звоните после 18:00' });
    expect(r.comment).toBe('Звоните после 18:00');
  });
  it('Без комментария: пустой и пробельный — отсутствует', () => {
    expect(s.CreateListingInput.parse(mail).comment).toBeUndefined();
    expect(s.CreateListingInput.parse({ ...transfer, comment: '   ' }).comment).toBeUndefined();
  });
  it('Слишком длинный комментарий', () => {
    const r = s.CreateListingInput.safeParse({ ...mail, comment: 'а'.repeat(301) });
    expect(r.success).toBe(false);
    expect(issues(r)[0]).toMatchObject({ path: ['comment'], message: 'Максимум 300 символов' });
    expect(s.CreateListingInput.safeParse({ ...mail, comment: 'а'.repeat(300) }).success).toBe(
      true,
    );
  });
  it('Изменение и очистка комментария', () => {
    expect(s.UpdateMailInput.parse({ comment: ' IMO ' })).toEqual({ comment: 'IMO' });
    expect(s.UpdateMailInput.parse({ comment: null })).toEqual({ comment: null });
    expect(s.UpdateTransferInput.parse({ comment: '' })).toEqual({ comment: null });
  });
});

describe('FeedQuery', () => {
  it('limit по умолчанию 20', () => {
    expect(s.FeedQuery.parse({ type: 'MAIL' })).toEqual({ type: 'MAIL', limit: 20 });
  });
  it('Тип не передан', () => {
    expect(s.FeedQuery.safeParse({}).success).toBe(false);
  });
  it('пустой city игнорируется', () => {
    expect(s.FeedQuery.parse({ type: 'MAIL', city: '  ' }).city).toBeUndefined();
  });
  it('limit ограничен 1..50', () => {
    expect(s.FeedQuery.safeParse({ type: 'MAIL', limit: '51' }).success).toBe(false);
    expect(s.FeedQuery.parse({ type: 'MAIL', limit: '5' }).limit).toBe(5);
  });
});
