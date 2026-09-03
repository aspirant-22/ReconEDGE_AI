import { ArrowLeftRight } from 'lucide-react';

const Reconciliation = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and monitor financial reconciliation</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <ArrowLeftRight size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Reconciliation engine will be implemented in the next phase. This page will allow you to upload records, run matching, and review results.
        </p>
      </div>
    </div>
  );
};

export default Reconciliation;
