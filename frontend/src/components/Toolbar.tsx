import { useTranslation } from "../i18n/I18nContext";
import { Business, Staff } from "../lib/api";

type Props = {
  businesses: Business[];
  staff: Staff[];
  businessId: number;
  staffId?: number;
  date: string;
  onBusiness: (value: number) => void;
  onStaff: (value?: number) => void;
  onDate: (value: string) => void;
  onSeed: () => void;
};

export function Toolbar({ businesses, staff, businessId, staffId, date, onBusiness, onStaff, onDate, onSeed }: Props) {
  const { t } = useTranslation();
  return (
    <div className="surface flex flex-wrap items-end gap-3 p-4">
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        {t("common.business")}
        <select value={businessId} onChange={(event) => onBusiness(Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        {t("common.date")}
        <input value={date} onChange={(event) => onDate(event.target.value)} type="date" className="rounded-xl border border-slate-300 px-3 py-2.5" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        {t("common.staff")}
        <select value={staffId ?? ""} onChange={(event) => onStaff(event.target.value ? Number(event.target.value) : undefined)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
          <option value="">{t("common.allStaff")}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={onSeed} className="secondary-button ml-auto">
        {t("common.resetDemo")}
      </button>
    </div>
  );
}
