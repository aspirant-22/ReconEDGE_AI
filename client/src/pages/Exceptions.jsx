import { AlertTriangle } from 'lucide-react';

const Exceptions = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Exceptions</h1>
        <p className="text-sm text-gray-500 mt-1">Review and resolve reconciliation discrepancies</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Exception detection and management will be available in the next phase. This page will show unmatched records and AI-powered resolution suggestions.
        </p>
      </div>
    </div>
  );
};

export default Exceptions;
