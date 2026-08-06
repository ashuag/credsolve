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

export type DigilockerPanCertificateFields = {
  panNumber: string | null;
  name: string | null;
  dob: string | null;
  gender: string | null;
};

/** Pull login URL + client_id from Surepass DigiLocker initialize response. */
export function mapSurepassDigilockerInitToSessionFields(vendor: unknown): {
  clientId: string | null;
  url: string | null;
} {
  if (!isRecord(vendor)) return { clientId: null, url: null };
  const data = isRecord(vendor.data) ? vendor.data : vendor;
  const clientId = pickString(data, ['client_id', 'clientId']);
  const url = pickString(data, ['url', 'loginUrl', 'digilockerUrl']);
  return {
    clientId,
    url: url && /^https?:\/\//i.test(url) ? url : null,
  };
}

/**
 * Normalize Surepass download-aadhaar envelope so existing DigiLocker parsers /
 * LOS `aadhaarDetail` builders see name/DOB/photo at `data` (and keep nested XML).
 *
 * Surepass shape: `data.aadhaar_xml_data.{full_name,dob,profile_image,...}`
 * Tenacio-compatible shape: `data.{name|full_name,dob,photo,...}`
 */
export function mapSurepassDigilockerAadhaarToFormEnvelope(vendor: unknown): unknown {
  if (!isRecord(vendor)) return vendor;
  const data = vendor.data;
  if (!isRecord(data)) return vendor;

  const xmlData = data.aadhaar_xml_data;
  if (!isRecord(xmlData)) return vendor;

  const profileImage =
    pickString(xmlData, ['profile_image', 'profileImage', 'photo']) ?? null;
  const flattened: Record<string, unknown> = {
    ...data,
    ...xmlData,
    full_name: pickString(xmlData, ['full_name', 'fullName', 'name']) ?? xmlData.full_name,
    name: pickString(xmlData, ['full_name', 'fullName', 'name']) ?? xmlData.name,
    dob: pickString(xmlData, ['dob', 'date_of_birth', 'dateOfBirth']) ?? xmlData.dob,
    gender: pickString(xmlData, ['gender', 'Gender']) ?? xmlData.gender,
    masked_aadhaar:
      pickString(xmlData, ['masked_aadhaar', 'maskedAadhaar', 'aadhaar_number']) ??
      xmlData.masked_aadhaar,
    full_address:
      pickString(xmlData, ['full_address', 'fullAddress', 'address']) ?? xmlData.full_address,
    // Existing photo walk looks for key `photo`.
    photo: profileImage,
    profile_image: profileImage,
    aadhaar_xml_data: xmlData,
  };

  return {
    ...vendor,
    data: flattened,
  };
}

/**
 * Best-effort DigiLocker PAN certificate XML parse (Income Tax / DigiLocker format).
 * Avoids adding an XML dependency — attributes are stable enough for KYC storage.
 */
export function parseDigilockerPanCertificateXml(xml: string): DigilockerPanCertificateFields {
  const text = xml.trim();
  const panFromCert =
    /<Certificate\b[^>]*\bnumber=["']([A-Z]{5}[0-9]{4}[A-Z])["']/i.exec(text)?.[1] ??
    null;
  const panLoose =
    panFromCert ??
    /\b([A-Z]{5}[0-9]{4}[A-Z])\b/.exec(text)?.[1] ??
    null;

  const personAttrs = /<Person\b([^>]*)\/?>/i.exec(text)?.[1] ?? '';
  const attr = (name: string): string | null => {
    const m = new RegExp(`\\b${name}=["']([^"']+)["']`, 'i').exec(personAttrs);
    const v = m?.[1]?.trim();
    return v || null;
  };

  return {
    panNumber: panLoose ? panLoose.toUpperCase() : null,
    name: attr('name'),
    dob: attr('dob'),
    gender: attr('gender'),
  };
}
