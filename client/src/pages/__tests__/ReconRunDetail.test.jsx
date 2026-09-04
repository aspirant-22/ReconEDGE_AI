import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReconRunDetail from '../ReconRunDetail';

vi.mock('../../services/recApi', () => ({
  recApi: {
    getRun: vi.fn(),
    getAnalytics: vi.fn(),
    getResults: vi.fn(),
    executeRun: vi.fn(),
    analyzeException: vi.fn(),
  },
}));

import { recApi } from '../../services/recApi';

const RUN = {
  id: 'r1',
  name: 'June Recon',
  status: 'COMPLETED',
  matchedCount: 3,
  exceptionCount: 2,
  processingTimeMs: 12,
  paymentFile: { fileName: 'pay.csv', totalRows: 5, validRows: 5, invalidRows: 0 },
  bankFile: { fileName: 'bank.csv', totalRows: 4, validRows: 4, invalidRows: 0 },
  invoiceFile: { fileName: 'inv.csv', totalRows: 5, validRows: 5, invalidRows: 0 },
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/reconciliation/runs/r1']}>
      <Routes>
        <Route path="/reconciliation/runs/:runId" element={<ReconRunDetail />} />
        <Route path="/reconciliation/runs" element={<div>RUNS-LIST</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function result(i) {
  return {
    paymentId: `PAY-${i}`,
    bankTransactionId: `BANK-${i}`,
    invoiceId: null,
    status: i % 2 === 0 ? 'MATCHED' : 'EXCEPTION',
    exceptionType: i % 2 === 0 ? null : 'AMOUNT_MISMATCH',
    paymentAmount: 1000 + i,
    bankAmount: i % 2 === 0 ? 1000 + i : 900 + i,
  };
}

describe('ReconRunDetail Page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders run summary, uploads and results', async () => {
    recApi.getRun.mockResolvedValue({ data: { data: RUN } });
    recApi.getAnalytics.mockResolvedValue({ data: { data: { matching: { paymentMatchRate: 60 } } } });
    recApi.getResults.mockResolvedValue({
      data: { data: [result(0), result(1)], pagination: { total: 2, page: 1, limit: 25 } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('June Recon')).toBeInTheDocument());
    expect(screen.getByText('pay.csv')).toBeInTheDocument();
    expect(screen.getByText('PAY-0')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('analyzes an exception and shows the analysis modal', async () => {
    recApi.getRun.mockResolvedValue({ data: { data: RUN } });
    recApi.getAnalytics.mockResolvedValue({ data: { data: { matching: { paymentMatchRate: 60 } } } });
    recApi.getResults.mockResolvedValue({
      data: { data: [result(0), result(1)], pagination: { total: 2, page: 1, limit: 25 } },
    });
    recApi.analyzeException.mockResolvedValue({
      data: {
        exceptionId: 'PAY-1',
        exceptionType: 'AMOUNT_MISMATCH',
        analysis: {
          summary: 'Amount differs from bank record.',
          likelyCause: 'Bank fee applied.',
          recommendedActions: ['Verify bank charge'],
          riskLevel: 'MEDIUM',
        },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('analyze-PAY-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('analyze-PAY-1'));
    await waitFor(() => expect(screen.getByText('Exception Analysis')).toBeInTheDocument());
    expect(screen.getByText('Amount differs from bank record.')).toBeInTheDocument();
    expect(screen.getByText('Verify bank charge')).toBeInTheDocument();
  });

  it('shows run not found when the run belongs to another/no one', async () => {
    recApi.getRun.mockRejectedValue({ response: { status: 404, data: { error: { message: 'Reconciliation run not found.' } } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Run not found')).toBeInTheDocument());
  });
});
