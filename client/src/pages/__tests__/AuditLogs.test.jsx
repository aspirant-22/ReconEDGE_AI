import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLogs from '../AuditLogs';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../../services/api';

vi.mock('../../contexts/ReconciliationContext', () => ({
  useReconciliation: vi.fn(),
}));

import { useReconciliation } from '../../contexts/ReconciliationContext';

const ACTIONS = ['LOGIN', 'LOGOUT', 'RECONCILIATION_RUN', 'EXCEPTION_ANALYSIS', 'FINANCE_QA_QUERY'];

function makeLog(i) {
  return {
    id: `log-${i}`,
    timestamp: new Date(2026, 8, 4, 4, 15 + i).toISOString(),
    userId: 'u1',
    userName: 'Swati',
    action: ACTIONS[i % ACTIONS.length],
    resource: 'AUTH',
    resourceId: i % 2 === 0 ? `res-${i}` : null,
    status: 'SUCCESS',
    metadata: {},
  };
}

function makeResponse(logs) {
  const rows = logs || Array.from({ length: 30 }, (_, i) => makeLog(i));
  return {
    success: true,
    logs: rows,
    pagination: { total: rows.length, page: 1, limit: 25, pages: Math.ceil(rows.length / 25) },
  };
}

const okData = (logs) => ({ data: makeResponse(logs) });

describe('Audit Logs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReconciliation.mockReturnValue({ runs: [], runsLoading: false, selectedRunId: null, setSelectedRunId: vi.fn(), selectedRun: null, refreshRuns: vi.fn() });
  });

  it('renders loading state with skeleton', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders audit log rows', async () => {
    api.get.mockResolvedValue(okData());
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Swati').length).toBeGreaterThan(0));
    expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0);
  });

  it('filters by action and applies', async () => {
    api.get.mockResolvedValue(okData());
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Swati').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText(/action filter/), { target: { value: 'LOGIN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() => {
      const call = api.get.mock.calls.find((c) => c[1]?.params?.action === 'LOGIN');
      expect(call).toBeTruthy();
    });
  });

  it('filters by status and applies', async () => {
    api.get.mockResolvedValue(okData());
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Swati').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText(/status filter/), { target: { value: 'FAILED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() => {
      const call = api.get.mock.calls.find((c) => c[1]?.params?.status === 'FAILED');
      expect(call).toBeTruthy();
    });
  });

  it('searches via Enter', async () => {
    api.get.mockResolvedValue(okData());
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Swati').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText(/Search action, resource, user/), {
      target: { value: 'recon' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Search action, resource, user/), { key: 'Enter' });

    await waitFor(() => {
      const call = api.get.mock.calls.find((c) => c[1]?.params?.search === 'recon');
      expect(call).toBeTruthy();
    });
  });

  it('paginates results', async () => {
    api.get.mockResolvedValue(okData());
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Swati').length).toBeGreaterThan(0));

    const nextBtn = screen.getByRole('button', { name: /Next/ });
    expect(nextBtn).toBeEnabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      const call = api.get.mock.calls.find((c) => c[1]?.params?.page === 2);
      expect(call).toBeTruthy();
    });
  });

  it('displays empty state when no logs', async () => {
    api.get.mockResolvedValue(okData([]));
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('No audit activity yet')).toBeInTheDocument());
  });

  it('displays API error state with retry', async () => {
    api.get.mockRejectedValue({ response: { data: { error: { message: 'boom' } } } });
    render(<MemoryRouter><AuditLogs /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Unable to load audit logs')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });
  });
});
