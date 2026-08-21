import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { uk } from "./locales/uk";

export const LANGUAGES = ["en", "ru", "uk"] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Lang, string> = {
  en: "EN",
  ru: "RU",
  uk: "UA",
};

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
};

export type TranslationShape = typeof en;

export const translations: Record<Lang, TranslationShape> = { en, ru, uk };
