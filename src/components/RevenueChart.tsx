import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, FileDown, Calendar } from 'lucide-react';
import { getDailyRevenues, getParcels, getUsers, User } from '../lib/auth';
import { exportWeeklyReportToExcel } from '../lib/exportUtils';

export default function RevenueChart() {
  const [dailyRevenues, setDailyRevenues] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const loadData = async () => {
    const [revs, parcs, usersData] = await Promise.all([getDailyRevenues(), getParcels(), getUsers()]);
    setDailyRevenues(revs);
    setParcels(parcs);
    setUsers(usersData);
  };

  useEffect(() => { loadData(); }, []);

  const totalRevenue = parcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
  const totalParcels = parcels.length;
  const deliveredParcels = parcels.filter(p => p.status === 'LIVRE').length;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const revenueData = last7Days.map(date => {
    const day = dailyRevenues.find(r => r.date === date);
    return { date, revenue: day?.totalRevenue || 0 };
  });

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);

  // Weekly breakdown logic
  const getWeeklyBreakdown = () => {
    const weeks: Record<string, any> = {};
    parcels.forEach(p => {
      const date = new Date(p.createdAt);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      monday.setHours(0,0,0,0);
      const key = monday.toISOString().split('T')[0];

      if (!weeks[key]) {
        weeks[key] = {
          monday,
          total: 0,
          paid: 0,
          revenue: 0,
          delivered: 0,
          tariffs: {}
        };
      }

      weeks[key].total += 1;
      if (p.isPaid) {
        weeks[key].paid += 1;
        weeks[key].revenue += p.price;
        weeks[key].tariffs[p.price] = (weeks[key].tariffs[p.price] || 0) + 1;
      }
      if (p.status === 'LIVRE') {
        weeks[key].delivered += 1;
      }
    });

    return Object.values(weeks).sort((a: any, b: any) => b.monday - a.monday);
  };

  const weeklyData = getWeeklyBreakdown();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-500" />
          Analyse des Revenus
        </h2>
        <button 
          onClick={() => exportWeeklyReportToExcel(parcels, users)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <FileDown className="w-4 h-4" />
          Exporter Bilan Hebdo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/10 border border-white/20 rounded-xl p-6 flex justify-between items-center">
          <div><p className="text-gray-300 text-sm">Revenus Total</p><p className="text-2xl font-bold text-white">{totalRevenue.toLocaleString()} FCFA</p></div>
          <DollarSign className="w-8 h-8 text-green-500" />
        </div>
        <div className="bg-white/10 border border-white/20 rounded-xl p-6 flex justify-between items-center">
          <div><p className="text-gray-300 text-sm">Total Colis</p><p className="text-2xl font-bold text-white">{totalParcels}</p></div>
          <Package className="w-8 h-8 text-blue-500" />
        </div>
        <div className="bg-white/10 border border-white/20 rounded-xl p-6 flex justify-between items-center">
          <div><p className="text-gray-300 text-sm">Livrés</p><p className="text-2xl font-bold text-white">{deliveredParcels}</p></div>
          <TrendingUp className="w-8 h-8 text-orange-500" />
        </div>
      </div>

      <div className="bg-white/10 border border-white/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Revenus des 7 derniers jours</h3>
        <div className="space-y-4">
          {revenueData.map(day => (
            <div key={day.date} className="flex items-center gap-4">
              <div className="w-24 text-sm text-gray-300 font-medium">
                {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              <div className="flex-1 bg-white/5 rounded-full h-8 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full transition-all duration-1000 ease-out" 
                  style={{ width: `${(day.revenue / maxRevenue) * 100}%` }} 
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                  {day.revenue.toLocaleString()} FCFA
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/10 border border-white/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Bilan Hebdomadaire</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 text-gray-400 font-medium">Semaine du</th>
                <th className="py-3 text-gray-400 font-medium text-center">Colis</th>
                <th className="py-3 text-gray-400 font-medium text-center">Payés</th>
                <th className="py-3 text-gray-400 font-medium">Détail Tarifs</th>
                <th className="py-3 text-gray-400 font-medium text-right">Revenu Hebdo</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((week: any) => (
                <tr key={week.monday.toISOString()} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 text-white font-medium">
                    {week.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                  <td className="py-4 text-gray-300 text-center">{week.total}</td>
                  <td className="py-4 text-gray-300 text-center">{week.paid}</td>
                  <td className="py-4 text-gray-400 text-xs italic">
                    {Object.entries(week.tariffs).map(([price, count]) => (
                      <span key={price} className="inline-block bg-white/5 rounded px-2 py-1 mr-2 mb-1">
                        {price} FCFA: {count as number}
                      </span>
                    ))}
                  </td>
                  <td className="py-4 text-emerald-400 font-bold text-right">
                    {week.revenue.toLocaleString()} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
