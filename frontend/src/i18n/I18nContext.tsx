import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Lang, LANGUAGES, translations, TranslationShape } from "./translations";

const STORAGE_KEY = "leetsoft.lang";

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TKey = DotPaths<TranslationShape>;

function detectDefaultLang(): Lang {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Lang;
  const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "en";
  if ((LANGUAGES as readonly string[]).includes(browser)) return browser as Lang;
  return "en";
}

function resolve(key: string, lang: Lang): string {
  const segments = key.split(".");
  let node: unknown = translations[lang];
  for (const segment of segments) {
    if (node && typeof node === "object" && segment in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[segment];
    } else {
      return key;
    }
  }
  return typeof node === "string" ? node : key;
}

const STATUS_KEYS: Record<string, TKey> = {
  sent: "common.statusSent",
  accepted: "common.statusAccepted",
  declined: "common.statusDeclined",
  expired: "common.statusExpired",
};

export function offerStatusKey(status: string): TKey {
  return STATUS_KEYS[status] ?? "common.statusSent";
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectDefaultLang());

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      t: (key, vars) => interpolate(resolve(key, lang), vars),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within an I18nProvider");
  return ctx;
}
