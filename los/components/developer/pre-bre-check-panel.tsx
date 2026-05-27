'use client';

import { getMasters, runPreBreCheck, type PreBreDryRunResult } from '@/lib/api';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

export function PreBreCheckPanel() {
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [genderId, setGenderId] = useState('');
  const [occupationId, setOccupationId] = useState('');
  const [pincode, setPincode] = useState('');
  const [cityId, setCityId] = useState('');
  const [genders, setGenders] = useState<Array<{ id: number; name: string }>>([]);
  const [occupations, setOccupations] = useState<Array<{ id: number; name: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string; stateId: number; stateCode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [mastersError, setMastersError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PreBreDryRunResult | null>(null);

  const selectedCity = useMemo(
    () => cities.find((c) => String(c.id) === cityId) ?? null,
    [cities, cityId],
  );

  useEffect(() => {
    const token = getLosToken();
    if (!token) return;
    getMasters(token)
      .then((m) => {
        setGenders(m.genders.map((g) => ({ id: g.id, name: g.name })));
        setOccupations(m.occupations.map((o) => ({ id: o.id, name: o.name })));
        setCities(
          m.cities.map((c) => ({
            id: c.id,
            name: c.name,
            stateId: c.stateId,
            stateCode: c.stateCode,
          })),
        );
      })
      .catch(() => setMastersError('Could not load gender / occupation / city masters.'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    setResult(null);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    const gender = genders.find((g) => String(g.id) === genderId);
    const occupation = occupations.find((o) => String(o.id) === occupationId);

    setLoading(true);
    try {
      const response = await runPreBreCheck(token, {
        dateOfBirth,
        genderId: Number(genderId),
        occupationId: Number(occupationId),
        genderDisplay: gender?.name,
        occupationDisplay: occupation?.name,
        pincode: pincode.trim(),
        cityId: selectedCity?.id,
        stateId: selectedCity?.stateId,
        cityName: selectedCity?.name,
        stateCode: selectedCity?.stateCode || undefined,
      });
      setResult(response);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Pre-BRE check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Dry-run rules that run before bureau pull: age band, rejected gender/occupation, and negative pincode/city/state
        lists. Uses live settings from Eligibility Criteria.
      </p>

      {mastersError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{mastersError}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Date of birth
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal"
            />
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            PIN code
            <input
              type="text"
              required
              maxLength={6}
              pattern="\d{6}"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal"
              placeholder="110001"
            />
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Gender
            <select
              required
              value={genderId}
              onChange={(e) => setGenderId(e.target.value)}
              className="rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal"
            >
              <option value="">Select gender</option>
              {genders.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (id {g.id})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Occupation
            <select
              required
              value={occupationId}
              onChange={(e) => setOccupationId(e.target.value)}
              className="rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal"
            >
              <option value="">Select occupation</option>
              {occupations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} (id {o.id})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy md:col-span-2">
            City (optional — for negative city/state checks)
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal"
            >
              <option value="">No city selected</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stateCode || `state ${c.stateId}`})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Running…' : 'Run pre-BRE check'}
        </button>
      </form>

      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {result ? (
        <div
          className={cx(
            'rounded-[14px] border px-4 py-4',
            result.passed
              ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
              : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]',
          )}
        >
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Result</p>
          <p className="m-0 mt-1 text-[1.15rem] font-extrabold text-brand-navy">
            {result.passed ? 'Pre-BRE would pass' : 'Pre-BRE would reject'}
          </p>
          {!result.passed && result.rejectReason ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">{result.rejectReason}</p>
          ) : null}
          {result.rejectionReasonCode ? (
            <p className="m-0 mt-2 font-mono text-[0.75rem] text-brand-muted">
              Code: <span className="text-brand-navy">{result.rejectionReasonCode}</span>
            </p>
          ) : null}
          <details className="mt-4">
            <summary className="cursor-pointer text-[0.82rem] font-bold text-brand-navy">Active thresholds</summary>
            <pre className="mt-2 overflow-x-auto text-[0.75rem] text-brand-muted">
              {JSON.stringify(result.thresholds, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
