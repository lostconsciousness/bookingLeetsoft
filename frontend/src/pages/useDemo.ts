import { useCallback, useEffect, useRef, useState } from "react";
import { api, Business, Schedule } from "../lib/api";

function uniqueBusinesses(rows: Business[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.name}:${row.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useDemo() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const businessesRef = useRef<Business[]>([]);
  const [businessId, setBusinessId] = useState(1);
  const [date, setDate] = useState(api.today());
  const [staffId, setStaffId] = useState<number | undefined>();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const initialized = useRef(false);

  const refresh = useCallback(async (nextBusinessId = businessId, nextDate = date, nextStaffId = staffId, forceBusinesses = false) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      let rows = businessesRef.current;
      if (forceBusinesses || !rows.length) {
        rows = uniqueBusinesses(await api.businesses());
        if (!rows.length) {
          await api.seed();
          rows = uniqueBusinesses(await api.businesses());
        }
        businessesRef.current = rows;
        if (currentRequest === requestId.current) setBusinesses(rows);
      }

      const id = rows.some((row) => row.id === nextBusinessId) ? nextBusinessId : rows[0]?.id ?? 1;
      const nextSchedule = await api.schedule(id, nextDate, nextStaffId);
      if (currentRequest !== requestId.current) return;
      setBusinessId(id);
      setDate(nextDate);
      setStaffId(nextStaffId);
      setSchedule(nextSchedule);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [businessId, date, staffId]);

  async function seed() {
    await api.seed();
    businessesRef.current = [];
    await refresh(businessId, date, undefined, true);
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    refresh();
  }, [refresh]);

  return { businesses, businessId, setBusinessId, date, setDate, staffId, setStaffId, schedule, loading, error, refresh, seed };
}

