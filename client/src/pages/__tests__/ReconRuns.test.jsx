import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ReconRuns from '../ReconRuns';

vi.mock('../../services/recApi', () => ({
  recApi: { listRuns: vi.fn() },
}));

import { recApi } from '../../services/recApi';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/reconciliation/runs']}>
      <Routes>
        <Route path="/reconciliation/runs" element={<ReconRuns />} />
        <Route path="/reconciliation/runs/new" element={<div>NEW-WIZARD</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function runOver(id) {
  return {
    id,
    name: `Run ${id}`,
    status: 'COMPLETED',
    validPaymentCount: 5,
    validBankTransactionCount: 4,
    validInvoiceCount: 5,
    createdAt: '2026-09-01T10:00:00.000Z',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
  };
}

describe('ReconRuns Page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders empty state when there are no runs', async () => {
    recApi.listRuns.mockResolvedValue({ data: { data: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('No reconciliation runs yet')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Start a Reconciliation/ })).toBeInTheDocument();
  });

  it('renders a list of runs and navigates to the wizard', async () => {
    recApi.listRuns.mockResolvedValue({ data: { data: [runOver('r1'), runOver('r2')] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Run r1')).toBeInTheDocument());
    expect(screen.getByText('Run r2')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('Completed').length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /New Reconciliation/ }));
    await waitFor(() => expect(screen.getByText('NEW-WIZARD')).toBeInTheDocument());
  });

  it('shows an error when the API fails', async () => {
    recApi.listRuns.mockRejectedValue({ response: { data: { error: { message: 'boom' } } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
