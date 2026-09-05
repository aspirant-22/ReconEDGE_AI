import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExceptionDetail from '../ExceptionDetail';

vi.mock('../../services/recApi', () => ({
  recApi: {
    getException: vi.fn(),
    getExceptionHistory: vi.fn(),
    resolutionAction: vi.fn(),
    analyzeException: vi.fn(),
  },
}));

import { recApi } from '../../services/recApi';

function exceptionEntry(overrides = {}) {
  return {
    resultId: 'res1',
    exceptionId: 'PAY-1001',
    paymentId: 'PAY-1001',
    bankTransactionId: 'BANK-1001',
    invoiceId: 'INV-1001',
    status: 'EXCEPTION',
    exceptionType: 'AMOUNT_MISMATCH',
    matchMethod: 'PRIMARY',
    paymentAmount: 12500,
    bankAmount: 13500,
    amountDifference: 1000,
    paymentDate: '2026-06-01',
    bankDate: '2026-06-01',
    dateDifferenceDays: 0,
    severity: 'MEDIUM',
    workflowStatus: 'OPEN',
    lastAction: null,
    resolutionCode: null,
    resolutionReason: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    run: { id: 'r1', name: 'June Recon', status: 'COMPLETED', isArchived: false },
    ...overrides,
  };
}

function historyEntry(overrides = {}) {
  return {
    id: 'h1',
    action: 'START_REVIEW',
    previousStatus: 'OPEN',
    newStatus: 'IN_REVIEW',
    resolutionCode: null,
    reason: null,
    notes: null,
    userName: 'Deepika',
    timestamp: '2026-06-10T10:00:00.000Z',
    exceptionId: 'PAY-1001',
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/exceptions/r1/PAY-1001']}>
      <Routes>
        <Route path="/exceptions/:runId/:exceptionId" element={<ExceptionDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExceptionDetail Page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders financial evidence and open workflow state', async () => {
    recApi.getException.mockResolvedValue({ data: { data: exceptionEntry() } });
    recApi.getExceptionHistory.mockResolvedValue({ data: { data: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Exception Detail')).toBeInTheDocument());
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('PAY-1001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/12,500/)).toBeInTheDocument();
    expect(screen.getByText(/13,500/)).toBeInTheDocument();
    expect(screen.getByText('Human Resolution')).toBeInTheDocument();
    expect(screen.getByTestId('action-start-review')).toBeInTheDocument();
  });

  it('resolving enters a code, calls the API and shows confirmation', async () => {
    recApi.getException
      .mockResolvedValueOnce({ data: { data: exceptionEntry() } })
      .mockResolvedValue({ data: { data: exceptionEntry({ workflowStatus: 'RESOLVED', resolutionCode: 'BANK_FEE', resolvedAt: '2026-06-10T11:00:00.000Z' }) } });
    recApi.getExceptionHistory
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValue({ data: { data: [historyEntry({ action: 'RESOLVE', previousStatus: 'OPEN', newStatus: 'RESOLVED' })] } });
    recApi.resolutionAction.mockResolvedValue({ data: { success: true } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('action-resolve')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('action-resolve'));
    await waitFor(() => expect(screen.getByTestId('resolution-code-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('resolution-code-select'), { target: { value: 'BANK_FEE' } });
    fireEvent.change(screen.getByTestId('resolution-notes'), { target: { value: 'Bank fee confirmed on statement.' } });
    fireEvent.click(screen.getByTestId('confirm-RESOLVE'));
    await waitFor(() => expect(recApi.resolutionAction).toHaveBeenCalledTimes(1));
    expect(recApi.resolutionAction).toHaveBeenCalledWith('r1', 'PAY-1001', {
      action: 'RESOLVE',
      resolutionCode: 'BANK_FEE',
      reason: undefined,
      notes: 'Bank fee confirmed on statement.',
    });
    await waitFor(() => expect(screen.getByTestId('ack-banner')).toBeInTheDocument());
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
  });

  it('rejecting requires a reason before confirming', async () => {
    recApi.getException.mockResolvedValue({ data: { data: exceptionEntry() } });
    recApi.getExceptionHistory.mockResolvedValue({ data: { data: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('action-reject')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('action-reject'));
    await waitFor(() => expect(screen.getByTestId('resolution-reason')).toBeInTheDocument());
    expect(screen.getByTestId('confirm-REJECT')).toBeDisabled();
    fireEvent.change(screen.getByTestId('resolution-reason'), { target: { value: 'No matching bank record in the period.' } });
    fireEvent.click(screen.getByTestId('confirm-REJECT'));
    await waitFor(() => expect(recApi.resolutionAction).toHaveBeenCalledTimes(1));
    expect(recApi.resolutionAction).toHaveBeenCalledWith('r1', 'PAY-1001', {
      action: 'REJECT',
      resolutionCode: undefined,
      reason: 'No matching bank record in the period.',
      notes: undefined,
    });
  });

  it('archived runs are read-only', async () => {
    recApi.getException.mockResolvedValue({ data: { data: exceptionEntry({ run: { id: 'r1', name: 'June Recon', status: 'COMPLETED', isArchived: true } }) } });
    recApi.getExceptionHistory.mockResolvedValue({ data: { data: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/read-only/)).toBeInTheDocument());
    expect(screen.queryByTestId('action-resolve')).not.toBeInTheDocument();
  });

  it('displays the resolution history timeline', async () => {
    recApi.getException.mockResolvedValue({ data: { data: exceptionEntry() } });
    recApi.getExceptionHistory.mockResolvedValue({
      data: {
        data: [
          historyEntry({ action: 'RESOLVE', previousStatus: 'OPEN', newStatus: 'RESOLVED', resolutionCode: 'BANK_FEE', reason: 'Bank fee applied.', userName: 'Deepika' }),
          historyEntry({ id: 'h0', action: 'START_REVIEW', previousStatus: 'OPEN', newStatus: 'IN_REVIEW' }),
        ],
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Resolution History')).toBeInTheDocument());
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bank Fee').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bank fee applied.')).toBeInTheDocument();
  });

  it('shows a not-found state for missing exceptions', async () => {
    recApi.getException.mockRejectedValue({ response: { status: 404, data: { error: { message: 'No exception record found for ID: PAY-1001' } } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Exception not found')).toBeInTheDocument());
  });
});