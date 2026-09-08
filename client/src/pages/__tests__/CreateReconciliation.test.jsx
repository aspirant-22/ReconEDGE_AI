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

vi.mock('../../contexts/ReconciliationContext', () => ({
  useReconciliation: vi.fn(),
}));

import { recApi } from '../../services/recApi';
import { useReconciliation } from '../../contexts/ReconciliationContext';

beforeEach(() => {
  useReconciliation.mockReturnValue({
    runs: [],
    runsLoading: false,
    selectedRunId: null,
    selectedRun: null,
    refreshRuns: vi.fn(),
    addRun: vi.fn(),
    setSelectedRunId: vi.fn(),
  });
});

const labelFor = {
  PAYMENTS: 'Payments',
  BANK_TRANSACTIONS: 'Bank Transactions',
  INVOICES: 'Invoices',
};

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
    expect(useReconciliation().addRun).toHaveBeenCalledWith({ id: 'r123', name: 'X', status: 'COMPLETED' });
    expect(useReconciliation().setSelectedRunId).toHaveBeenCalledWith('r123');
  });
});

describe('CreateReconciliation Page — Use Sample CSV', () => {
  const sampleCsv =
    'payment_id,customer_id,amount,currency,payment_date,reference_number,status\n' +
    'PMT-0001,CUS-101,1500.00,INR,2026-07-01,DEMO-REF-101,Cleared';
  const preview = {
    columns: ['payment_id', 'amount', 'payment_date', 'reference_number'],
    mapping: { paymentId: 'payment_id', amount: 'amount', paymentDate: 'payment_date', reference: 'reference_number' },
    report: { passed: true, invalidRows: 0, validRows: 1 },
  };

  function stubFetchFailing() {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function stubFetchOk() {
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  async function goToUploadStep() {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'Demo Run' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'Demo Run' } } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders "Use Sample CSV" on all three upload cards', async () => {
    await goToUploadStep();
    expect(screen.getAllByRole('button', { name: /Use Sample CSV/ })).toHaveLength(3);
  });

  it('loads the payments sample as a real File object', async () => {
    stubFetchOk();
    await goToUploadStep();
    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    await waitFor(() =>
      expect(recApi.previewFile).toHaveBeenCalledWith(
        'r123',
        'PAYMENTS',
        expect.objectContaining({ name: 'sample-payments.csv', type: 'text/csv' })
      )
    );
    const file = recApi.previewFile.mock.calls[0][2];
    expect(file).toBeInstanceOf(File);
    expect(file.size).toBeGreaterThan(0);
  });

  it('loads the bank transactions sample as a real File object', async () => {
    stubFetchOk();
    await goToUploadStep();
    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Bank Transactions' }));
    await waitFor(() =>
      expect(recApi.previewFile).toHaveBeenCalledWith(
        'r123',
        'BANK_TRANSACTIONS',
        expect.objectContaining({ name: 'sample-bank-transactions.csv', type: 'text/csv' })
      )
    );
  });

  it('loads the invoices sample as a real File object', async () => {
    stubFetchOk();
    await goToUploadStep();
    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Invoices' }));
    await waitFor(() =>
      expect(recApi.previewFile).toHaveBeenCalledWith(
        'r123',
        'INVOICES',
        expect.objectContaining({ name: 'sample-invoices.csv', type: 'text/csv' })
      )
    );
  });

  it('shows the selected sample filename and Demo sample indicator', async () => {
    stubFetchOk();
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    await goToUploadStep();
    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    await screen.findByText('sample-payments.csv');
    expect(screen.getByText('Demo sample')).toBeInTheDocument();
  });

  it('keeps manually selected files working alongside samples', async () => {
    stubFetchOk();
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    await goToUploadStep();

    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    await waitFor(() => expect(recApi.previewFile).toHaveBeenCalled());

    const manualInput = screen.getByTestId('file-BANK_TRANSACTIONS');
    fireEvent.change(manualInput, { target: { files: [new File(['a,b,c'], 'manual.csv')] } });
    await waitFor(() =>
      expect(recApi.previewFile).toHaveBeenCalledWith(
        'r123',
        'BANK_TRANSACTIONS',
        expect.objectContaining({ name: 'manual.csv' })
      )
    );
  });

  it('supports mixing sample and real files through the full upload flow', async () => {
    stubFetchOk();
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    recApi.uploadFile.mockResolvedValue({ data: { data: { fileMeta: { validRows: 1 }, report: { passed: true } } } });
    await goToUploadStep();

    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    const paymentsUpload = await screen.findByTestId('upload-PAYMENTS');
    fireEvent.click(paymentsUpload);
    await waitFor(() => expect(screen.queryByTestId('upload-PAYMENTS')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Bank Transactions' }));
    const bankUpload = await screen.findByTestId('upload-BANK_TRANSACTIONS');
    fireEvent.click(bankUpload);
    await waitFor(() => expect(screen.queryByTestId('upload-BANK_TRANSACTIONS')).not.toBeInTheDocument());

    const invoiceInput = screen.getByTestId('file-INVOICES');
    fireEvent.change(invoiceInput, { target: { files: [new File(['a,b,c'], 'real-invoices.csv')] } });
    const invoiceUpload = await screen.findByTestId('upload-INVOICES');
    fireEvent.click(invoiceUpload);
    await waitFor(() => expect(screen.queryByTestId('upload-INVOICES')).not.toBeInTheDocument());

    const runBtn = screen.getByRole('button', { name: /Run Reconciliation/ });
    expect(runBtn).toBeEnabled();
    expect(recApi.uploadFile).toHaveBeenCalledWith(
      'r123',
      'PAYMENTS',
      expect.objectContaining({ name: 'sample-payments.csv', type: 'text/csv' }),
      expect.anything()
    );
  });

  it('handles a sample load failure gracefully without breaking manual upload', async () => {
    stubFetchFailing();
    await goToUploadStep();
    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    await screen.findByText('Unable to load sample file. Please try again or upload your own CSV.');
    expect(recApi.previewFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('file-PAYMENTS')).toBeInTheDocument();
    expect(screen.getAllByText('No file selected')).toHaveLength(3);
  });

  it('sends all three sample files through the normal upload path and runs', async () => {
    stubFetchOk();
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    recApi.uploadFile.mockResolvedValue({ data: { data: { fileMeta: { validRows: 1 }, report: { passed: true } } } });
    recApi.executeRun.mockResolvedValue({
      data: { data: { matchedCount: 3, exceptionCount: 2, processingTimeMs: 12 } },
    });
    await goToUploadStep();

    for (const ft of ['PAYMENTS', 'BANK_TRANSACTIONS', 'INVOICES']) {
      fireEvent.click(screen.getByRole('button', { name: `Use Sample CSV for ${labelFor[ft]}` }));
      const uploadBtn = await screen.findByTestId(`upload-${ft}`);
      fireEvent.click(uploadBtn);
      await waitFor(() => expect(screen.queryByTestId(`upload-${ft}`)).not.toBeInTheDocument());
    }

    const runBtn = screen.getByRole('button', { name: /Run Reconciliation/ });
    expect(runBtn).toBeEnabled();
    fireEvent.click(runBtn);
    await waitFor(() => expect(screen.getByText('Reconciliation completed')).toBeInTheDocument());
    expect(recApi.executeRun).toHaveBeenCalledWith('r123');
    expect(useReconciliation().addRun).toHaveBeenCalledWith({ id: 'r123', name: 'Demo Run', status: 'COMPLETED' });
    expect(useReconciliation().setSelectedRunId).toHaveBeenCalledWith('r123');
    expect(recApi.uploadFile).toHaveBeenNthCalledWith(
      1,
      'r123',
      'PAYMENTS',
      expect.objectContaining({ name: 'sample-payments.csv', type: 'text/csv' }),
      expect.anything()
    );
  });
});

describe('CreateReconciliation Page — Download Sample CSV', () => {
  const downloadByFileType = {
    PAYMENTS: { href: '/samples/sample-payments.csv', name: 'sample-payments.csv' },
    BANK_TRANSACTIONS: { href: '/samples/sample-bank-transactions.csv', name: 'sample-bank-transactions.csv' },
    INVOICES: { href: '/samples/sample-invoices.csv', name: 'sample-invoices.csv' },
  };

  async function goToUploadStep() {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'Demo Run' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'Demo Run' } } });
  });

  it('renders "Download Sample CSV" on all three upload cards', async () => {
    await goToUploadStep();
    expect(screen.getAllByRole('link', { name: /Download Sample CSV/ })).toHaveLength(3);
  });

  it('points the Payments download at sample-payments.csv', async () => {
    await goToUploadStep();
    const link = screen.getByRole('link', { name: 'Download Sample CSV for Payments' });
    expect(link).toHaveAttribute('href', '/samples/sample-payments.csv');
    expect(link).toHaveAttribute('download', 'sample-payments.csv');
  });

  it('points the Bank Transactions download at sample-bank-transactions.csv', async () => {
    await goToUploadStep();
    const link = screen.getByRole('link', { name: 'Download Sample CSV for Bank Transactions' });
    expect(link).toHaveAttribute('href', '/samples/sample-bank-transactions.csv');
    expect(link).toHaveAttribute('download', 'sample-bank-transactions.csv');
  });

  it('points the Invoices download at sample-invoices.csv', async () => {
    await goToUploadStep();
    const link = screen.getByRole('link', { name: 'Download Sample CSV for Invoices' });
    expect(link).toHaveAttribute('href', '/samples/sample-invoices.csv');
    expect(link).toHaveAttribute('download', 'sample-invoices.csv');
  });

  it('download links reuse the exact paths used by "Use Sample CSV"', async () => {
    await goToUploadStep();
    for (const [ft, expected] of Object.entries(downloadByFileType)) {
      const link = screen.getByRole('link', { name: `Download Sample CSV for ${labelFor[ft]}` });
      expect(link.getAttribute('href')).toBe(expected.href);
      expect(link.getAttribute('download')).toBe(expected.name);
    }
  });

  it('download and use-sample options coexist without affecting the run flow', async () => {
    const blob = new Blob(['a,b,c'], { type: 'text/csv' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    const preview = {
      columns: ['payment_id', 'amount'],
      mapping: { paymentId: 'payment_id', amount: 'amount', paymentDate: null },
      report: { passed: true, invalidRows: 0, validRows: 1 },
    };
    recApi.previewFile.mockResolvedValue({ data: { data: preview } });
    recApi.uploadFile.mockResolvedValue({ data: { data: { fileMeta: { validRows: 1 }, report: { passed: true } } } });
    await goToUploadStep();

    const runBtn = screen.getByRole('button', { name: /Run Reconciliation/ });
    expect(runBtn).toBeDisabled();
    expect(screen.getAllByRole('link', { name: /Download Sample CSV/ })).toHaveLength(3);

    for (const ft of ['PAYMENTS', 'BANK_TRANSACTIONS', 'INVOICES']) {
      fireEvent.click(screen.getByRole('button', { name: `Use Sample CSV for ${labelFor[ft]}` }));
      const uploadBtn = await screen.findByTestId(`upload-${ft}`);
      fireEvent.click(uploadBtn);
      await waitFor(() => expect(screen.queryByTestId(`upload-${ft}`)).not.toBeInTheDocument());
    }

    expect(runBtn).toBeEnabled();
  });

  afterEach(() => vi.unstubAllGlobals());
});

describe('CreateReconciliation Page — Upload Requirements', () => {
  async function goToUploadStep() {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/e.g. June 2026 payments/), { target: { value: 'Demo Run' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to upload/ }));
    await waitFor(() => expect(screen.getAllByText('Choose CSV / XLSX').length).toBe(3));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    recApi.createRun.mockResolvedValue({ data: { data: { id: 'r123', name: 'Demo Run' } } });
  });

  it('renders the "Upload Requirements" heading', async () => {
    await goToUploadStep();
    expect(screen.getByRole('button', { name: /Upload Requirements/ })).toBeInTheDocument();
    expect(screen.getByText('Upload Requirements')).toBeInTheDocument();
    expect(screen.getByText(/upload structured financial CSV files/)).toBeInTheDocument();
  });

  it('shows required fields for each dataset', async () => {
    await goToUploadStep();
    expect(screen.getByText(/Payment ID/)).toBeInTheDocument();
    expect(screen.getByText(/Transaction ID/)).toBeInTheDocument();
    expect(screen.getByText(/Invoice ID/)).toBeInTheDocument();
    expect(screen.getAllByText(/Amount/)).toHaveLength(3);
    expect(screen.getByText(/Payment Date/)).toBeInTheDocument();
    expect(screen.getByText(/Transaction Date/)).toBeInTheDocument();
    expect(screen.getByText(/Invoice Date/)).toBeInTheDocument();
  });

  it('shows recommended fields for each dataset', async () => {
    await goToUploadStep();
    expect(screen.getAllByText(/Reference/)).toHaveLength(3);
    expect(screen.getAllByText(/Customer ID/)).toHaveLength(2);
    expect(screen.getAllByText(/Currency/)).toHaveLength(3);
    expect(screen.getByText(/Description/)).toBeInTheDocument();
  });

  it('shows the general data-quality requirements', async () => {
    await goToUploadStep();
    for (const item of [
      'Include a header row',
      'Use unique record IDs',
      'Provide valid amounts',
      'Provide valid dates',
      'Use consistent currency values',
      'Keep references consistent for related records',
      'Row order does not matter',
      'Files may contain different numbers of records',
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('explains deterministic matching and flag-for-review behaviour', async () => {
    await goToUploadStep();
    expect(screen.getByText(/uses deterministic financial evidence/)).toBeInTheDocument();
    expect(screen.getByText(/flagged for human review instead of being guessed/)).toBeInTheDocument();
  });

  it('points judges to the Sample CSV option when they have no dataset', async () => {
    await goToUploadStep();
    expect(screen.getByText(/No dataset\? Use the Sample CSV option below/)).toBeInTheDocument();
    expect(screen.getByText(/automatically detects supported column names/)).toBeInTheDocument();
  });

  it('collapses and expands without affecting selected files', async () => {
    const blob = new Blob(['a,b,c'], { type: 'text/csv' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    recApi.previewFile.mockResolvedValue({
      data: { data: { columns: ['a', 'b'], mapping: {}, report: { passed: true, invalidRows: 0, validRows: 1 } } },
    });
    await goToUploadStep();

    fireEvent.click(screen.getByRole('button', { name: 'Use Sample CSV for Payments' }));
    await screen.findByText('sample-payments.csv');

    const toggle = screen.getByRole('button', { name: /Upload Requirements/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Payment ID/)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Payment ID/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Payment ID/)).toBeInTheDocument();
    expect(screen.getByText('sample-payments.csv')).toBeInTheDocument();
  });

  it('keeps upload controls and the run flow fully functional', async () => {
    await goToUploadStep();
    expect(screen.getByTestId('file-PAYMENTS')).toBeInTheDocument();
    expect(screen.getByTestId('file-BANK_TRANSACTIONS')).toBeInTheDocument();
    expect(screen.getByTestId('file-INVOICES')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Use Sample CSV/ })).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: /Download Sample CSV/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Run Reconciliation/ })).toBeDisabled();
  });

  afterEach(() => vi.unstubAllGlobals());
});
