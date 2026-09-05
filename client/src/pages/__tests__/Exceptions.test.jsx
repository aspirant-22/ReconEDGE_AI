import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Exceptions from '../Exceptions';

vi.mock('../../services/recApi', () => ({
  recApi: {
    getExceptions: vi.fn(),
    analyzeException: vi.fn(),
  },
}));

vi.mock('../../contexts/ReconciliationContext', () => ({
  useReconciliation: vi.fn(),
}));

import { recApi } from '../../services/recApi';
import { useReconciliation } from '../../contexts/ReconciliationContext';

function exceptionEntry(overrides = {}) {
  return {
    paymentId: 'PAY-1001',
    bankTransactionId: 'BANK-1001',
    invoiceId: null,
    paymentAmount: 12500,
    bankAmount: 13500,
    amountDifference: 1000,
    status: 'EXCEPTION',
    exceptionType: 'AMOUNT_MISMATCH',
    severity: 'MEDIUM',
    workflowStatus: 'OPEN',
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <Exceptions />
    </MemoryRouter>
  );
}

function runContext(overrides = {}) {
  return { runs: [], runsLoading: false, selectedRunId: null, selectedRun: null, setSelectedRunId: vi.fn(), ...overrides };
}

describe('Exceptions Page (Phase 12)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders workflow summary cards and badges for a real run', async () => {
    useReconciliation.mockReturnValue(runContext({ selectedRunId: 'r1', selectedRun: { name: 'June Recon' } }));
    recApi.getExceptions.mockResolvedValue({
      data: {
        data: [exceptionEntry(), exceptionEntry({ paymentId: 'PAY-1002', workflowStatus: 'RESOLVED' })],
        workflow: { total: 2, open: 1, inReview: 0, resolved: 1, rejected: 0, escalated: 0, resolutionRate: 50 },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('workflow-summary')).toBeInTheDocument());
    expect(screen.getByText('Resolution Rate')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
  });

  it('passes the workflow status filter to the backend', async () => {
    useReconciliation.mockReturnValue(runContext({ selectedRunId: 'r1', selectedRun: { name: 'June Recon' } }));
    recApi.getExceptions.mockResolvedValue({
      data: {
        data: [exceptionEntry({ workflowStatus: 'IN_REVIEW' })],
        workflow: { total: 1, open: 0, inReview: 1, resolved: 0, rejected: 0, escalated: 0, resolutionRate: 0 },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('workflow status filter')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('workflow status filter'), { target: { value: 'IN_REVIEW' } });
    fireEvent.click(screen.getByText('Apply Filters'));
    await waitFor(() =>
      expect(recApi.getExceptions).toHaveBeenLastCalledWith('r1', expect.objectContaining({ workflowStatus: 'IN_REVIEW' }))
    );
  });

  it('shows a Review link that opens the exception detail page', async () => {
    useReconciliation.mockReturnValue(runContext({ selectedRunId: 'r1', selectedRun: { name: 'June Recon' } }));
    recApi.getExceptions.mockResolvedValue({
      data: {
        data: [exceptionEntry()],
        workflow: { total: 1, open: 1, inReview: 0, resolved: 0, rejected: 0, escalated: 0, resolutionRate: 0 },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Review')).toBeInTheDocument());
    expect(screen.getByText('Review').closest('a')).toHaveAttribute('href', '/exceptions/r1/PAY-1001');
  });

  it('does not render workflow widgets in demo mode', async () => {
    useReconciliation.mockReturnValue(runContext({}));
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => [exceptionEntry()],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('PAY-1001')).toBeInTheDocument());
    expect(screen.queryByTestId('workflow-summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
  });
});
