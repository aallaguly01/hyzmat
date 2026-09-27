import s from './Controls.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChange, placeholder }: Props) {
  return (
    <div className={s.search}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        maxLength={64}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className={s.clear}
          aria-label="Очистить"
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}
    </div>
  );
}
