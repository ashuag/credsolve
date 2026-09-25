'use client';

import {
  DataTable,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { createUser, getRoles, getUsers, resendUserInvitation, toggleUserStatus, updateUser, type LosRole, type LosUser } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const AGENT_STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// ─── types ───────────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'edit';
type SaveMeta = { mode: ModalMode; invitationResent?: boolean };
type AgentStatus = 'pending' | 'active' | 'inactive';

type FormState = {
  fullName: string;
  email: string;
  roleId: number | '';
  managerId: string | null;
};

const EMPTY_FORM: FormState = { fullName: '', email: '', roleId: '', managerId: null };

function getAgentStatus(agent: LosUser): AgentStatus {
  if (!agent.registrationCompletedAt) return 'pending';
  return agent.isActive ? 'active' : 'inactive';
}

function isSameLocalDay(iso: string) {
  const value = new Date(iso);
  const today = new Date();

  return value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth()
    && value.getDate() === today.getDate();
}

function signedInToday(agent: LosUser) {
  return !!agent.lastLoginAt && isSameLocalDay(agent.lastLoginAt);
}

function getManagerOptionLabel(agent: { fullName: string; email: string; userRole: LosRole | null }) {
  return `${agent.fullName} · ${agent.userRole?.name ?? 'No role'} · ${agent.email}`;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

function getDirectReportsByManager(agents: LosUser[]) {
  const reports: Record<string, LosUser[]> = {};

  agents.forEach((agent) => {
    if (!agent.managerId) return;
    reports[agent.managerId] ??= [];
    reports[agent.managerId].push(agent);
  });

  Object.values(reports).forEach((members) => members.sort((left, right) => compareText(left.fullName, right.fullName)));

  return reports;
}

function teamMemberLabel(count: number) {
  return count === 1 ? '1 team member' : `${count} team members`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ name }: { name: string | null | undefined }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[0.82rem] font-extrabold bg-[rgba(34,197,94,0.1)] text-[#0c2e7a]">
      {name ?? '—'}
    </span>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const styles = {
    pending: 'bg-[rgba(245,158,11,0.12)] text-[#9a6700]',
    active: 'bg-[rgba(34,197,94,0.12)] text-[#166534]',
    inactive: 'bg-[rgba(239,68,68,0.1)] text-[#991b1b]',
  } as const;
  const dots = {
    pending: 'bg-[#f59e0b]',
    active: 'bg-[#22c55e]',
    inactive: 'bg-[#ef4444]',
  } as const;
  const labels = {
    pending: 'Pending',
    active: 'Active',
    inactive: 'Inactive',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-[7px] px-3 py-1 rounded-full text-[0.82rem] font-extrabold ${styles[status]}`}
    >
      <span className={`w-[8px] h-[8px] rounded-full ${dots[status]}`} aria-hidden />
      {labels[status]}
    </span>
  );
}

function TeamToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// ─── modal ───────────────────────────────────────────────────────────────────

function AgentModal({
  mode,
  initial,
  roles,
  agents,
  onClose,
  onSave,
}: {
  mode: ModalMode;
  initial?: LosUser;
  roles: LosRole[];
  agents: LosUser[];
  onClose: () => void;
  onSave: (agent: LosUser, meta: SaveMeta) => void;
}) {
  const [form, setForm] = useState<FormState>(
    mode === 'edit' && initial
      ? {
          fullName: initial.fullName,
          email: initial.email,
          roleId: initial.roleId,
          managerId: initial.managerId,
        }
      : EMPTY_FORM
  );
  const [managerInput, setManagerInput] = useState(
    mode === 'edit' && initial?.manager ? getManagerOptionLabel(initial.manager) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const activeRoles = [...roles]
    .filter((r) => r.isActive)
    .sort((left, right) => (
      left.hierarchyLevel - right.hierarchyLevel || compareText(left.name, right.name)
    ));
  const selectedRole = activeRoles.find((role) => role.id === form.roleId) ?? null;
  const requiresManager = !!selectedRole && selectedRole.hierarchyLevel > 1;
  const requiredManagerLevel = selectedRole ? selectedRole.hierarchyLevel - 1 : null;
  const eligibleManagers = [...agents]
    .filter((agent) => {
      if (!requiresManager || requiredManagerLevel === null) return false;
      if (initial && agent.id === initial.id) return false;

      return getAgentStatus(agent) === 'active' && agent.userRole?.hierarchyLevel === requiredManagerLevel;
    })
    .sort((left, right) => compareText(left.fullName, right.fullName));

  useEffect(() => {
    if (!requiresManager) {
      if (form.managerId !== null) {
        setForm((current) => ({ ...current, managerId: null }));
      }
      if (managerInput !== '') {
        setManagerInput('');
      }
      return;
    }

    if (form.managerId && !eligibleManagers.some((manager) => manager.id === form.managerId)) {
      setForm((current) => ({ ...current, managerId: null }));
      setManagerInput('');
    }
  }, [eligibleManagers, form.managerId, managerInput, requiresManager]);

  function handleManagerChange(value: string) {
    setManagerInput(value);
    const normalizedValue = value.trim().toLowerCase();
    const exactMatch = eligibleManagers.find((manager) => (
      getManagerOptionLabel(manager).toLowerCase() === normalizedValue
      || manager.email.toLowerCase() === normalizedValue
    ));

    setForm((current) => ({ ...current, managerId: exactMatch?.id ?? null }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.roleId) { setError('Please select a role.'); return; }
    if (requiresManager && !form.managerId) {
      setError(`Please assign a manager from hierarchy level ${requiredManagerLevel}.`);
      return;
    }
    setLoading(true);
    setError(null);

    const token = getToken();
    if (!token) { setError('Session expired — please log in again.'); setLoading(false); return; }

    try {
      let saved: LosUser;
      if (mode === 'create') {
        saved = await createUser(token, {
          fullName: form.fullName,
          email: form.email,
          roleId: Number(form.roleId),
          managerId: requiresManager ? form.managerId : null,
        });
        onSave(saved, { mode });
      } else {
        const payload: { fullName?: string; email?: string; roleId?: number; managerId?: string | null } = {};
        const emailChanged = form.email !== initial?.email;
        if (form.fullName !== initial?.fullName) payload.fullName = form.fullName;
        if (form.email !== initial?.email) payload.email = form.email;
        if (Number(form.roleId) !== initial?.roleId) payload.roleId = Number(form.roleId);
        if ((requiresManager ? form.managerId : null) !== (initial?.managerId ?? null)) {
          payload.managerId = requiresManager ? form.managerId : null;
        }
        saved = await updateUser(token, initial!.id, payload);
        onSave(saved, { mode, invitationResent: emailChanged && !initial?.registrationCompletedAt });
      }
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
      aria-label={mode === 'create' ? 'Create agent' : 'Edit agent'}
    >
      <div
        className="w-full max-w-[480px] rounded-[20px] border border-[rgba(15,39,72,0.12)] shadow-[0_32px_64px_rgba(15,39,72,0.22)] p-6"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,247,255,0.96))' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue mb-1">
              {mode === 'create' ? 'New agent account' : 'Edit agent'}
            </span>
            <h2 className="m-0 text-[1.3rem] font-extrabold leading-[1.1] tracking-[-0.04em]">
              {mode === 'create' ? 'Add Agent' : 'Edit Agent'}
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
          {/* Name */}
          <div className="grid gap-1.5">
            <label htmlFor="a-name" className="text-[0.88rem] font-bold">Full Name</label>
            <input
              ref={firstInputRef}
              id="a-name"
              type="text"
              className="los-input"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Rahul Sharma"
              required
              minLength={2}
            />
          </div>

          {/* Email */}
          <div className="grid gap-1.5">
            <label htmlFor="a-email" className="text-[0.88rem] font-bold">Email</label>
            <input
              id="a-email"
              type="email"
              className="los-input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="agent@moneycash.test"
              required
            />
          </div>

          {mode === 'create' ? (
            <div className="rounded-[10px] p-[12px_14px] border border-[rgba(34,197,94,0.16)] bg-[rgba(34,197,94,0.06)] text-[0.84rem] text-brand-text">
              A one-time registration email will be sent automatically. The agent will set their password from that link.
            </div>
          ) : !initial?.registrationCompletedAt ? (
            <div className="rounded-[10px] p-[12px_14px] border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.08)] text-[0.84rem] text-brand-text">
              This agent is still pending. Use the resend email action from the table to send a fresh password setup link.
            </div>
          ) : null}

          {/* Role */}
          <div className="grid gap-1.5">
            <label htmlFor="a-role" className="text-[0.88rem] font-bold">Role</label>
            {activeRoles.length === 0 ? (
              <p className="text-[0.84rem] text-[#8d3434]">
                No active roles available.{' '}
                <Link href="/roles" className="underline text-brand-blue">Add roles first.</Link>
              </p>
            ) : (
              <select
                id="a-role"
                className="los-input appearance-none cursor-pointer"
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value ? Number(e.target.value) : '' }))}
                required
              >
                <option value="">Select a role…</option>
                {activeRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>

          {requiresManager ? (
            <div className="grid gap-1.5">
              <label htmlFor="a-manager" className="text-[0.88rem] font-bold">
                Reporting Manager
              </label>
              <input
                id="a-manager"
                type="text"
                className="los-input"
                list="eligible-manager-list"
                value={managerInput}
                onChange={(e) => handleManagerChange(e.target.value)}
                placeholder={
                  eligibleManagers.length > 0
                    ? 'Search by name or email…'
                    : `No active level ${requiredManagerLevel} managers available`
                }
                required={requiresManager}
              />
              <datalist id="eligible-manager-list">
                {eligibleManagers.map((manager) => (
                  <option key={manager.id} value={getManagerOptionLabel(manager)} />
                ))}
              </datalist>
              <p className="m-0 text-[0.8rem] text-brand-muted">
                Select an active agent from hierarchy level {requiredManagerLevel}.
              </p>
            </div>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="rounded-[10px] p-[10px_14px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] text-[#8d3434] text-[0.86rem]">
              {error}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[38px] rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent font-bold text-brand-text cursor-pointer hover:bg-[rgba(34,197,94,0.06)] transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 los-btn-primary" disabled={loading || activeRoles.length === 0}>
              {loading ? (mode === 'create' ? 'Sending invite…' : 'Saving…') : (mode === 'create' ? 'Add Agent & Send Invite' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── main panel ──────────────────────────────────────────────────────────────

export function AgentsPanel() {
  const [agents, setAgents] = useState<LosUser[]>([]);
  const [roles, setRoles] = useState<LosRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: ModalMode; agent?: LosUser } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [signedInTodayOnly, setSignedInTodayOnly] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) { setFetchError('Session expired — please log in again.'); setLoading(false); return; }
    try {
      const [agentsData, rolesData] = await Promise.all([getUsers(token), getRoles(token)]);
      setAgents(agentsData);
      setRoles(rolesData);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function handleToggle(agent: LosUser) {
    const token = getToken();
    if (!token || togglingId !== null) return;
    setTogglingId(agent.id);
    try {
      const updated = await toggleUserStatus(token, agent.id);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleResendInvitation(agent: LosUser) {
    const token = getToken();
    if (!token || resendingId !== null) return;
    setResendingId(agent.id);
    try {
      const updated = await resendUserInvitation(token, agent.id);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionError(null);
      setNotice(`Invitation email sent to ${updated.email}.`);
    } catch (err) {
      setNotice(null);
      setActionError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  }

  function handleSaved(saved: LosUser, meta: SaveMeta) {
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      return idx >= 0 ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
    setNotice(
      meta.mode === 'create'
        ? `Invitation email sent to ${saved.email}.`
        : meta.invitationResent
        ? `Agent details updated. Registration email sent to ${saved.email}.`
        : 'Agent details updated.'
    );
    setActionError(null);
    setModal(null);
  }

  const directReportsByManager = useMemo(() => getDirectReportsByManager(agents), [agents]);
  const sortedRoles = useMemo(
    () => [...roles].sort((left, right) => left.hierarchyLevel - right.hierarchyLevel || compareText(left.name, right.name)),
    [roles],
  );
  const roleFilterOptions = useMemo(
    () => sortedRoles.map((role) => ({ value: String(role.id), label: role.name })),
    [sortedRoles],
  );

  const totalPending = agents.filter((a) => getAgentStatus(a) === 'pending').length;
  const totalActive = agents.filter((a) => getAgentStatus(a) === 'active').length;
  const totalInactive = agents.filter((a) => getAgentStatus(a) === 'inactive').length;
  const totalSignedInToday = agents.filter(signedInToday).length;

  const tableItems = useMemo(
    () => (signedInTodayOnly ? agents.filter(signedInToday) : agents),
    [agents, signedInTodayOnly],
  );

  const columns = useMemo((): DataTableColumn<LosUser>[] => [
    {
      key: 'name',
      label: 'Name',
      getFilterValue: (agent) => agent.fullName,
      getSortValue: (agent) => agent.fullName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      headerClassName: 'min-w-[180px]',
      render: (agent) => {
        const directReports = directReportsByManager[agent.id] ?? [];
        const isExpanded = expandedAgentId === agent.id;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex-shrink-0 w-7 h-7 rounded-[6px] grid place-items-center font-extrabold text-[0.75rem] text-[#fff8df]"
              style={{ background: 'linear-gradient(145deg, #22C55E, #0F2748)' }}
              aria-hidden
            >
              {initials(agent.fullName)}
            </span>
            <span className="min-w-0">
              <button
                type="button"
                onClick={() => setExpandedAgentId((current) => (current === agent.id ? null : agent.id))}
                className="inline-flex max-w-[220px] items-center gap-1 bg-transparent p-0 text-left text-[0.88rem] font-extrabold text-brand-text underline-offset-2 transition-colors hover:text-brand-blue hover:underline"
                title={isExpanded ? 'Hide direct reports' : 'Show direct reports'}
              >
                <span className="truncate">{agent.fullName}</span>
                <TeamToggleIcon expanded={isExpanded} />
              </button>
              <span className="block text-brand-muted text-[0.73rem]">
                #{agent.id} · {directReports.length > 0 ? teamMemberLabel(directReports.length) : 'No team'}
              </span>
              {isExpanded ? (
                <div className="mt-2 rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.95)] p-3">
                  {directReports.length === 0 ? (
                    <p className="m-0 text-[0.8rem] text-brand-muted">No direct reports assigned.</p>
                  ) : (
                    <div className="grid gap-2">
                      {directReports.map((member) => (
                        <div key={member.id} className="flex flex-wrap items-center gap-2">
                          <strong className="text-[0.82rem] text-brand-text">{member.fullName}</strong>
                          <span className="text-[0.75rem] text-brand-muted">{member.email}</span>
                          <RoleBadge name={member.userRole?.name} />
                          <StatusBadge status={getAgentStatus(member)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </span>
          </div>
        );
      },
    },
    {
      key: 'email',
      label: 'Email',
      getFilterValue: (agent) => agent.email,
      getSortValue: (agent) => agent.email.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search email…' },
      cellClassName: 'text-brand-muted text-[0.82rem]',
      render: (agent) => <span className="block min-w-[180px] whitespace-normal break-all">{agent.email}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      getFilterValue: (agent) => (agent.roleId != null ? String(agent.roleId) : ''),
      getSortValue: (agent) => (agent.userRole?.name ?? '').toLowerCase(),
      filter: {
        type: 'select',
        options: roleFilterOptions,
        matches: (agent, value) => String(agent.roleId ?? '') === value,
      },
      render: (agent) => <RoleBadge name={agent.userRole?.name} />,
    },
    {
      key: 'manager',
      label: 'Reporting manager',
      getFilterValue: (agent) => agent.manager ? `${agent.manager.fullName} ${agent.manager.email}` : 'Top level',
      getSortValue: (agent) => (agent.manager?.fullName ?? 'Top level').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search manager…' },
      cellClassName: 'text-brand-muted text-[0.82rem]',
      render: (agent) => agent.manager ? (
        <div className="min-w-0">
          <strong className="block whitespace-normal break-words text-brand-text text-[0.84rem]">
            {agent.manager.fullName}
          </strong>
          <span className="block whitespace-normal break-all">{agent.manager.email}</span>
        </div>
      ) : (
        <span className="block whitespace-nowrap">Top level</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (agent) => getAgentStatus(agent),
      getSortValue: (agent) => getAgentStatus(agent),
      filter: {
        type: 'select',
        options: [...AGENT_STATUS_FILTER_OPTIONS],
        matches: (agent, value) => getAgentStatus(agent) === value,
      },
      render: (agent) => <StatusBadge status={getAgentStatus(agent)} />,
    },
    {
      key: 'lastLogin',
      label: 'Last logged in',
      getFilterValue: (agent) => agent.lastLoginAt ?? '',
      getSortValue: (agent) => isoDateTimestamp(agent.lastLoginAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted text-[0.8rem] whitespace-nowrap',
      render: (agent) => (agent.lastLoginAt ? formatDateTime(agent.lastLoginAt) : 'Not signed in'),
    },
    {
      key: 'created',
      label: 'Added',
      getFilterValue: (agent) => agent.createdAt,
      getSortValue: (agent) => isoDateTimestamp(agent.createdAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted text-[0.8rem] whitespace-nowrap',
      render: (agent) => formatDate(agent.createdAt),
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      filter: false,
      render: (agent) => {
        const status = getAgentStatus(agent);
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModal({ mode: 'edit', agent })}
              title="Edit agent"
              className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer hover:border-[rgba(34,197,94,0.24)] transition-colors"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="sr-only">Edit agent</span>
            </button>
            {status === 'pending' ? (
              <button
                type="button"
                onClick={() => void handleResendInvitation(agent)}
                disabled={resendingId === agent.id}
                title="Resend invitation email"
                className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] border border-[rgba(34,197,94,0.2)] bg-[rgba(239,246,255,0.95)] text-brand-blue cursor-pointer hover:border-[rgba(34,197,94,0.36)] transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="sr-only">Resend invitation email</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggle(agent)}
                disabled={togglingId === agent.id}
                title={agent.isActive ? 'Deactivate agent' : 'Activate agent'}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-[6px] border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${
                  agent.isActive
                    ? 'border-[rgba(239,68,68,0.2)] bg-[rgba(255,241,241,0.9)] text-[#991b1b] hover:border-[rgba(239,68,68,0.36)]'
                    : 'border-[rgba(34,197,94,0.2)] bg-[rgba(240,253,244,0.9)] text-[#166534] hover:border-[rgba(34,197,94,0.36)]'
                }`}
              >
                {agent.isActive ? (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                ) : (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                )}
                <span className="sr-only">{agent.isActive ? 'Deactivate agent' : 'Activate agent'}</span>
              </button>
            )}
          </div>
        );
      },
    },
  ], [directReportsByManager, expandedAgentId, resendingId, roleFilterOptions, togglingId]);

  return (
    <>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[1.2rem] font-extrabold tracking-[-0.03em]">Agents</h2>
            <p className="m-0 mt-1 text-[0.86rem] text-brand-muted">
              Manage LOS agents, roles, and reporting hierarchy.
            </p>
          </div>
          <button type="button" className="los-btn-primary" onClick={() => setModal({ mode: 'create' })}>
            + Add Agent
          </button>
        </div>

        {!loading && !fetchError ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Active', value: totalActive, color: '#10b981', onClick: undefined as undefined | (() => void) },
              { label: 'Pending', value: totalPending, color: '#f59e0b', onClick: undefined },
              { label: 'Inactive', value: totalInactive, color: '#ef4444', onClick: undefined },
              {
                label: 'Signed in today',
                value: totalSignedInToday,
                color: '#22C55E',
                onClick: () => setSignedInTodayOnly((v) => !v),
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={`flex flex-col gap-1 rounded-[14px] border px-4 py-3 text-left ${card.onClick ? 'cursor-pointer' : 'cursor-default'} ${
                  card.label === 'Signed in today' && signedInTodayOnly ? 'ring-2 ring-[rgba(34,197,94,0.35)]' : ''
                }`}
                style={{ background: `${card.color}09`, borderColor: `${card.color}22` }}
              >
                <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: `${card.color}cc` }}>
                  {card.label}
                </span>
                <span className="text-[1.6rem] font-extrabold leading-none tracking-tight" style={{ color: card.color }}>
                  {card.value}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-[10px] border border-[rgba(34,197,94,0.22)] bg-[rgba(240,253,244,0.92)] p-[10px_14px] text-[0.86rem] text-[#166534]">
            {notice}
            <button type="button" className="ml-3 underline" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(239,68,68,0.22)] bg-[rgba(254,242,242,0.92)] p-[10px_14px] text-[0.86rem] text-[#991b1b]">
            {actionError}
            <button type="button" className="ml-3 underline" onClick={() => setActionError(null)}>Dismiss</button>
          </div>
        ) : null}

        <DataTable
          items={tableItems}
          columns={columns}
          getRowKey={(agent) => agent.id}
          entityLabel="agents"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadData()}
          emptyMessage="No agents available."
          minWidth="1100px"
          toolbarActions={
            <button
              type="button"
              onClick={() => void loadData()}
              className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text"
            >
              ↺ Refresh
            </button>
          }
          renderRowClassName={(agent) =>
            expandedAgentId === agent.id
              ? 'border-b border-[rgba(15,39,72,0.05)] bg-[rgba(34,197,94,0.03)]'
              : undefined
          }
        />
      </div>

      {modal ? (
        <AgentModal
          mode={modal.mode}
          initial={modal.agent}
          roles={roles}
          agents={agents}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      ) : null}
    </>
  );
}
