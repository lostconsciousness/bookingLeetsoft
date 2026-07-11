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
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Business
        <select value={businessId} onChange={(event) => onBusiness(Number(event.target.value))} className="rounded-md border border-slate-300 bg-white px-3 py-2">
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Date
        <input value={date} onChange={(event) => onDate(event.target.value)} type="date" className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Staff
        <select value={staffId ?? ""} onChange={(event) => onStaff(event.target.value ? Number(event.target.value) : undefined)} className="rounded-md border border-slate-300 bg-white px-3 py-2">
          <option value="">All staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={onSeed} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Reset demo data
      </button>
    </div>
  );
}

