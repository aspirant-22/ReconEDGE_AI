import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CreateReconciliation from '../CreateReconciliation';

vi.mock('../../services/recApi', () => ({
  recApi: {
    createRun: vi.fn(),
    previewFile: vi.fn(),
    uploadFile: vi.fn(),
    executeRun: vi.fn(),
  },
}));

import { recApi } from '../../services/recApi';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/reconciliation/runs/new']}>
      <Routes>
        <Route path="/reconciliation/runs/new" element={<CreateReconciliation />} />
        <Route path="/reconciliation/runs" element={<div>RUNS-LIST</div>} />
        <Route path="/reconciliation/runs/:runId" element={<div>RUN-DETAIL</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CreateReconciliation Page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a name to continue', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getByText('Give this reconciliation a name.')).toBeInTheDocument());
  });

  it('creates a run and advances to the upload step', async () => {
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'June Recon' } } });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'June Recon' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));
    expect(recApi.createRun).toHaveBeenCalledWith({
      name: 'June Recon',
      periodStart: undefined,
      periodEnd: undefined,
    });
  });

  it('disables Run until all three datasets are uploaded', async () => {
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'X' } } });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));
    const runBtn = screen.getByRole('button', { name: /Run Reconciliation/ });
    expect(runBtn).toBeDisabled();
  });

  it('processes a full upload and run flow', async () => {
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'X' } } });
    const preview = {
      columns: ['id1', 'amount', 'date'],
      mapping: { paymentId: 'id1', amount: 'amount', paymentDate: 'date' },
      report: { passed: true, invalidRows: 0, validRows: 1 },
    };
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    recApi.uploadFile.mockResolvedValue({
      data: { data: { fileMeta: { validRows: 1 }, report: { passed: true } } },
    });
    recApi.executeRun.mockResolvedValue({
      data: { data: { matchedCount: 3, exceptionCount: 2, processingTimeMs: 12 } },
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));

    for (const ft of ['PAYMENTS', 'BANK_TRANSACTIONS', 'INVOICES']) {
      const input = screen.getByTestId(`file-${ft}`);
      fireEvent.change(input, { target: { files: [new File(['a,b,c'], 'f.csv')] } });
      const uploadBtn = await screen.findByTestId(`upload-${ft}`);
      fireEvent.click(uploadBtn);
      await waitFor(() => expect(screen.queryByTestId(`upload-${ft}`)).not.toBeInTheDocument());
    }

    const runBtn = await screen.findByRole('button', { name: /Run Reconciliation/ });
    expect(runBtn).toBeEnabled();
    fireEvent.click(runBtn);
    await waitFor(() => expect(screen.getByText('Reconciliation completed')).toBeInTheDocument());
    expect(recApi.executeRun).toHaveBeenCalledWith('r123');
  });
});
