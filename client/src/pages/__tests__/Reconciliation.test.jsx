import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Reconciliation from '../Reconciliation';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../services/api';

function makeResult(i, matched = true) {
  return {
    paymentId: matched ? `PAY-${i}` : null,
    bankTransactionId: `BANK-${i}`,
    invoiceId: `INV-${i}`,
    status: matched ? 'MATCHED' : 'EXCEPTION',
    exceptionType: matched ? null : 'AMOUNT_MISMATCH',
    matchMethod: 'EXACT_REFERENCE',
    confidence: 0.95,
    paymentAmount: matched ? 1000 + i : 500,
    bankAmount: matched ? 1000 + i : 450,
    invoiceAmount: matched ? 1000 + i : 500,
    amountDifference: matched ? 0 : 50,
    dateDifferenceDays: matched ? 0 : 2,
  };
}

function makeData() {
  const results = Array.from({ length: 30 }, (_, i) => makeResult(i, i % 2 === 0));
  return {
    success: true,
    hasData: true,
    data: {
      dataset: { payments: 500, bankTransactions: 500, invoices: 500 },
      summary: {
        matched: 350,
        exceptions: 175,
        paymentMatchRate: 70,
        bankMatchRate: 73.68,
        invoiceMatchRate: 70,
        exceptionRate: 35,
      },
      exceptionDistribution: {
        MISSING_BANK_TRANSACTION: 50,
        AMOUNT_MISMATCH: 50,
        DUPLICATE_BANK_TRANSACTION: 25,
        DATE_MISMATCH: 25,
        UNMATCHED_BANK_TRANSACTION: 25,
      },
      financial: {
        totalPaymentAmount: 25079405.23,
        matchedPaymentAmount: 17486654.13,
        exceptionPaymentAmount: 7592751.1,
        amountMismatchImpact: 12012.7,
      },
      generatedAt: '2026-09-03T13:58:42.752Z',
      processingTimeMs: 25,
      results,
    },
  };
}

const okData = () => ({ data: makeData() });

describe('Reconciliation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with skeleton elements', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    render(<Reconciliation />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders dataset metrics from backend', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Bank Transactions')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('renders reconciliation metrics from backend', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('350')).toBeTruthy());
    expect(screen.getByText('Payment Match Rate')).toBeInTheDocument();
    expect(screen.getByText('Bank Match Rate')).toBeInTheDocument();
    expect(screen.getByText('Invoice Match Rate')).toBeInTheDocument();
    expect(screen.getByText('73.68%')).toBeInTheDocument();
  });

  it('renders results table with rows', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());
    expect(screen.getByText('BANK-0')).toBeInTheDocument();
    expect(screen.getByText('INV-0')).toBeInTheDocument();
  });

  it('filters results by status (Exceptions)', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Exceptions' }));
    await waitFor(() => expect(screen.queryByText('PAY-0')).not.toBeInTheDocument());
    expect(screen.getByText('BANK-1')).toBeInTheDocument();
  });

  it('searches results by ID', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Search payment, bank or invoice ID/), {
      target: { value: 'BANK-5' },
    });
    await waitFor(() => expect(screen.getByText('BANK-5')).toBeInTheDocument());
    expect(screen.queryByText('BANK-1')).not.toBeInTheDocument();
  });

  it('paginates results', async () => {
    api.get.mockResolvedValue(okData());
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('PAY-0')).toBeInTheDocument());
    const nextBtn = screen.getByRole('button', { name: /Next/ });
    expect(nextBtn).toBeEnabled();
    fireEvent.click(nextBtn);
    await waitFor(() => expect(screen.getByText('BANK-26')).toBeInTheDocument());
  });

  it('run reconciliation shows loading then success state', async () => {
    api.get.mockResolvedValue(okData());
    let resolvePost;
    api.post.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Run Reconciliation/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Run Reconciliation/ }));
    await waitFor(() => expect(screen.getByText('Running reconciliation...')).toBeInTheDocument());

    resolvePost(okData());
    await waitFor(() => expect(screen.getByText('Reconciliation completed')).toBeInTheDocument());
  });

  it('displays API error state with retry', async () => {
    api.get.mockRejectedValue({ response: { data: { error: { message: 'oops' } } } });
    render(<Reconciliation />);
    await waitFor(() => {
      expect(screen.getByText('Reconciliation failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });
  });

  it('displays empty state when no data', async () => {
    api.get.mockResolvedValue({ data: { success: true, hasData: false, data: null } });
    render(<Reconciliation />);
    await waitFor(() => expect(screen.getByText('No reconciliation results yet')).toBeInTheDocument());
  });
});
