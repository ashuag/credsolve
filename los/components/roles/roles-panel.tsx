'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  DataTableStatusPill,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { createRole, getRoles, toggleRoleStatus, updateRole, type LosRole } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

function isAdminRoleName(name: string) {
  return name.trim().toUpperCase() === 'ADMIN';
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function RoleModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: LosRole;
  onClose: () => void;
  onSave: (role: LosRole) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [hierarchyLevel, setHierarchyLevel] = useState<number | ''>(initial?.hierarchyLevel ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (isAdminRoleName(name)) {
      setHierarchyLevel(1);
    }
  }, [name]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hierarchyLevel) { setError('Please enter a hierarchy level.'); return; }
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) { setError('Session expired — please log in again.'); setLoading(false); return; }

    try {
      const saved = isEdit
        ? await updateRole(token, initial!.id, { name, hierarchyLevel: Number(hierarchyLevel) })
        : await createRole(token, { name, hierarchyLevel: Number(hierarchyLevel) });
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,28,66,0.4)] backdrop-blur-[4px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal
      aria-label={isEdit ? 'Edit role' : 'Create role'}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] border border-[rgba(15,39,72,0.12)] shadow-[0_32px_64px_rgba(15,39,72,0.22)] p-6"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,247,255,0.96))' }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue mb-1">
              {isEdit ? 'Edit role' : 'New role'}
            </span>
            <h2 className="m-0 text-[1.3rem] font-extrabold leading-[1.1] tracking-[-0.04em]">
              {isEdit ? 'Rename Role' : 'Add Role'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[10px] border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer hover:-translate-y-px transition-transform"
            aria-label="Close"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label htmlFor="r-name" className="text-[0.88rem] font-bold">Role Name</label>
            <input
              ref={inputRef}
              id="r-name"
              type="text"
              className="los-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Branch Manager"
              required
              minLength={2}
              maxLength={50}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="r-level" className="text-[0.88rem] font-bold">Hierarchy Level</label>
            <input
              id="r-level"
              type="number"
              min={1}
              className="los-input"
              value={hierarchyLevel}
              onChange={(e) => setHierarchyLevel(e.target.value ? Number(e.target.value) : '')}
              disabled={isAdminRoleName(name)}
              required
            />
            <p className="m-0 text-[0.8rem] text-brand-muted">
              Level 1 is the top-most role and is reserved for ADMIN.
            </p>
          </div>

          {error ? (
            <div className="rounded-[10px] p-[10px_14px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] text-[#8d3434] text-[0.86rem]">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[38px] rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent font-bold text-brand-text cursor-pointer hover:bg-[rgba(34,197,94,0.06)] transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 los-btn-primary" disabled={loading}>
              {loading ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Role')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function RolesPanel() {
  const [roles, setRoles] = useState<LosRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ role?: LosRole } | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) { setFetchError('Session expired — please log in again.'); setLoading(false); return; }
    try {
      setRoles(await getRoles(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  async function handleToggle(role: LosRole) {
    const token = getToken();
    if (!token || togglingId !== null) return;
    setTogglingId(role.id);
    try {
      const updated = await toggleRoleStatus(token, role.id);
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved(saved: LosRole) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      return idx >= 0 ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
    });
    setModal(null);
  }

  const totalActive = roles.filter((r) => r.isActive).length;

  const columns = useMemo((): DataTableColumn<LosRole>[] => [
    {
      key: 'id',
      label: '#',
      getFilterValue: (role) => role.id,
      getSortValue: (role) => role.id,
      filter: { type: 'number', placeholder: 'ID…' },
      cellClassName: 'text-brand-muted text-[0.8rem] w-12',
      render: (role) => `#${role.id}`,
    },
    {
      key: 'name',
      label: 'Role Name',
      getFilterValue: (role) => role.name,
      getSortValue: (role) => role.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search roles…' },
      render: (role) => <strong className="text-[0.9rem]">{role.name}</strong>,
    },
    {
      key: 'level',
      label: 'Level',
      getFilterValue: (role) => role.hierarchyLevel,
      getSortValue: (role) => role.hierarchyLevel,
      filter: { type: 'number', placeholder: 'Level…' },
      render: (role) => (
        <span className="inline-flex items-center rounded-full bg-[rgba(34,197,94,0.08)] px-3 py-1 text-[0.8rem] font-extrabold text-brand-blue">
          L{role.hierarchyLevel}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (role) => (role.isActive ? 'active' : 'inactive'),
      getSortValue: (role) => (role.isActive ? 0 : 1),
      filter: {
        type: 'select',
        options: [...ACTIVE_INACTIVE_FILTER_OPTIONS],
        matches: (role, value) => matchesActiveInactiveFilter(role.isActive, value),
      },
      render: (role) => <DataTableStatusPill isActive={role.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (role) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setModal({ role })}
            title="Edit role"
            className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer hover:border-[rgba(34,197,94,0.24)] transition-colors"
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="sr-only">Edit</span>
          </button>

          <button
            type="button"
            onClick={() => void handleToggle(role)}
            disabled={togglingId === role.id}
            title={role.isActive ? 'Deactivate role' : 'Activate role'}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-[6px] border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${
              role.isActive
                ? 'border-[rgba(239,68,68,0.2)] bg-[rgba(255,241,241,0.9)] text-[#991b1b] hover:border-[rgba(239,68,68,0.36)]'
                : 'border-[rgba(34,197,94,0.2)] bg-[rgba(240,253,244,0.9)] text-[#166534] hover:border-[rgba(34,197,94,0.36)]'
            }`}
          >
            {role.isActive ? (
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            ) : (
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            )}
            <span className="sr-only">{role.isActive ? 'Deactivate' : 'Activate'}</span>
          </button>
        </div>
      ),
    },
  ], [togglingId]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Total roles', value: roles.length },
          { label: 'Active', value: totalActive },
          { label: 'Inactive', value: roles.length - totalActive },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[8px] border border-[rgba(15,39,72,0.1)] px-4 py-3"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
          >
            <span className="block text-[0.78rem] text-brand-muted">{stat.label}</span>
            <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
              {loading ? '—' : stat.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="block text-[0.72rem] font-extrabold tracking-[0.14em] uppercase text-brand-blue">
              Role directory
            </span>
            <h2 className="m-0 text-[1.15rem] font-extrabold leading-tight tracking-[-0.02em]">
              All Roles
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setModal({})}
            className="los-btn-primary whitespace-nowrap"
          >
            + Add Role
          </button>
        </div>

        <DataTable
          items={roles}
          columns={columns}
          getRowKey={(role) => role.id}
          entityLabel="roles"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadRoles()}
          emptyMessage="No roles yet — add the first one."
          tableClassName="text-[0.88rem]"
        />
      </div>

      {modal !== null ? (
        <RoleModal
          initial={modal.role}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      ) : null}
    </>
  );
}
