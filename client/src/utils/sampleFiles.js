// Bundled demo sample files served from the Vite public directory.
// Loading a sample produces a real File object that enters the exact same
// upload state as a manually selected file. There is no separate sample
// reconciliation path.
const SAMPLE_FILES = {
  PAYMENTS: {
    key: 'PAYMENTS',
    path: '/samples/sample-payments.csv',
    fileName: 'sample-payments.csv',
  },
  BANK_TRANSACTIONS: {
    key: 'BANK_TRANSACTIONS',
    path: '/samples/sample-bank-transactions.csv',
    fileName: 'sample-bank-transactions.csv',
  },
  INVOICES: {
    key: 'INVOICES',
    path: '/samples/sample-invoices.csv',
    fileName: 'sample-invoices.csv',
  },
};

const SAMPLE_LOAD_ERROR = 'Unable to load sample file. Please try again or upload your own CSV.';

/**
 * Fetch a bundled sample CSV and convert it into a File object that behaves
 * exactly like a manually selected file.
 */
async function loadSampleFile(sample, fetchImpl) {
  const fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    throw new Error(SAMPLE_LOAD_ERROR);
  }
  const response = await fetchFn(sample.path);
  if (!response.ok) {
    throw new Error(SAMPLE_LOAD_ERROR);
  }
  const blob = await response.blob();
  return new File([blob], sample.fileName, { type: blob.type || 'text/csv' });
}

export { SAMPLE_FILES, SAMPLE_LOAD_ERROR, loadSampleFile };