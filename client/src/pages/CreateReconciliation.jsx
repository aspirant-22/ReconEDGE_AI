import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Landmark,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  Play,
  Wand2,
} from 'lucide-react';
import { recApi } from '../services/recApi';

const FILE_TYPES = [
  { key: 'PAYMENTS', label: 'Payments', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'BANK_TRANSACTIONS', label: 'Bank Transactions', icon: Landmark, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'INVOICES', label: 'Invoices', icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50' },
];

const CANONICAL_LABELS = {
  paymentId: 'Payment ID',
  transactionId: 'Transaction ID',
  invoiceId: 'Invoice ID',
  customerId: 'Customer ID',
  amount: 'Amount',
  currency: 'Currency',
  paymentDate: 'Payment date',
  transactionDate: 'Transaction date',
  invoiceDate: 'Invoice date',
  reference: 'Reference',
  description: 'Description',
};

const REQUIRED_HINT = {
  PAYMENTS: ['paymentId', 'amount', 'paymentDate'],
  BANK_TRANSACTIONS: ['transactionId', 'amount', 'transactionDate'],
  INVOICES: ['invoiceId', 'amount', 'invoiceDate'],
};

function emptyFileState() {
  return { file: null, fileName: '', loading: false, error: null, preview: null, uploaded: false, meta: null };
}

const CreateReconciliation = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [runId, setRunId] = useState(null);
  const [runName, setRunName] = useState('');
  const [buttonError, setButtonError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [files, setFiles] = useState({ PAYMENTS: emptyFileState(), BANK_TRANSACTIONS: emptyFileState(), INVOICES: emptyFileState() });
  const [runOutcome, setRunOutcome] = useState(null);
  const [runExecuting, setRunExecuting] = useState(false);

  const allUploaded = FILE_TYPES.every((t) => files[t.key].uploaded);
  const readyToRun = allUploaded;

  const handleCreate = async () => {
    setButtonError(null);
    if (!name.trim()) { setButtonError('Give this reconciliation a name.'); return; }
    setCreating(true);
    try {
      const res = await recApi.createRun({
        name: name.trim(),
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      });
      setRunId(res.data?.data?.id);
      setRunName(res.data?.data?.name);
      setStep(2);
    } catch (err) {
      if (err.response?.status === 401) return;
      setButtonError(err.response?.data?.error?.message || 'Could not create the run.');
    } finally {
      setCreating(false);
    }
  };

  const updateFile = (ft, patch) => setFiles((f) => ({ ...f, [ft]: { ...f[ft], ...patch } }));

  const handleSelectFile = async (ft, file) => {
    if (!file) return;
    updateFile(ft, { file, fileName: file.name, loading: true, error: null, preview: null, uploaded: false });
    try {
      const res = await recApi.previewFile(runId, ft, file);
      updateFile(ft, { loading: false, preview: res.data?.data });
    } catch (err) {
      if (err.response?.status === 401) return;
      updateFile(ft, { loading: false, error: err.response?.data?.error?.message || 'Could not read the file.' });
    }
  };

  const setMappingOverride = (ft, canonical, column) => {
    const preview = files[ft].preview;
    if (!preview) return;
    updateFile(ft, { preview: { ...preview, mapping: { ...preview.mapping, [canonical]: column || null } } });
  };

  const handleUpload = async (ft) => {
    const state = files[ft];
    if (!state.preview) return;
    updateFile(ft, { loading: true, error: null });
    try {
      const res = await recApi.uploadFile(runId, ft, state.file, state.preview.mapping);
      updateFile(ft, { loading: false, uploaded: true, error: null, meta: res.data?.data?.fileMeta, report: res.data?.data?.report });
    } catch (err) {
      if (err.response?.status === 401) return;
      updateFile(ft, { loading: false, error: err.response?.data?.error?.message || 'Validation failed. Please fix the file and re-upload.' });
    }
  };

  const handleRun = async () => {
    setRunExecuting(true);
    try {
      const res = await recApi.executeRun(runId);
      setRunOutcome(res.data?.data);
      setStep(3);
    } catch (err) {
      if (err.response?.status === 401) return;
      setButtonError(err.response?.data?.error?.message || 'Reconciliation failed.');
    } finally {
      setRunExecuting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/reconciliation/runs')}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to my reconciliations
      </button>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your real payment, bank and invoice data.</p>
        </div>
        {runName && <span className="text-sm text-gray-500">Run: <span className="font-medium text-gray-700">{runName}</span></span>}
      </div>

      <Stepper step={step} />

      {buttonError && !runExecuting && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <AlertCircle size={16} />
          {buttonError}
        </div>
      )}

      {step === 1 && <StepDetails {...{ name, setName, periodStart, setPeriodStart, periodEnd, setPeriodEnd, creating, handleCreate }} />}
      {step === 2 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {FILE_TYPES.map((ft) => (
              <FileCard
                key={ft.key}
                runId={runId}
                fileType={ft}
                state={files[ft.key]}
                onSelect={handleSelectFile}
                onMappingChange={setMappingOverride}
                onUpload={handleUpload}
                required={REQUIRED_HINT[ft.key]}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleRun}
              disabled={!readyToRun || runExecuting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={readyToRun ? 'Run reconciliation' : 'Upload and validate all three datasets'}
            >
              {runExecuting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {runExecuting ? 'Running...' : 'Run Reconciliation'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && runOutcome && (
        <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Reconciliation completed</h2>
          <p className="text-sm text-gray-500 mb-6">Processed in {runOutcome.processingTimeMs} ms.</p>
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Matched</p>
              <p className="text-2xl font-bold text-green-600">{runOutcome.matchedCount}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Exceptions</p>
              <p className="text-2xl font-bold text-amber-600">{runOutcome.exceptionCount}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/reconciliation/runs/${runId}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            View results <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

function Stepper({ step }) {
  const steps = ['Details', 'Upload Data', 'Results'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${active ? 'bg-primary-600 text-white' : done ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {done ? <CheckCircle2 size={14} /> : <span>{n}</span>}
              {label}
            </div>
            {n < steps.length && <div className="w-6 h-px bg-gray-300" />}
          </div>
        );
      })}
    </div>
  );
}

function StepDetails({ name, setName, periodStart, setPeriodStart, periodEnd, setPeriodEnd, creating, handleCreate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Reconciliation details</h2>
      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. June 2026 payments"
          className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </label>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Period start</span>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Period end</span>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </label>
      </div>
      <button
        onClick={handleCreate}
        disabled={creating}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {creating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Continue to upload
      </button>
    </div>
  );
}

function FileCard({ runId, fileType, state, onSelect, onMappingChange, onUpload, required }) {
  const Icon = fileType.icon;
  const uploading = state.loading && !state.uploaded;
  const needsMapping = state.preview && !state.uploaded;

  return (
    <div className={`bg-white rounded-xl border p-5 ${state.uploaded ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg ${fileType.bg} flex items-center justify-center`}>
          <Icon size={20} className={fileType.color} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{fileType.label}</h3>
          {state.uploaded ? (
            <p className="text-xs text-green-600">{state.meta?.validRows} valid row{state.meta?.validRows === 1 ? '' : 's'}</p>
          ) : (
            <p className="text-xs text-gray-400">{state.fileName || 'No file selected'}</p>
          )}
        </div>
        {state.uploaded && <CheckCircle2 size={20} className="text-green-500" />}
      </div>

      {!state.uploaded && (
        <label className="block cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            data-testid={`file-${fileType.key}`}
            disabled={uploading || !runId}
            onChange={(e) => onSelect(fileType.key, e.target.files?.[0])}
          />
          <div className="flex items-center gap-2 justify-center border-2 border-dashed border-gray-200 rounded-lg px-3 py-4 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Reading file...' : 'Choose CSV / XLSX'}
          </div>
        </label>
      )}

      {state.error && (
        <p className="mt-3 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {state.error}</p>
      )}

      {needsMapping && (
        <div className="mt-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <Wand2 size={13} className="text-primary-600" /> Map your columns
          </div>
          <div className="space-y-1.5">
            {Object.keys(state.preview.mapping || {}).map((canonical) => (
              <div key={canonical} className="flex items-center gap-2">
                <span className="w-28 text-xs text-gray-600">
                  {CANONICAL_LABELS[canonical] || canonical}
                  {required.includes(canonical) && <span className="text-red-500"> *</span>}
                </span>
                <select
                  value={state.preview.mapping[canonical] || ''}
                  onChange={(e) => onMappingChange(fileType.key, canonical, e.target.value || null)}
                  className={`flex-1 px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${state.preview.mapping[canonical] ? 'border-gray-300 text-gray-800' : 'border-red-300 text-red-600'}`}
                  data-testid={`map-${fileType.key}-${canonical}`}
                >
                  <option value="">— not mapped —</option>
                  {state.preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          {state.preview.report?.invalidRows > 0 && (
            <p className="mt-2 text-xs text-amber-600">{state.preview.report.invalidRows} row(s) will be flagged invalid.</p>
          )}
          <button
            onClick={() => onUpload(fileType.key)}
            disabled={state.loading}
            data-testid={`upload-${fileType.key}`}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {state.loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Validate &amp; Upload
          </button>
        </div>
      )}
    </div>
  );
}

export default CreateReconciliation;
