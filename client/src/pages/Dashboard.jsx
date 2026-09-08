import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Database, FolderOpen, Play } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useReconciliation } from '../contexts/ReconciliationContext';
import RunSelector from '../components/run/RunSelector';
import KPICards from '../components/dashboard/KPICards';
import ReconciliationHealth from '../components/dashboard/ReconciliationHealth';
import ControlHealth from '../components/dashboard/ControlHealth';
import ExceptionDistribution from '../components/dashboard/ExceptionDistribution';
import ExceptionSeverity from '../components/dashboard/ExceptionSeverity';
import FinancialImpact from '../components/dashboard/FinancialImpact';
import TopExceptions from '../components/dashboard/TopExceptions';
import AIInsights from '../components/dashboard/AIInsights';
import RecentExceptions from '../components/dashboard/RecentExceptions';
import WorkflowSummaryCards from '../components/exceptions/WorkflowSummaryCards';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../components/dashboard/Skeletons';
import { ErrorState, EmptyState } from '../components/dashboard/States';

const Dashboard = () => {
  const { selectedRunId, selectedRun, runs } = useReconciliation();
  const [viewingDemo, setViewingDemo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedRunId) setViewingDemo(false);
  }, [selectedRunId]);

  const hasRealRuns = runs.length > 0;
  const showDemo = !selectedRunId && (viewingDemo || hasRealRuns);
  const showEmpty = !selectedRunId && !hasRealRuns && !viewingDemo;
  const { data, loading, error, lastUpdated, refetch } = useDashboardData(selectedRunId, {
    enabled: Boolean(selectedRunId) || showDemo,
  });

  if (showEmpty) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Financial Control Dashboard</h1>
          <RunSelector />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database size={28} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">No reconciliation data yet.</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Run a reconciliation or view stats for the demo dataset.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/reconciliation/runs/new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Play size={14} /> Run Reconciliation
              </button>
              <button
                onClick={() => setViewingDemo(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Database size={14} /> View Demo Stats
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-64 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonChart />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Financial Control Dashboard</h1>
          <RunSelector />
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Control Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reconcile. Detect. Explain. Resolve.
            {lastUpdated && (
              <span className="ml-2 text-gray-400">
                Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunSelector />
          <button
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {selectedRunId && (
        <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
          <FolderOpen size={14} className="text-primary-600" />
          <span>
            Viewing reconciliation run:{' '}
            <span className="font-medium text-gray-700">{selectedRun?.name || 'Selected run'}</span>
            {selectedRun?.status ? ` (${selectedRun.status.toLowerCase()})` : ''}
          </span>
        </div>
      )}
      {!selectedRunId && (
        <div className="mb-6 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Database size={14} />
          Showing the demo sample dataset. Select a reconciliation run above to view your real data.
        </div>
      )}

      {!data ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-6">
            <KPICards overview={data.overview} />
          </div>

          {selectedRunId && data.workflow && (
            <div className="mb-6">
              <WorkflowSummaryCards workflow={data.workflow} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <ReconciliationHealth reconciliation={data.reconciliation} />
            <ExceptionDistribution exceptions={data.exceptions} />
            <ControlHealth control={data.control} />
          </div>

          <div className="mb-6">
            <FinancialImpact financial={data.financial} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ExceptionSeverity severity={data.exceptions.severity} />
            <TopExceptions
              topExceptions={data.topExceptions}
              financialBreakdown={data.exceptions.breakdown}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentExceptions recentExceptions={data.recentExceptions} />
            <AIInsights control={data.control} />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
