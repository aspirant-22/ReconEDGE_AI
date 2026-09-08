import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Dashboard from '../Dashboard';

const mockDashboardData = {
  overview: {
    paymentsProcessed: 500,
    matchedPayments: 350,
    exceptions: 175,
    exceptionRate: 35,
  },
  reconciliation: {
    paymentMatchRate: 70,
    bankMatchRate: 73.68,
    invoiceMatchRate: 70,
    bankAssignmentAccuracy: 100,
    reconciliationRate: 70,
  },
  control: {
    health: 'CRITICAL',
    healthReason: 'Exception rate is 35%, exceeding the critical threshold of 25%.',
    reconciliationRate: 70,
    exceptionRate: 35,
    cleanMatchRate: 70,
    exceptionDetection: {
      precision: 100,
      recall: 100,
      f1: 100,
    },
  },
  exceptions: {
    total: 175,
    breakdown: {
      MISSING_BANK_TRANSACTION: { count: 50, percentageOfExceptions: 28.57 },
      AMOUNT_MISMATCH: { count: 50, percentageOfExceptions: 28.57 },
      DUPLICATE_BANK_TRANSACTION: { count: 25, percentageOfExceptions: 14.29 },
      DATE_MISMATCH: { count: 25, percentageOfExceptions: 14.29 },
      UNMATCHED_BANK_TRANSACTION: { count: 25, percentageOfExceptions: 14.29 },
    },
    severity: {
      high: 100,
      medium: 75,
      low: 0,
      highPercentage: 57.14,
      mediumPercentage: 42.86,
      lowPercentage: 0,
    },
  },
  financial: {
    totalPaymentAmount: 25079405.23,
    matchedPaymentAmount: 17486654.13,
    exceptionPaymentAmount: 7592751.1,
    amountMismatchImpact: 12012.7,
  },
  topExceptions: [
    { type: 'MISSING_BANK_TRANSACTION', count: 50, percentage: 28.57 },
    { type: 'AMOUNT_MISMATCH', count: 50, percentage: 28.57 },
    { type: 'DUPLICATE_BANK_TRANSACTION', count: 25, percentage: 14.29 },
    { type: 'DATE_MISMATCH', count: 25, percentage: 14.29 },
    { type: 'UNMATCHED_BANK_TRANSACTION', count: 25, percentage: 14.29 },
  ],
  recentExceptions: [
    {
      paymentId: 'PAY-001',
      bankTransactionId: 'BANK-001',
      invoiceId: 'INV-001',
      exceptionType: 'AMOUNT_MISMATCH',
      paymentAmount: 5000,
      bankAmount: 4800,
      amountDifference: 200,
      dateDifferenceDays: 1,
      status: 'EXCEPTION',
    },
    {
      paymentId: 'PAY-002',
      bankTransactionId: null,
      invoiceId: 'INV-002',
      exceptionType: 'MISSING_BANK_TRANSACTION',
      paymentAmount: 3000,
      bankAmount: null,
      amountDifference: 0,
      dateDifferenceDays: 0,
      status: 'EXCEPTION',
    },
  ],
  generatedAt: '2026-09-03T13:58:42.752Z',
};

vi.mock('../../hooks/useDashboardData', () => ({
  useDashboardData: vi.fn(),
}));

vi.mock('../../contexts/ReconciliationContext', () => ({
  useReconciliation: vi.fn(),
}));

vi.mock('../../services/recApi', () => ({
  recApi: {},
}));

import { useDashboardData } from '../../hooks/useDashboardData';
import { useReconciliation } from '../../contexts/ReconciliationContext';

function defaultRecon() {
  return {
    runs: [{ id: 'r1', name: 'June Recon', status: 'COMPLETED' }],
    runsLoading: false,
    selectedRunId: 'r1',
    setSelectedRunId: vi.fn(),
    selectedRun: { id: 'r1', name: 'June Recon', status: 'COMPLETED' },
    refreshRuns: vi.fn(),
  };
}

function demoRecon() {
  return {
    runs: [],
    runsLoading: false,
    selectedRunId: null,
    setSelectedRunId: vi.fn(),
    selectedRun: null,
    refreshRuns: vi.fn(),
  };
}

function renderDashboard(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReconciliation.mockReturnValue(defaultRecon());
  });

  it('renders loading state with skeleton elements', () => {
    useDashboardData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders error state with retry button', () => {
    const refetch = vi.fn();
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: 'Unable to load dashboard data. Please try again.',
      lastUpdated: null,
      refetch,
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByRole('heading', { name: /Financial Control Dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getAllByText(/Unable to load dashboard data/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no data', () => {
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByRole('heading', { name: /Financial Control Dashboard/ })).toBeInTheDocument();
    expect(screen.getByText(/No reconciliation data available yet/)).toBeInTheDocument();
  });

  it('renders KPI cards with real backend values', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: new Date(),
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Payments Processed')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('Exceptions')).toBeInTheDocument();
    expect(screen.getByText('175')).toBeInTheDocument();
    expect(screen.getAllByText('Exception Rate').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('35.00%')).toBeInTheDocument();
  });

  it('renders reconciliation health with backend values', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Reconciliation Health')).toBeInTheDocument();
    expect(screen.getByText('Payment Match Rate')).toBeInTheDocument();
    expect(screen.getByText('Bank Match Rate')).toBeInTheDocument();
    expect(screen.getAllByText('70%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders control health as CRITICAL', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Control Health')).toBeInTheDocument();
    const criticalElements = screen.getAllByText('CRITICAL');
    expect(criticalElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders exception distribution chart section', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Exception Distribution')).toBeInTheDocument();
  });

  it('renders financial impact with real amounts', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Financial Impact')).toBeInTheDocument();
    expect(screen.getByText('Total Payment Amount')).toBeInTheDocument();
    expect(screen.getByText('Matched Payment Amount')).toBeInTheDocument();
    expect(screen.getByText('Exception Payment Amount')).toBeInTheDocument();
    expect(screen.getByText('Amount Mismatch Impact')).toBeInTheDocument();
  });

  it('renders exception severity section', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Exception Severity')).toBeInTheDocument();
    expect(screen.getAllByText('HIGH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThanOrEqual(1);
  });

  it('renders top exceptions table', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Top Exceptions')).toBeInTheDocument();
    expect(screen.getByText('Missing Bank Transaction')).toBeInTheDocument();
  });

  it('renders recent exceptions section', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('Recent Exceptions')).toBeInTheDocument();
    expect(screen.getByText('PAY-001')).toBeInTheDocument();
    expect(screen.getByText('PAY-002')).toBeInTheDocument();
  });

  it('renders AI insights section', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText('AI Control Insights')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    const refetch = vi.fn();
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch,
    });

    renderDashboard(<Dashboard />);
    const refreshBtn = screen.getByRole('button', { name: /Refresh/ });
    expect(refreshBtn).toBeInTheDocument();
  });

  it('displays tagline', () => {
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.getByText(/Reconcile\. Detect\. Explain\. Resolve\./)).toBeInTheDocument();
  });

  it('shows a "no reconciliation data yet" empty state for a user with no runs', () => {
    useReconciliation.mockReturnValue(demoRecon());
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(useDashboardData).toHaveBeenCalledWith(null, expect.objectContaining({ enabled: false }));
    expect(screen.getByText('No reconciliation data yet.')).toBeInTheDocument();
    expect(screen.getByText(/Run a reconciliation or view stats for the demo dataset\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Reconciliation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Demo Stats/ })).toBeInTheDocument();
    expect(screen.queryByText('Payments Processed')).not.toBeInTheDocument();
  });

  it('does not fetch or show demo stats implicitly when no real runs exist', () => {
    useReconciliation.mockReturnValue(demoRecon());
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(screen.queryByText('Showing the demo sample dataset.')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments Processed')).not.toBeInTheDocument();
  });

  it('shows demo stats only after explicitly clicking View Demo Stats', () => {
    useReconciliation.mockReturnValue(demoRecon());
    useDashboardData.mockImplementation((runId, opts = {}) =>
      opts.enabled
        ? { data: mockDashboardData, loading: false, error: null, lastUpdated: new Date(), refetch: vi.fn() }
        : { data: null, loading: false, error: null, lastUpdated: null, refetch: vi.fn() }
    );

    renderDashboard(<Dashboard />);
    expect(screen.getByText('No reconciliation data yet.')).toBeInTheDocument();
    expect(screen.queryByText('Payments Processed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View Demo Stats/ }));
    expect(screen.getByText('Payments Processed')).toBeInTheDocument();
    expect(screen.getByText(/Showing the demo sample dataset\./)).toBeInTheDocument();
    expect(useDashboardData).toHaveBeenLastCalledWith(null, expect.objectContaining({ enabled: true }));
  });

  it('navigates to the create reconciliation page from the empty state', () => {
    useReconciliation.mockReturnValue(demoRecon());
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reconciliation/runs/new" element={<div>NEW-RUN-PAGE</div>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Run Reconciliation/ }));
    expect(screen.getByText('NEW-RUN-PAGE')).toBeInTheDocument();
  });

  it('renders real run stats without the demo banner', () => {
    useReconciliation.mockReturnValue(defaultRecon());
    useDashboardData.mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      lastUpdated: null,
      refetch: vi.fn(),
    });

    renderDashboard(<Dashboard />);
    expect(useDashboardData).toHaveBeenCalledWith('r1', expect.objectContaining({ enabled: true }));
    expect(screen.queryByText('Showing the demo sample dataset.')).not.toBeInTheDocument();
    expect(screen.getAllByText('June Recon').length).toBeGreaterThanOrEqual(1);
  });
});
