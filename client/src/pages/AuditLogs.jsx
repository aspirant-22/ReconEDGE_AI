import { FileText } from 'lucide-react';

const AuditLogs = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">Track all system activities and changes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Audit logging will be implemented in the next phase. This page will display a complete trail of all reconciliation activities and user actions.
        </p>
      </div>
    </div>
  );
};

export default AuditLogs;
