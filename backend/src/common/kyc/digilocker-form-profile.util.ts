function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

const NAME_KEYS = [
  'fullName',
  'name',
  'full_name',
  'residentName',
  'resident_name',
  'userName',
  'user_name',
  'aadhaarName',
] as const;

const DOB_KEYS = ['dateOfBirth', 'dob', 'date_of_birth', 'dateOfbirth', 'birthDate', 'birth_date'] as const;

/** Flattened DigiLocker `data` plus nested Surepass `aadhaar_xml_data`. */
export function collectDigilockerAadhaarFieldBags(formJson: unknown): Record<string, unknown>[] {
  if (!isRecord(formJson)) return [];
  const bags: Record<string, unknown>[] = [formJson];
  const data = formJson.data;
  if (isRecord(data)) bags.push(data);
  const xml = formJson.aadhaar_xml_data;
  if (isRecord(xml)) bags.push(xml);
  if (isRecord(data) && isRecord(data.aadhaar_xml_data)) {
    bags.push(data.aadhaar_xml_data);
  }
  return bags;
}

export function pickDigilockerAadhaarString(formJson: unknown, keys: readonly string[]): string | null {
  for (const bag of collectDigilockerAadhaarFieldBags(formJson)) {
    const value = pickString(bag, [...keys]);
    if (value) return value;
  }
  return null;
}

/** Parse ISO `YYYY-MM-DD` or `DD-MM-YYYY` / `DD/MM/YYYY` when unambiguous. */
function parseDob(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Best-effort name / DOB from DigiLocker `digilockerAadhaarFormJson` / vendor `data`. */
export function extractProfileFromDigilockerFormJson(formJson: unknown): {
  fullName: string | null;
  dateOfBirth: Date | null;
} {
  if (!isRecord(formJson)) {
    return { fullName: null, dateOfBirth: null };
  }
  const fullName = pickDigilockerAadhaarString(formJson, NAME_KEYS);
  const dateOfBirth = parseDob(pickDigilockerAadhaarString(formJson, DOB_KEYS));
  return { fullName, dateOfBirth };
}
