import { useTranslation } from "../i18n/I18nContext";
import { LANGUAGE_LABELS, LANGUAGE_NAMES, LANGUAGES } from "../i18n/translations";

type Props = { className?: string; variant?: "dark" | "light" };

export function LanguageSwitcher({ className = "", variant = "dark" }: Props) {
  const { lang, setLang, t } = useTranslation();
  const trackClass = variant === "dark" ? "bg-white/10" : "bg-slate-100";
  const inactiveClass = variant === "dark" ? "text-emerald-50/75 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-white";
  const activeClass = variant === "dark" ? "bg-white text-accent-900" : "bg-white text-accent-900 shadow-sm";
  return (
    <div className={`flex items-center gap-1 rounded-lg p-1 ${trackClass} ${className}`} role="radiogroup" aria-label={t("common.language")}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          role="radio"
          aria-checked={lang === code}
          title={LANGUAGE_NAMES[code]}
          onClick={() => setLang(code)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${lang === code ? activeClass : inactiveClass}`}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
