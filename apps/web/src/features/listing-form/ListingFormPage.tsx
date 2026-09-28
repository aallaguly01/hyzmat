import {
  addDays,
  COMMENT_MAX,
  makeSchemas,
  MAX_DAYS_AHEAD,
  todayUtc,
  type ListingType,
  type MyListingDto,
} from '@hyzmat/shared';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../shared/api/client';
import { useCreateListing, useListing, useUpdateListing } from '../../shared/api/queries';
import { useZodForm } from '../../shared/hooks/useZodForm';
import {
  useBackButton,
  useDisableVerticalSwipes,
  useMainButton,
} from '../../shared/telegram/hooks';
import { getWebApp, haptic, showAlert, showConfirm } from '../../shared/telegram/webapp';
import { CityChips } from '../../shared/ui/CityChips';
import { EmptyState } from '../../shared/ui/States';
import ui from '../../shared/ui/ui.module.css';
import s from './ListingFormPage.module.css';

const clock = { today: () => todayUtc() };

type FieldKind = 'city' | 'date' | 'amount' | 'comment';

const COMMENT_FIELD = { name: 'comment', label: 'Комментарий', kind: 'comment' } as const;

const FIELDS: Record<ListingType, { name: string; label: string; kind?: FieldKind }[]> = {
  MAIL: [
    { name: 'fromCity', label: 'Откуда', kind: 'city' },
    { name: 'toCity', label: 'Куда', kind: 'city' },
    { name: 'departureDate', label: 'Дата вылета', kind: 'date' },
    COMMENT_FIELD,
  ],
  TRANSFER: [
    { name: 'fromCity', label: 'Город, где отдаю деньги', kind: 'city' },
    { name: 'toCity', label: 'Город, где получат деньги', kind: 'city' },
    { name: 'amount', label: 'Сумма, $', kind: 'amount' },
    { name: 'conditions', label: 'Условия/Комиссия' },
    COMMENT_FIELD,
  ],
};

const EMPTY: Record<ListingType, Record<string, string>> = {
  MAIL: { fromCity: '', toCity: '', departureDate: '', comment: '' },
  TRANSFER: { fromCity: '', toCity: '', amount: '', conditions: '', comment: '' },
};

function toFormValues(l: MyListingDto): Record<string, string> {
  const comment = l.comment ?? '';
  return l.type === 'MAIL'
    ? { fromCity: l.fromCity, toCity: l.toCity, departureDate: l.departureDate, comment }
    : {
        fromCity: l.fromCity,
        toCity: l.toCity,
        amount: l.amount.replace(/\.00$/, ''),
        conditions: l.conditions ?? '',
        comment,
      };
}

/** Значение изменённого поля для PATCH: пустой комментарий — явная очистка (`null`). */
function patchValue(key: string, values: Record<string, string>, data: Record<string, unknown>) {
  if (key === 'conditions') return values.conditions!.trim();
  if (key === 'comment') return values.comment!.trim() || null;
  return data[key];
}

function ContactHint() {
  const user = getWebApp()?.initDataUnsafe.user;
  if (!user) return null;
  return (
    <div className={s.contact}>
      <p>Ваш Telegram для связи: {user.username ? `@${user.username}` : user.first_name}</p>
      {!user.username && (
        <p className={s.hint}>
          Установите @username в настройках Telegram, чтобы с вами было проще связаться
        </p>
      )}
    </div>
  );
}

interface FormProps {
  type: ListingType;
  initial?: MyListingDto;
  onBack: (dirty: boolean) => void;
  submit: (body: Record<string, unknown>) => Promise<unknown>;
}

function ListingForm({ type, initial, onBack, submit }: FormProps) {
  const navigate = useNavigate();
  const isEdit = !!initial;
  const schema = useMemo(() => {
    const sc = makeSchemas(clock);
    return type === 'MAIL'
      ? sc.MailFields.superRefine(sc.differentCities)
      : sc.TransferFields.superRefine(sc.differentCities);
  }, [type]);
  const form = useZodForm(schema, initial ? toFormValues(initial) : EMPTY[type]);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  useDisableVerticalSwipes();
  useBackButton(() => onBack(form.dirty));

  const onSubmit = async () => {
    form.markSubmitted();
    if (inFlight.current || !form.isValid || !form.data) return;
    const data = form.data as Record<string, unknown>;
    const body: Record<string, unknown> = isEdit
      ? Object.fromEntries(form.changedKeys.map((k) => [k, patchValue(k, form.values, data)]))
      : { type, ...data };

    inFlight.current = true;
    setSubmitting(true);
    try {
      await submit(body);
      haptic.success();
      navigate('/my');
    } catch (e) {
      haptic.error();
      if (e instanceof ApiError && e.code === 'VALIDATION_ERROR' && e.details?.length) {
        form.setServerErrors(
          Object.fromEntries(e.details.map((d) => [String(d.path[0]), d.message])),
        );
      } else {
        void showAlert(e instanceof Error ? e.message : 'Что-то пошло не так');
      }
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  useMainButton({
    text: isEdit ? 'Сохранить' : 'Опубликовать',
    visible: true,
    active: form.isValid && (!isEdit || form.dirty) && !submitting,
    progress: submitting,
    onClick: () => void onSubmit(),
  });

  const today = clock.today();

  return (
    <form
      className={s.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <p className={s.type}>Тип: {type === 'MAIL' ? 'Почта' : 'Перевод'}</p>
      {FIELDS[type].map((f) => {
        const error = form.errors[f.name];
        return (
          <div key={f.name} className={s.field}>
            <label htmlFor={`field-${f.name}`}>{f.label}</label>
            {f.kind === 'comment' ? (
              <textarea
                {...form.bind(f.name)}
                rows={3}
                maxLength={COMMENT_MAX}
                autoComplete="off"
                placeholder="Можете указать способ связи"
              />
            ) : (
              <input
                {...form.bind(f.name)}
                type={f.kind === 'date' ? 'date' : 'text'}
                inputMode={f.kind === 'amount' ? 'decimal' : undefined}
                autoComplete="off"
                maxLength={
                  f.name === 'conditions' ? 200 : !f.kind || f.kind === 'city' ? 64 : undefined
                }
                min={f.kind === 'date' ? today : undefined}
                max={f.kind === 'date' ? addDays(today, MAX_DAYS_AHEAD) : undefined}
                placeholder={
                  f.name === 'conditions'
                    ? 'Например: комиссия 2%'
                    : f.kind === 'city'
                      ? 'Выберите или введите свой'
                      : undefined
                }
              />
            )}
            {error && (
              <span id={`field-${f.name}-error`} className={s.error}>
                {error}
              </span>
            )}
            {f.kind === 'city' && (
              <CityChips
                label={f.label}
                value={form.values[f.name] ?? ''}
                disabledValue={form.values[f.name === 'fromCity' ? 'toCity' : 'fromCity']}
                onPick={(city) => form.setValue(f.name, city)}
              />
            )}
          </div>
        );
      })}
      <ContactHint />
      {/* Enter на клавиатуре отправляет форму; видимая кнопка — нативная MainButton */}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}

function TypePicker({ onPick }: { onPick: (t: ListingType) => void }) {
  return (
    <div className={s.picker}>
      <h1 className={ui.title}>Что вы предлагаете?</h1>
      <button type="button" className={s.option} onClick={() => onPick('MAIL')}>
        <span className={s.optionTitle}>✉ Почта</span>
        <span className={s.hint}>Лечу и могу передать посылку или документы</span>
      </button>
      <button type="button" className={s.option} onClick={() => onPick('TRANSFER')}>
        <span className={s.optionTitle}>$ Перевод</span>
        <span className={s.hint}>Отдаю наличные в одном городе — получат в другом</span>
      </button>
    </div>
  );
}

function TypePickerStep({ onPick }: { onPick: (t: ListingType) => void }) {
  const navigate = useNavigate();
  useBackButton(() => navigate('/my'));
  return <TypePicker onPick={onPick} />;
}

export function CreateListingPage() {
  const [type, setType] = useState<ListingType | null>(null);
  const create = useCreateListing();

  return (
    <main className={ui.page}>
      {type ? (
        <ListingForm
          key={type}
          type={type}
          onBack={() => setType(null)}
          submit={create.mutateAsync}
        />
      ) : (
        <TypePickerStep onPick={setType} />
      )}
    </main>
  );
}

function NotFound() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/my'));
  return (
    <EmptyState
      text="Заявка не найдена"
      action={
        <button type="button" className={ui.button} onClick={() => navigate('/my')}>
          К моим заявкам
        </button>
      }
    />
  );
}

export function EditListingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const listing = useListing(id);
  const update = useUpdateListing(id);

  const onBack = async (dirty: boolean) => {
    if (dirty && !(await showConfirm('Отменить изменения?'))) return;
    navigate('/my');
  };

  let content;
  if (listing.isPending) content = <div className={ui.spinner}>Загрузка…</div>;
  else if (listing.isError || !listing.data.isOwn) content = <NotFound />;
  else {
    content = (
      <ListingForm
        type={listing.data.type}
        initial={listing.data}
        onBack={(dirty) => void onBack(dirty)}
        submit={update.mutateAsync}
      />
    );
  }

  return <main className={ui.page}>{content}</main>;
}
