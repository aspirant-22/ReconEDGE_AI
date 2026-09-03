import { Database, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';

const cards = [
  { title: 'Total Records', value: '—', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
  { title: 'Matched', value: '—', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { title: 'Exceptions', value: '—', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { title: 'Match Rate', value: '—', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
];

const Dashboard = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your reconciliation status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{card.title}</span>
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reconciliation Activity</h2>
        <div className="text-center py-12 text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">No reconciliation runs yet.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
