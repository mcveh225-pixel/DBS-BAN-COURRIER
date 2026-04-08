import React, { useState, useEffect } from 'react';
import { Package, DollarSign, CheckCircle, Clock, Plus, Printer, FileDown, BarChart3, Calendar } from 'lucide-react';
import { User, getCourierDailyStats, getParcels, getUsers, Parcel } from '../lib/auth';
import { printReceipt } from '../lib/receipt';
import { exportMonthlyReportToExcel, exportWeeklyReportToExcel } from '../lib/exportUtils';
import ParcelList from './ParcelList';
import CreateParcelForm from './CreateParcelForm';
import ParcelDetailsModal from './ParcelDetailsModal';

interface CourierDashboardProps {
  user: User;
}

export default function CourierDashboard({ user }: CourierDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'parcels' | 'create' | 'bilan'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [allParcels, setAllParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; title: string; parcels: Parcel[] }>({
    isOpen: false,
    title: '',
    parcels: []
  });

  const loadData = async () => {
    const [statsData, parcelsData, usersData] = await Promise.all([
      getCourierDailyStats(user.id),
      getParcels(),
      getUsers()
    ]);
    setStats(statsData);
    setAllParcels(parcelsData);
    setUsers(usersData);
  };

  useEffect(() => {
    loadData();
  }, [user.id, activeTab]);
  
  const myParcels = allParcels.filter(p => p.createdBy === user.id);
  const parcelsForMe = allParcels.filter(p => p.destinationCity === user.city);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const todayISO = new Date().toISOString().split('T')[0];
  
  const todayMyParcels = myParcels.filter(p => p.createdAt.startsWith(todayISO) && p.status !== 'ANNULE');
  const destinedParcels = allParcels.filter(p => p.destinationCity === user.city && !['LIVRE', 'ANNULE'].includes(p.status));

  const monthlyRevenue = myParcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.startsWith(currentMonth))
    .reduce((sum, p) => sum + p.price, 0);

  const handleExportExcel = () => {
    if (myParcels.length === 0) {
      alert('Aucun colis à exporter.');
      return;
    }
    
    const [year, month] = selectedMonth.split('-');
    const filteredParcels = myParcels.filter(p => {
      const date = new Date(p.createdAt);
      return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
    });

    if (filteredParcels.length === 0) {
      alert('Aucun colis trouvé pour le mois sélectionné.');
      return;
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(month) - 1];
    
    exportMonthlyReportToExcel(filteredParcels, users, `Bilan_${monthName}_${year}_${user.name}`);
  };

  const handleExportWeeklyExcel = () => {
    if (myParcels.length === 0) {
      alert('Aucun colis à exporter.');
      return;
    }
    exportWeeklyReportToExcel(myParcels, users);
  };

  const statCards = stats ? [
    { 
      title: 'Créés Aujourd\'hui', 
      value: stats.totalParcels, 
      icon: Package, 
      color: 'bg-blue-500',
      onClick: () => setDetailsModal({ isOpen: true, title: 'Colis Créés Aujourd\'hui', parcels: todayMyParcels })
    },
    { title: 'Revenus Aujourd\'hui', value: `${stats.revenue.toLocaleString()} FCFA`, icon: DollarSign, color: 'bg-green-500' },
    { title: 'Revenus du Mois', value: `${monthlyRevenue.toLocaleString()} FCFA`, icon: BarChart3, color: 'bg-purple-600' },
    { title: 'Colis Payés', value: stats.paidParcels, icon: CheckCircle, color: 'bg-purple-500' },
    { 
      title: 'Colis Destinés', 
      value: stats.destinedCount, 
      icon: Package, 
      color: 'bg-indigo-500',
      onClick: () => setDetailsModal({ isOpen: true, title: 'Colis Destinés à ' + user.city, parcels: destinedParcels })
    },
    { title: 'Livrés Aujourd\'hui', value: stats.deliveredParcels, icon: Clock, color: 'bg-orange-500' }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex flex-wrap gap-1 bg-black/20 rounded-lg p-1">
          {[
            { key: 'overview', label: 'Tableau de bord', icon: Package },
            { key: 'parcels', label: 'Tous les colis', icon: Package },
            { key: 'bilan', label: 'Mon Bilan', icon: BarChart3 },
            { key: 'create', label: 'Nouveau colis', icon: Plus }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-white/10">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Période</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportWeeklyExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-emerald-900/20"
            >
              <FileDown className="w-4 h-4" />
              Hebdo
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-green-900/20"
            >
              <FileDown className="w-4 h-4" />
              Mensuel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <div 
            key={index} 
            onClick={stat.onClick}
            className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 ${stat.onClick ? 'cursor-pointer hover:bg-white/20 hover:border-white/30 transition-all transform hover:-translate-y-1' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            {stat.onClick && (
              <p className="text-[10px] text-blue-400 mt-2 font-medium flex items-center gap-1">
                Cliquer pour voir les détails
              </p>
            )}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Mes Colis Récents</h3>
            <div className="space-y-3">
              {myParcels.slice(0, 5).map(parcel => (
                <div key={parcel.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{parcel.code}</p>
                      <p className="text-xs text-gray-400">{parcel.quantity} x {parcel.packageType}</p>
                      <p className="text-sm text-gray-300">{parcel.recipientName}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        parcel.status === 'LIVRE' ? 'bg-green-600 text-white' :
                        parcel.status === 'ARRIVE' ? 'bg-yellow-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {parcel.status}
                      </span>
                      {parcel.isPaid && (
                        <button 
                          onClick={() => printReceipt(parcel)}
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-xs"
                        >
                          <Printer className="w-3 h-3" /> Reçu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Colis pour {user.city}</h3>
            <div className="space-y-3">
              {parcelsForMe.slice(0, 5).map(parcel => (
                <div key={parcel.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{parcel.code}</p>
                      <p className="text-xs text-gray-400">{parcel.quantity} x {parcel.packageType}</p>
                      <p className="text-sm text-gray-300">{parcel.recipientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        parcel.status === 'LIVRE' ? 'bg-green-600 text-white' :
                        parcel.status === 'ARRIVE' ? 'bg-yellow-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {parcel.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'parcels' && <ParcelList isAdmin={false} userCity={user.city || ''} />}
      {activeTab === 'create' && <CreateParcelForm userId={user.id} onCancel={() => setActiveTab('overview')} />}
      
      {activeTab === 'bilan' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bilan Hebdomadaire */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Bilan de la Semaine
                </h3>
                <button 
                  onClick={handleExportWeeklyExcel}
                  className="p-2 bg-emerald-600/20 border border-emerald-600/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                  title="Exporter la semaine"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
              
              {(() => {
                const now = new Date();
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(now.setDate(diff));
                monday.setHours(0, 0, 0, 0);
                const mondayISO = monday.toISOString().split('T')[0];

                const weekParcels = myParcels.filter(p => p.createdAt.split('T')[0] >= mondayISO && p.status !== 'ANNULE');
                const weekRevenue = weekParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
                const weekPaidCount = weekParcels.filter(p => p.isPaid).length;
                const weekDelivered = weekParcels.filter(p => p.status === 'LIVRE').length;

                const tariffs: Record<number, number> = {};
                weekParcels.filter(p => p.isPaid).forEach(p => {
                  tariffs[p.price] = (tariffs[p.price] || 0) + 1;
                });

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Créés</p>
                        <p className="text-2xl font-bold text-white mt-1">{weekParcels.length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Revenu Hebdo</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{weekRevenue.toLocaleString()} FCFA</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Payés</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{weekPaidCount}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Livrés</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">{weekDelivered}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-3">Détail des Tarifs (Payés)</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(tariffs).sort((a, b) => Number(a[0]) - Number(b[0])).map(([price, count]) => (
                          <div key={price} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                            <span className="text-xs text-gray-400">{price} FCFA:</span>
                            <span className="text-sm font-bold text-white">{count}</span>
                          </div>
                        ))}
                        {Object.keys(tariffs).length === 0 && (
                          <p className="text-xs text-gray-500 italic">Aucun paiement cette semaine</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bilan Mensuel */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Bilan du Mois
                </h3>
                <div className="flex items-center gap-2">
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-black/30 text-white text-xs border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer [color-scheme:dark]"
                  />
                  <button 
                    onClick={handleExportExcel}
                    className="p-2 bg-emerald-600/20 border border-emerald-600/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                    title="Exporter le mois"
                  >
                    <FileDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(() => {
                const [year, month] = selectedMonth.split('-');
                const monthParcels = myParcels.filter(p => {
                  const date = new Date(p.createdAt);
                  return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month) && p.status !== 'ANNULE';
                });
                const monthRevenue = monthParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
                const monthPaidCount = monthParcels.filter(p => p.isPaid).length;
                const monthDelivered = monthParcels.filter(p => p.status === 'LIVRE').length;

                const tariffs: Record<number, number> = {};
                monthParcels.filter(p => p.isPaid).forEach(p => {
                  tariffs[p.price] = (tariffs[p.price] || 0) + 1;
                });

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Créés</p>
                        <p className="text-2xl font-bold text-white mt-1">{monthParcels.length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Revenu Mensuel</p>
                        <p className="text-2xl font-bold text-purple-400 mt-1">{monthRevenue.toLocaleString()} FCFA</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Payés</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{monthPaidCount}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Livrés</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">{monthDelivered}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-3">Détail des Tarifs (Payés)</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(tariffs).sort((a, b) => Number(a[0]) - Number(b[0])).map(([price, count]) => (
                          <div key={price} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                            <span className="text-xs text-gray-400">{price} FCFA:</span>
                            <span className="text-sm font-bold text-white">{count}</span>
                          </div>
                        ))}
                        {Object.keys(tariffs).length === 0 && (
                          <p className="text-xs text-gray-500 italic">Aucun paiement ce mois</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {detailsModal.isOpen && (
        <ParcelDetailsModal 
          title={detailsModal.title}
          parcels={detailsModal.parcels}
          onClose={() => setDetailsModal({ ...detailsModal, isOpen: false })}
        />
      )}
    </div>
  );
}
