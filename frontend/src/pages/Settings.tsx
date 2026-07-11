import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, Settings as SettingsType } from "../lib/api";
import { useDemo } from "./useDemo";

export default function Settings() {
  const demo = useDemo();
  const [settings, setSettings] = useState<SettingsType | null>(null);

  useEffect(() => {
    api.settings(demo.businessId).then(setSettings).catch(() => undefined);
  }, [demo.businessId]);

  async function save() {
    if (!settings) return;
    setSettings(await api.patchSettings(demo.businessId, settings));
  }

  function update<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Decision policy</p>
        <h2 className="page-title">Control how Leetsoft optimizes</h2>
        <p className="mt-3 text-sm text-slate-500">Transparent guardrails keep every recommendation aligned with the business.</p>
      </div>
      <section className="surface p-5">
        {settings ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Min gap minutes" value={settings.minGapMinutesToOptimize} onChange={(value) => update("minGapMinutesToOptimize", Number(value))} />
            <Field label="Default discount percent" value={settings.defaultDiscountPercent} onChange={(value) => update("defaultDiscountPercent", Number(value))} />
            <Field label="Max discount percent" value={settings.maxDiscountPercent} onChange={(value) => update("maxDiscountPercent", Number(value))} />
            <Field label="Message cap per 14 days" value={settings.maxMessagesPerCustomerPer14Days} onChange={(value) => update("maxMessagesPerCustomerPer14Days", Number(value))} />
            <Field label="Enabled channels" value={settings.enabledChannels} onChange={(value) => update("enabledChannels", value)} />
            <Field label="Business timezone" value={settings.timezone} onChange={(value) => update("timezone", value)} />
            <Field label="Currency" value={settings.currency} onChange={(value) => update("currency", value)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading settings...</p>
        )}
        <button disabled={!settings} onClick={save} className="primary-button mt-5">
          <Save className="h-4 w-4" />
          Save settings
        </button>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-600">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
    </label>
  );
}
