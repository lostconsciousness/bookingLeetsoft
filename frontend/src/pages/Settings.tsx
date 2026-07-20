import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n/I18nContext";
import { api, CHANNEL_LABELS, channelLabel, Settings as SettingsType } from "../lib/api";
import { useDemo } from "./useDemo";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

const TIMEZONES = (() => {
  try {
    // @ts-expect-error - supportedValuesOf is available in modern browsers but not yet in the TS lib
    return (Intl.supportedValuesOf?.("timeZone") as string[] | undefined) ?? ["Europe/Vienna", "Europe/London", "America/New_York"];
  } catch {
    return ["Europe/Vienna", "Europe/London", "America/New_York"];
  }
})();

export default function Settings() {
  const { t } = useTranslation();
  const demo = useDemo();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSettings(null);
    setSaved(false);
    setError("");
    api.settings(demo.businessId).then(setSettings).catch((err) => setError(err instanceof Error ? err.message : t("settings.loadError")));
  }, [demo.businessId]);

  const enabledChannelList = useMemo(() => (settings?.enabledChannels ?? "").split(",").map((item) => item.trim()).filter(Boolean), [settings?.enabledChannels]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      setSettings(await api.patchSettings(demo.businessId, settings));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setSaved(false);
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleChannel(channel: string, enabled: boolean) {
    const next = enabled ? [...enabledChannelList, channel] : enabledChannelList.filter((item) => item !== channel);
    update("enabledChannels", next.join(","));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t("settings.kicker")}</p>
        <h2 className="page-title">{t("settings.title")}</h2>
        <p className="mt-3 text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>
      <section className="surface p-5">
        {settings ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={t("settings.minGap")}
              suffix={t("settings.unitMinutes")}
              value={settings.minGapMinutesToOptimize}
              min={0}
              step={5}
              onChange={(value) => update("minGapMinutesToOptimize", value)}
            />
            <Field
              label={t("settings.defaultDiscount")}
              suffix={t("settings.unitPercent")}
              value={settings.defaultDiscountPercent}
              min={0}
              max={100}
              onChange={(value) => update("defaultDiscountPercent", value)}
            />
            <Field
              label={t("settings.maxDiscount")}
              suffix={t("settings.unitPercent")}
              value={settings.maxDiscountPercent}
              min={0}
              max={100}
              onChange={(value) => update("maxDiscountPercent", value)}
            />
            <Field
              label={t("settings.messageCap")}
              suffix={t("settings.unitMessageCap")}
              value={settings.maxMessagesPerCustomerPer14Days}
              min={0}
              step={1}
              onChange={(value) => update("maxMessagesPerCustomerPer14Days", value)}
            />
            <label className="grid gap-1 text-sm font-medium text-slate-600">
              {t("settings.timezone")}
              <select value={settings.timezone} onChange={(event) => update("timezone", event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
                {!TIMEZONES.includes(settings.timezone) ? <option value={settings.timezone}>{settings.timezone}</option> : null}
                {TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-600">
              {t("settings.currency")}
              <select value={settings.currency} onChange={(event) => update("currency", event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
                {!CURRENCIES.includes(settings.currency) ? <option value={settings.currency}>{settings.currency}</option> : null}
                {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-2 text-sm font-medium text-slate-600 md:col-span-2">
              <legend>{t("settings.enabledChannels")}</legend>
              <div className="flex flex-wrap gap-3">
                {Object.keys(CHANNEL_LABELS).map((channel) => (
                  <label key={channel} className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700">
                    <input
                      type="checkbox"
                      checked={enabledChannelList.includes(channel)}
                      onChange={(event) => toggleChannel(channel, event.target.checked)}
                    />
                    {channelLabel(t, channel)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : (
          <p className="text-sm text-slate-500">{t("settings.loading")}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button disabled={!settings || saving} onClick={save} className="primary-button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
          <div aria-live="polite">
            {saved ? <span className="text-sm font-semibold text-accent-700">{t("settings.saved")}</span> : null}
            {error && settings ? <span className="text-sm font-semibold text-rose-700">{error}</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-600">
      {label}
      <span className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 focus-within:border-accent-400">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
          className="w-full border-none p-0 focus:outline-none"
        />
        <span className="shrink-0 text-xs font-normal text-slate-500">{suffix}</span>
      </span>
    </label>
  );
}
