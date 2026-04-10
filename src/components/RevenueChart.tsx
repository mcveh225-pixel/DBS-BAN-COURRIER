import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, FileDown, Calendar, User as UserIcon, BarChart3 } from 'lucide-react';
import { getDailyRevenues, getParcels, getUsers, User, Parcel, getCurrentUser } from '../lib/auth';
import { exportWeeklyReportToExcel } from '../lib/exportUtils';
import AdminBreakdownModal from './AdminBreakdownModal';

export default function RevenueChart() {
  const [dailyRevenues, setDailyRevenues] = useState<any[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [breakdownModal, setBreakdownModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'responsables' | 'parcels_today' | 'parcels_week' | 'revenue_today' | 'revenue_week' | 'revenue_month';
    data: any[];
  }>({
    isOpen: false,
    title: '',
    type: 'responsables',
    data: []
  });

  const loadData = async () => {
    const [revs, parcs, usersData] = await Promise.all([getDailyRevenues(), getParcels(), getUsers()]);
    setDailyRevenues(revs);
    setParcels(parcs);
    setUsers(usersData);
  };

  useEffect(() => { loadData(); }, []);

  const currentYearUTC = new Date().toISOString().slice(0, 4);
  const totalRevenue = parcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.startsWith(currentYearUTC))
    .reduce((sum, p) => sum + p.price, 0);
  const totalParcels = parcels.filter(p => p.status !== 'ANNULE').length;
  const deliveredParcels = parcels.filter(p => p.status === 'LIVRE').length;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const revenueData = last7Days.map(date => {
    const dayRevenue = parcels
      .filter(p => 
        p.isPaid && 
        p.status !== 'ANNULE' && 
        p.createdAt.split('T')[0] === date
      )
      .reduce((sum, p) => sum + p.price, 0);
    return { date, revenue: dayRevenue };
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

      if (p.status === 'ANNULE') return;

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
      if (p.isPaid && p.status !== 'ANNULE') {
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

  const getCourierPerformance = () => {
    const couriers = users.filter(u => u.role === 'courier');
    
    // Current week start
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const currentWeekStart = monday.toISOString().split('T')[0];

    // Selected month
    const [year, month] = selectedMonth.split('-');

    return couriers.map(courier => {
      const courierParcels = parcels.filter(p => p.createdBy === courier.id && p.status !== 'ANNULE');
      
      // Weekly stats
      const weekParcels = courierParcels.filter(p => p.createdAt.split('T')[0] >= currentWeekStart);
      const weekRevenue = weekParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
      
      // Monthly stats
      const monthParcels = courierParcels.filter(p => {
        const date = new Date(p.createdAt);
        return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
      });
      const monthRevenue = monthParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);

      return {
        id: courier.id,
        name: courier.name,
        city: courier.city,
        week: {
          revenue: weekRevenue,
          parcels: weekParcels.length,
          paid: weekParcels.filter(p => p.isPaid).length
        },
        month: {
          revenue: monthRevenue,
          parcels: monthParcels.length,
          paid: monthParcels.filter(p => p.isPaid).length
        }
      };
    });
  };

  const courierPerformance = getCourierPerformance();

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
        <div 
          className="bg-white/10 border border-white/20 rounded-xl p-6 flex justify-between items-center cursor-pointer hover:bg-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => {
            const courierUsers = users.filter(u => u.role === 'courier');
            setBreakdownModal({
              isOpen: true,
              title: 'Revenus par Responsable (Année)',
              type: 'revenue_month',
              data: courierUsers.map(u => {
                const userYearlyParcels = parcels.filter(p => 
                  p.createdBy === u.id && 
                  p.isPaid && 
                  p.status !== 'ANNULE' && 
                  p.createdAt.startsWith(currentYearUTC)
                );
                const revenue = userYearlyParcels.reduce((sum, p) => sum + p.price, 0);
                return {
                  name: u.name,
                  city: u.city,
                  value: revenue,
                  subValue: userYearlyParcels.length
                };
              }).filter(d => (d.value as number) > 0)
            });
          }}
        >
          <div><p className="text-gray-300 text-sm">Revenus de l'Année</p><p className="text-2xl font-bold text-white">{totalRevenue.toLocaleString()} FCFA</p></div>
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Performance par Responsable</h3>
          </div>
          <div className="flex items-center gap-3 bg-black/30 rounded-lg px-3 py-2 border border-white/10">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Mois</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 text-gray-400 font-medium">Responsable</th>
                <th className="py-3 text-gray-400 font-medium">Ville</th>
                <th className="py-3 text-gray-400 font-medium text-center border-l border-white/5">Colis (Sem)</th>
                <th className="py-3 text-gray-400 font-medium text-right text-green-400">Revenu (Sem)</th>
                <th className="py-3 text-gray-400 font-medium text-center border-l border-white/5">Colis (Mois)</th>
                <th className="py-3 text-gray-400 font-medium text-right text-purple-400">Revenu (Mois)</th>
              </tr>
            </thead>
            <tbody>
              {courierPerformance.map((perf) => (
                <tr key={perf.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4">
                    <p className="text-white font-medium">{perf.name}</p>
                  </td>
                  <td className="py-4 text-gray-400">{perf.city || '-'}</td>
                  <td className="py-4 text-center text-gray-300 border-l border-white/5">
                    {perf.week.parcels} <span className="text-[10px] text-gray-500">({perf.week.paid} payés)</span>
                  </td>
                  <td className="py-4 text-right text-green-400 font-bold">
                    {perf.week.revenue.toLocaleString()} FCFA
                  </td>
                  <td className="py-4 text-center text-gray-300 border-l border-white/5">
                    {perf.month.parcels} <span className="text-[10px] text-gray-500">({perf.month.paid} payés)</span>
                  </td>
                  <td className="py-4 text-right text-purple-400 font-bold">
                    {perf.month.revenue.toLocaleString()} FCFA
                  </td>
                </tr>
              ))}
              {courierPerformance.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                    Aucun responsable trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      {breakdownModal.isOpen && (
        <AdminBreakdownModal
          title={breakdownModal.title}
          type={breakdownModal.type}
          data={breakdownModal.data}
          onClose={() => setBreakdownModal({ ...breakdownModal, isOpen: false })}
        />
      )}
    </div>
  );
}
