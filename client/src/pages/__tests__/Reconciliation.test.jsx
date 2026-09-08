import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Reconciliation from '../Reconciliation';

vi.mock('../../services/recApi', () => ({
  recApi: {
    getRun: vi.fn(),
    getAnalytics: vi.fn(),
    getResults: vi.fn(),
  },
}));

vi.mock('../../contexts/ReconciliationContext', () => ({
  useReconciliation: vi.fn(),
}));

import { recApi } from '../../services/recApi';
import { useReconciliation } from '../../contexts/ReconciliationContext';

const RUNS = [
  { id: 'r1', name: 'June Recon', status: 'COMPLETED', processingTimeMs: 12 },
  { id: 'r2', name: 'July Recon', status: 'COMPLETED', processingTimeMs: 9 },
];

const ANALYTICS = {
  overview: {
    totalPayments: 500,
    totalBankTransactions: 500,
    totalInvoices: 500,
    matchedRecords: 350,
    totalExceptions: 175,
    exceptionRate: 35,
  },
  matching: {
    paymentMatchRate: 70,
    bankMatchRate: 73.68,
    invoiceMatchRate: 70,
  },
  exceptions: {
    breakdown: {
      AMOUNT_MISMATCH: { count: 50, percentageOfExceptions: 28.57 },
      MISSING_BANK_TRANSACTION: { count: 50, percentageOfExceptions: 28.57 },
    },
  },
};

function result(i) {
  return {
    paymentId: `PAY-${i}`,
    bankTransactionId: `BANK-${i}`,
    invoiceId: `INV-${i}`,
    status: i % 2 === 0 ? 'MATCHED' : 'EXCEPTION',
    exceptionType: i % 2 === 0 ? null : 'AMOUNT_MISMATCH',
    paymentAmount: 1000 + i,
    bankAmount: 1000 + i,
    invoiceAmount: 1000 + i,
    confidence: 0.95,
    dateDifferenceDays: 0,
  };
}

function defaultContext(overrides = {}) {
  return {
    runs: RUNS,
    runsLoading: false,
    selectedRunId: 'r1',
    selectedRun: RUNS[0],
    setSelectedRunId: vi.fn(),
    refreshRuns: vi.fn(),
    ...overrides,
  };
}

function mockLoad({ run = RUNS[0], analytics = ANALYTICS, results = [result(0), result(1)], total = 2 } = {}) {
  recApi.getRun.mockResolvedValue({ data: { data: run } });
  recApi.getAnalytics.mockResolvedValue({ data: { data: analytics } });
  recApi.getResults.mockResolvedValue({
    data: { data: results, pagination: { total, page: 1, limit: 25 } },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reconciliation']}>
      <Routes>
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/reconciliation/runs/new" element={<div>NEW-RUN-PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Reconciliation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReconciliation.mockReturnValue(defaultContext());
  });

  it('renders loading skeletons while runs are loading', () => {
    useReconciliation.mockReturnValue(defaultContext({ runs: [], runsLoading: true, selectedRunId: null, selectedRun: null }));
    renderPage();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders the selected run stats from analytics', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('350')).toBeInTheDocument());
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Bank Transactions')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getAllByText('70.00%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('73.68%')).toBeInTheDocument();
    expect(screen.getByText(/Viewing reconciliation run:/)).toBeInTheDocument();
    expect(screen.getByText('June Recon')).toBeInTheDocument();
  });

  it('renders the results table with rows from the run', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());
    expect(screen.getByText('BANK-0')).toBeInTheDocument();
    expect(screen.getByText('INV-0')).toBeInTheDocument();
    expect(recApi.getResults).toHaveBeenCalledWith('r1', expect.objectContaining({ page: 1, limit: 25 }));
  });

  it('renders the exception breakdown section', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('Exception Breakdown')).toBeInTheDocument());
    expect(screen.getAllByText('Amount Mismatch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Missing Bank Txn')).toBeInTheDocument();
  });

  it('auto-selects the most recent run when none is selected', async () => {
    const setSelectedRunId = vi.fn();
    useReconciliation.mockReturnValue(defaultContext({ selectedRunId: null, selectedRun: null, setSelectedRunId }));
    mockLoad();
    renderPage();
    await waitFor(() => expect(setSelectedRunId).toHaveBeenCalledWith('r1'));
    expect(recApi.getRun).not.toHaveBeenCalled();
  });

  it('does not auto-select when a run is already selected', async () => {
    const setSelectedRunId = vi.fn();
    useReconciliation.mockReturnValue(defaultContext({ selectedRunId: 'r2', selectedRun: RUNS[1], setSelectedRunId }));
    mockLoad({ run: RUNS[1] });
    renderPage();
    await waitFor(() => expect(recApi.getRun).toHaveBeenCalledWith('r2'));
    expect(setSelectedRunId).not.toHaveBeenCalled();
    expect(recApi.getRun).not.toHaveBeenCalledWith('r1');
  });

  it('switches runs through the Run selector', async () => {
    const setSelectedRunId = vi.fn();
    useReconciliation.mockReturnValue(defaultContext({ setSelectedRunId }));
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Run')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Run'), { target: { value: 'r2' } });
    expect(setSelectedRunId).toHaveBeenCalledWith('r2');
  });

  it('never offers the demo dataset option on this page', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Run')).toBeInTheDocument());
    expect(screen.queryByText(/Demo dataset/)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Select a reconciliation run' })).toBeInTheDocument();
  });

  it('passes status, exception type, and search filters to getResults', async () => {
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Exceptions' }));

    const typeSelect = screen.getByText('All Exceptions').closest('select');
    fireEvent.change(typeSelect, { target: { value: 'AMOUNT_MISMATCH' } });

    fireEvent.change(screen.getByPlaceholderText(/Search payment, bank or invoice ID/), {
      target: { value: 'BANK-1' },
    });

    await waitFor(() =>
      expect(recApi.getResults).toHaveBeenLastCalledWith(
        'r1',
        expect.objectContaining({
          status: 'EXCEPTION',
          exceptionType: 'AMOUNT_MISMATCH',
          search: 'BANK-1',
        })
      )
    );
  });

  it('paginates results on the server', async () => {
    mockLoad({ total: 60 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());
    const nextBtn = screen.getByRole('button', { name: /Next/ });
    expect(nextBtn).toBeEnabled();
    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(recApi.getResults).toHaveBeenLastCalledWith('r1', expect.objectContaining({ page: 2 }))
    );
  });

  it('renders gracefully when analytics are unavailable', async () => {
    recApi.getRun.mockResolvedValue({ data: { data: RUNS[0] } });
    recApi.getAnalytics.mockRejectedValue(new Error('boom'));
    recApi.getResults.mockResolvedValue({ data: { data: [], pagination: { total: 0, page: 1, limit: 25 } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Exception Breakdown')).toBeInTheDocument());
    expect(screen.getByText('No exceptions detected.')).toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    useReconciliation.mockReturnValue(defaultContext({ runs: [], selectedRunId: null, selectedRun: null }));
    renderPage();
    await waitFor(() => expect(screen.getByText('No reconciliation runs yet.')).toBeInTheDocument());
    expect(screen.getByText(/Run a reconciliation to see your reconciliation dashboard/)).toBeInTheDocument();
    expect(recApi.getRun).not.toHaveBeenCalled();
    expect(recApi.getResults).not.toHaveBeenCalled();
    expect(screen.queryByText('350')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments Processed')).not.toBeInTheDocument();
  });

  it('navigates to the new run wizard from the empty state', async () => {
    useReconciliation.mockReturnValue(defaultContext({ runs: [], selectedRunId: null, selectedRun: null }));
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Run Reconciliation/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Run Reconciliation/ }));
    expect(screen.getByText('NEW-RUN-PAGE')).toBeInTheDocument();
  });
});