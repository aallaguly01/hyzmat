import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { ZodTypeAny, z } from 'zod';

type Values = Record<string, string>;

/**
 * Лёгкая форма поверх zod-схемы из shared: те же правила, что и на сервере.
 * Ошибка поля показывается после blur или после попытки отправки.
 */
export function useZodForm<S extends ZodTypeAny>(schema: S, initialValues: Values) {
  const [initial] = useState(initialValues);
  const [values, setValues] = useState<Values>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const result = useMemo(() => schema.safeParse(values), [schema, values]);

  const clientErrors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        out[key] ??= issue.message;
      }
    }
    return out;
  }, [result]);

  const errors: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    errors[key] = serverErrors[key] ?? (touched[key] || submitted ? clientErrors[key] : undefined);
  }

  const setField = useCallback((name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setServerErrors(({ [name]: _removed, ...rest }) => rest);
  }, []);

  const bind = (name: string) => ({
    id: `field-${name}`,
    name,
    value: values[name] ?? '',
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `field-${name}-error` : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(name, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
  });

  const changedKeys = Object.keys(values).filter((k) => values[k] !== initial[k]);

  return {
    values,
    errors,
    bind,
    isValid: result.success,
    data: (result.success ? result.data : undefined) as z.output<S> | undefined,
    dirty: changedKeys.length > 0,
    changedKeys,
    /** Программная установка значения (не из input) — сразу считается touched. */
    setValue: (name: string, value: string) => {
      setField(name, value);
      setTouched((t) => ({ ...t, [name]: true }));
    },
    markSubmitted: () => setSubmitted(true),
    setServerErrors,
  };
}
