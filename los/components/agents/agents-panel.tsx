'use client';

import { createUser, getRoles, getUsers, toggleUserStatus, updateUser, type LosRole, type LosUser } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import Link from 'next/link';
import { FormEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react';

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
type AgentStatusFilter = AgentStatus | 'all';
type AgentSortField = 'fullName' | 'email' | 'role' | 'manager' | 'status' | 'lastLoginAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type AgentSort = { field: AgentSortField; direction: SortDirection };
type AgentStatCard =
  | { label: string; value: number; kind: 'status'; filterStatus: AgentStatusFilter }
  | { label: string; value: number; kind: 'today' }
  | { label: string; value: number; kind: 'info' };

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

function getStatusRank(status: AgentStatus) {
  return {
    pending: 0,
    active: 1,
    inactive: 2,
  }[status];
}

function getDefaultAgentSort(): AgentSort {
  return { field: 'createdAt', direction: 'desc' };
}

function getDefaultSortDirection(field: AgentSortField): SortDirection {
  return field === 'createdAt' || field === 'lastLoginAt' ? 'desc' : 'asc';
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

function sortAgents(agents: LosUser[], sortBy: AgentSort) {
  const sorted = [...agents];
  const directionFactor = sortBy.direction === 'asc' ? 1 : -1;

  sorted.sort((left, right) => {
    let comparison = 0;

    switch (sortBy.field) {
      case 'fullName':
        comparison = compareText(left.fullName, right.fullName);
        break;
      case 'email':
        comparison = compareText(left.email, right.email);
        break;
      case 'role':
        comparison = compareText(left.userRole?.name ?? '', right.userRole?.name ?? '');
        break;
      case 'manager':
        comparison = compareText(left.manager?.fullName ?? '', right.manager?.fullName ?? '');
        break;
      case 'status':
        comparison = getStatusRank(getAgentStatus(left)) - getStatusRank(getAgentStatus(right));
        break;
      case 'lastLoginAt': {
        const missingLoginComparison = Number(!left.lastLoginAt) - Number(!right.lastLoginAt);
        if (missingLoginComparison !== 0) return missingLoginComparison;
        comparison = new Date(left.lastLoginAt!).getTime() - new Date(right.lastLoginAt!).getTime();
        break;
      }
      case 'createdAt':
      default:
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        break;
    }

    if (comparison !== 0) return comparison * directionFactor;

    return compareText(left.fullName, right.fullName) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return sorted;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ name }: { name: string | null | undefined }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[0.82rem] font-extrabold bg-[rgba(20,150,243,0.1)] text-[#0c2e7a]">
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

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <span className="inline-flex flex-col justify-center leading-none" aria-hidden>
      <svg
        width={11}
        height={11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active && direction === 'asc' ? 'text-brand-blue' : 'text-[rgba(23,44,113,0.24)]'}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
      <svg
        width={11}
        height={11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${active && direction === 'desc' ? 'text-brand-blue' : 'text-[rgba(23,44,113,0.24)]'} -mt-1`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
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

function SortHeader({
  label,
  field,
  sortBy,
  onSort,
}: {
  label: string;
  field: AgentSortField;
  sortBy: AgentSort;
  onSort: (field: AgentSortField) => void;
}) {
  const isActive = sortBy.field === field;

  return (
    <th
      aria-sort={isActive ? (sortBy.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 rounded-[6px] bg-transparent p-0 text-left text-inherit transition-colors hover:text-brand-text"
      >
        <span>{label}</span>
        <SortIndicator active={isActive} direction={sortBy.direction} />
      </button>
    </th>
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
        className="w-full max-w-[480px] rounded-[20px] border border-[rgba(23,44,113,0.12)] shadow-[0_32px_64px_rgba(23,44,113,0.22)] p-6"
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
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer hover:-translate-y-px transition-transform"
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
            <div className="rounded-[10px] p-[12px_14px] border border-[rgba(20,150,243,0.16)] bg-[rgba(20,150,243,0.06)] text-[0.84rem] text-brand-text">
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
              className="flex-1 min-h-[38px] rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors"
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
  const [modal, setModal] = useState<{ mode: ModalMode; agent?: LosUser } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<AgentSort>(getDefaultAgentSort);
  const [todayOnly, setTodayOnly] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

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

  useEffect(() => { loadData(); }, [loadData]);

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
    setModal(null);
  }

  function resetView() {
    setSearch('');
    setStatusFilter('all');
    setRoleFilter('all');
    setSortBy(getDefaultAgentSort());
    setTodayOnly(false);
    setExpandedAgentId(null);
  }

  function handleSort(field: AgentSortField) {
    setSortBy((current) => (
      current.field === field
        ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: getDefaultSortDirection(field) }
    ));
  }

  function handleStatFilter(nextStatus: AgentStatusFilter) {
    setSearch('');
    setRoleFilter('all');
    setTodayOnly(false);
    setStatusFilter((current) => (current === nextStatus ? 'all' : nextStatus));
  }

  function handleTodayAgentsFilter() {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setTodayOnly((current) => !current);
  }

  const searchTerm = search.trim().toLowerCase();

  const filtered = agents.filter((agent) => {
    const status = getAgentStatus(agent);
    const matchesSearch = searchTerm === ''
      || agent.fullName.toLowerCase().includes(searchTerm)
      || agent.email.toLowerCase().includes(searchTerm)
      || (agent.userRole?.name ?? '').toLowerCase().includes(searchTerm)
      || (agent.manager?.fullName ?? '').toLowerCase().includes(searchTerm)
      || (agent.manager?.email ?? '').toLowerCase().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesRole = roleFilter === 'all' || agent.roleId === roleFilter;
    const matchesToday = !todayOnly || signedInToday(agent);

    return matchesSearch && matchesStatus && matchesRole && matchesToday;
  });
  const visibleAgents = sortAgents(filtered, sortBy);
  const directReportsByManager = getDirectReportsByManager(agents);
  const sortedRoles = [...roles].sort((left, right) => (
    left.hierarchyLevel - right.hierarchyLevel || compareText(left.name, right.name)
  ));
  const hasNarrowingFilters = searchTerm !== '' || statusFilter !== 'all' || roleFilter !== 'all' || todayOnly;
  const hasViewChanges = hasNarrowingFilters || sortBy.field !== 'createdAt' || sortBy.direction !== 'desc';

  const totalPending = agents.filter((a) => getAgentStatus(a) === 'pending').length;
  const totalActive = agents.filter((a) => getAgentStatus(a) === 'active').length;
  const totalInactive = agents.filter((a) => getAgentStatus(a) === 'inactive').length;
  const totalSignedInToday = agents.filter(signedInToday).length;
  const statCards: AgentStatCard[] = [
    { label: 'Total agents', value: agents.length, kind: 'status', filterStatus: 'all' },
    { label: 'Pending', value: totalPending, kind: 'status', filterStatus: 'pending' },
    { label: 'Active', value: totalActive, kind: 'status', filterStatus: 'active' },
    { label: 'Inactive', value: totalInactive, kind: 'status', filterStatus: 'inactive' },
    { label: "Today's agents", value: totalSignedInToday, kind: 'today' },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => {
          const isFilterCard = stat.kind !== 'info';
          const isSelected = stat.kind === 'status'
            ? statusFilter === stat.filterStatus
            : stat.kind === 'today'
            ? todayOnly
            : false;

          const cardClassName = `rounded-[8px] border px-4 py-3 text-left transition-colors ${
            isSelected
              ? 'border-[rgba(20,150,243,0.4)] bg-[rgba(20,150,243,0.08)]'
              : 'border-[rgba(23,44,113,0.1)]'
          } ${
            isFilterCard
              ? 'cursor-pointer hover:border-[rgba(20,150,243,0.24)] hover:bg-[rgba(20,150,243,0.04)]'
              : ''
          }`;

          const cardBody = (
            <>
              <span className="block text-[0.78rem] text-brand-muted">{stat.label}</span>
              <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
                {loading ? '—' : stat.value}
              </strong>
            </>
          );

          if (stat.kind === 'info') {
            return (
              <div
                key={stat.label}
                className={cardClassName}
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
              >
                {cardBody}
              </div>
            );
          }

          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                if (stat.kind === 'status') {
                  handleStatFilter(stat.filterStatus);
                  return;
                }

                handleTodayAgentsFilter();
              }}
              className={cardClassName}
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
              aria-pressed={isSelected}
            >
              {cardBody}
            </button>
          );
        })}
      </div>

      {/* Main card */}
      <div
        className="rounded-[10px] border border-[rgba(23,44,113,0.1)] overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[rgba(23,44,113,0.07)]">
          <div>
            <span className="block text-[0.72rem] font-extrabold tracking-[0.14em] uppercase text-brand-blue">
              Agent directory
            </span>
            <h2 className="m-0 text-[1.15rem] font-extrabold leading-tight tracking-[-0.02em]">
              All Agents
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="los-btn-primary whitespace-nowrap"
            >
              + Add Agent
            </button>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-3 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_repeat(2,minmax(0,0.95fr))_auto]">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Search
            </span>
            <input
              type="search"
              placeholder="Name, email, role or manager…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AgentStatusFilter)}
              className="los-input appearance-none cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Role
            </span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="los-input appearance-none cursor-pointer"
            >
              <option value="all">All roles</option>
              {sortedRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetView}
              disabled={!hasViewChanges}
              className="min-h-[42px] w-full rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] px-4 font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset View
            </button>
          </div>
        </div>

        {!loading && !fetchError ? (
          <div className="px-4 py-2 border-b border-[rgba(23,44,113,0.07)] text-[0.8rem] text-brand-muted">
            Showing {visibleAgents.length} of {agents.length} agents
          </div>
        ) : null}

        {notice ? (
          <div className="mx-4 mt-4 rounded-[10px] border border-[rgba(34,197,94,0.18)] bg-[rgba(240,253,244,0.9)] px-4 py-3 text-[0.86rem] text-[#166534]">
            {notice}
          </div>
        ) : null}

        {/* Body */}
        {fetchError ? (
          <div className="p-6 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">Loading agents…</div>
        ) : visibleAgents.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">
            {hasNarrowingFilters ? 'No agents match the current filters.' : 'No agents yet — add the first one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.8)]">
                  <SortHeader label="Name" field="fullName" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Email" field="email" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Role" field="role" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Reporting manager" field="manager" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Status" field="status" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Last logged in" field="lastLoginAt" sortBy={sortBy} onSort={handleSort} />
                  <SortHeader label="Added" field="createdAt" sortBy={sortBy} onSort={handleSort} />
                  <th className="px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((agent, idx) => {
                  const directReports = directReportsByManager[agent.id] ?? [];
                  const isExpanded = expandedAgentId === agent.id;
                  const status = getAgentStatus(agent);

                  return (
                    <Fragment key={agent.id}>
                      <tr
                        className={`border-b border-[rgba(23,44,113,0.05)] transition-colors ${
                          isExpanded ? 'border-b-0 bg-[rgba(20,150,243,0.03)]' : 'hover:bg-[rgba(20,150,243,0.03)]'
                        } ${!isExpanded && idx === visibleAgents.length - 1 ? 'border-b-0' : ''}`}
                      >
                        {/* Name */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="flex-shrink-0 w-7 h-7 rounded-[6px] grid place-items-center font-extrabold text-[0.75rem] text-[#fff8df]"
                              style={{ background: 'linear-gradient(145deg, #1496f3, #172c71)' }}
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
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.82rem]">
                          <span className="block min-w-[220px] whitespace-normal break-all">{agent.email}</span>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-2.5">
                          <RoleBadge name={agent.userRole?.name} />
                        </td>

                        {/* Reporting manager */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.82rem]">
                          {agent.manager ? (
                            <div className="min-w-0">
                              <strong className="block whitespace-normal break-words text-brand-text text-[0.84rem]">
                                {agent.manager.fullName}
                              </strong>
                              <span className="block whitespace-normal break-all">{agent.manager.email}</span>
                            </div>
                          ) : (
                            <span className="block whitespace-nowrap">Top level</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5">
                          <StatusBadge status={status} />
                        </td>

                        {/* Last logged in */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">
                          {agent.lastLoginAt ? formatDateTime(agent.lastLoginAt) : 'Not signed in'}
                        </td>

                        {/* Added */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">
                          {formatDate(agent.createdAt)}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setModal({ mode: 'edit', agent })}
                              title="Edit agent"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer hover:border-[rgba(20,150,243,0.24)] transition-colors"
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
                                disabled
                                title="Pending invitation"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] border border-[rgba(245,158,11,0.2)] bg-[rgba(255,247,237,0.95)] text-[#9a6700] opacity-80"
                              >
                                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 7 12 12 15 15" />
                                </svg>
                                <span className="sr-only">Pending invitation</span>
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
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className={`border-b border-[rgba(23,44,113,0.05)] ${idx === visibleAgents.length - 1 ? 'border-b-0' : ''}`}>
                          <td colSpan={8} className="px-4 pb-4">
                            <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.75)] p-4">
                              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <span className="block text-[0.68rem] font-extrabold tracking-[0.12em] uppercase text-brand-blue">
                                    Under team
                                  </span>
                                  <h3 className="m-0 text-[1rem] font-extrabold tracking-[-0.02em] text-brand-text">
                                    {agent.fullName}
                                  </h3>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-[rgba(20,150,243,0.08)] px-3 py-1 text-[0.8rem] font-extrabold text-brand-blue">
                                  {teamMemberLabel(directReports.length)}
                                </span>
                              </div>

                              {directReports.length === 0 ? (
                                <p className="m-0 text-[0.84rem] text-brand-muted">
                                  No direct reports are assigned to this agent yet.
                                </p>
                              ) : (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {directReports.map((member) => (
                                    <div
                                      key={member.id}
                                      className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.9)] px-3 py-3"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="flex-shrink-0 w-8 h-8 rounded-[8px] grid place-items-center font-extrabold text-[0.75rem] text-[#fff8df]"
                                          style={{ background: 'linear-gradient(145deg, #1496f3, #172c71)' }}
                                          aria-hidden
                                        >
                                          {initials(member.fullName)}
                                        </span>
                                        <div className="min-w-0">
                                          <strong className="block whitespace-normal break-words text-[0.88rem] text-brand-text">
                                            {member.fullName}
                                          </strong>
                                          <span className="block whitespace-normal break-all text-[0.8rem] text-brand-muted">
                                            {member.email}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <RoleBadge name={member.userRole?.name} />
                                        <StatusBadge status={getAgentStatus(member)} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
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
