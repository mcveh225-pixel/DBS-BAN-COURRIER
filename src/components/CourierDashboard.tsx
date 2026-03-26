import React, { useState, useEffect } from 'react';
import { Package, DollarSign, CheckCircle, Clock, Plus, Printer, FileDown } from 'lucide-react';
import { User, getCourierDailyStats, getParcels } from '../lib/auth';
import { printReceipt } from '../lib/receipt';
import { exportMonthlyReportToExcel, exportWeeklyReportToExcel } from '../lib/exportUtils';
import ParcelList from './ParcelList';
import CreateParcelForm from './CreateParcelForm';

interface CourierDashboardProps {
  user: User;
}

export default function CourierDashboard({ user }: CourierDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'parcels' | 'create'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [allParcels, setAllParcels] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const loadData = async () => {
    const [statsData, parcelsData] = await Promise.all([
      getCourierDailyStats(user.id),
      getParcels()
    ]);
    setStats(statsData);
    setAllParcels(parcelsData);
  };

  useEffect(() => {
    loadData();
  }, [user.id, activeTab]);
  
  const myParcels = allParcels.filter(p => p.createdBy === user.id);
  const parcelsForMe = allParcels.filter(p => p.destinationCity === user.city);

  const handleExportExcel = () => {
    if (allParcels.length === 0) {
      alert('Aucun colis à exporter.');
      return;
    }
    
    const [year, month] = selectedMonth.split('-');
    const filteredParcels = allParcels.filter(p => {
      const date = new Date(p.createdAt);
      return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
    });

    if (filteredParcels.length === 0) {
      alert('Aucun colis trouvé pour le mois sélectionné.');
      return;
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(month) - 1];
    
    exportMonthlyReportToExcel(filteredParcels, `Bilan_${monthName}_${year}_${user.name}`);
  };

  const handleExportWeeklyExcel = () => {
    if (allParcels.length === 0) {
      alert('Aucun colis à exporter.');
      return;
    }
    exportWeeklyReportToExcel(allParcels);
  };

  const statCards = stats ? [
    { title: 'Créés Aujourd\'hui', value: stats.totalParcels, icon: Package, color: 'bg-blue-500' },
    { title: 'Revenus Aujourd\'hui', value: `${stats.revenue.toLocaleString()} FCFA`, icon: DollarSign, color: 'bg-green-500' },
    { title: 'Colis Payés', value: stats.paidParcels, icon: CheckCircle, color: 'bg-purple-500' },
    { title: 'Colis Destinés', value: stats.destinedCount, icon: Package, color: 'bg-indigo-500' },
    { title: 'Livrés Aujourd\'hui', value: stats.deliveredParcels, icon: Clock, color: 'bg-orange-500' }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex flex-wrap gap-1 bg-black/20 rounded-lg p-1">
          {[
            { key: 'overview', label: 'Tableau de bord', icon: Package },
            { key: 'parcels', label: 'Tous les colis', icon: Package },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
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
    </div>
  );
}
