import React, { useState, useEffect } from 'react';
import { Package, DollarSign, CheckCircle, Clock, Plus, Printer, FileDown, BarChart3, Calendar, Edit, Archive, X, Truck, Trash2 } from 'lucide-react';
import { User, getCourierDailyStats, getParcels, getUsers, Parcel, getDisplayStatus, getStatusColor, cancelParcel, deleteParcel, updateParcel } from '../lib/auth';
import { printReceipt } from '../lib/receipt';
import { exportMonthlyReportToExcel, exportTenDayReportToExcel } from '../lib/exportUtils';
import { sendBothNotifications, createParcelArrivedMessage, createParcelDeliveredMessage, logNotification } from '../lib/notifications';
import ParcelList from './ParcelList';
import CreateParcelForm from './CreateParcelForm';
import ParcelDetailsModal from './ParcelDetailsModal';
import ConfirmationModal from './ConfirmationModal';
import NotificationModal from './NotificationModal';

interface CourierDashboardProps {
  user: User;
}

export default function CourierDashboard({ user }: CourierDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'parcels' | 'create' | 'bilan'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [allParcels, setAllParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [revenueBreakdownModal, setRevenueBreakdownModal] = useState<{ isOpen: boolean; month: string; data: any[] }>({
    isOpen: false,
    month: '',
    data: []
  });
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; title: string; parcels: Parcel[] }>({
    isOpen: false,
    title: '',
    parcels: []
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    parcelId: string;
    parcelCode: string;
    type: 'cancel' | 'delete';
  }>({
    isOpen: false,
    parcelId: '',
    parcelCode: '',
    type: 'cancel'
  });
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
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
  
  // Calculate 10-day period stats
  const getCurrentTenDayPeriod = () => {
    const now = new Date();
    const day = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth();

    let startDay, endDay;

    if (day <= 10) {
      startDay = 1;
      endDay = 10;
    } else if (day <= 20) {
      startDay = 11;
      endDay = 20;
    } else {
      startDay = 21;
      endDay = new Date(year, month + 1, 0).getDate();
    }

    const startDate = new Date(year, month, startDay);
    startDate.setHours(0, 0, 0, 0);
    
    return { 
      start: startDate.toISOString().split('T')[0],
      label: `du ${startDay} au ${endDay}`
    };
  };

  const tenDayPeriod = getCurrentTenDayPeriod();
  
  const todayMyParcels = myParcels.filter(p => p.createdAt.startsWith(todayISO) && p.status !== 'ANNULE');
  const destinedParcels = allParcels.filter(p => p.destinationCity === user.city && !['LIVRE', 'ANNULE'].includes(p.status));

  const monthlyRevenue = myParcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.startsWith(currentMonth))
    .reduce((sum, p) => sum + p.price, 0);

  const handleExportExcel = () => {
    if (myParcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis à exporter.',
        type: 'info'
      });
      return;
    }
    
    const [year, month] = selectedMonth.split('-');
    const filteredParcels = myParcels.filter(p => {
      const date = new Date(p.createdAt);
      return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
    });

    if (filteredParcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis trouvé pour le mois sélectionné.',
        type: 'info'
      });
      return;
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(month) - 1];
    
    exportMonthlyReportToExcel(filteredParcels, users, `Bilan_${monthName}_${year}_${user.name}`);
  };

  const handleExportWeeklyExcel = () => {
    if (myParcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis à exporter.',
        type: 'info'
      });
      return;
    }
    exportTenDayReportToExcel(myParcels, users);
  };

  const handleCancelParcel = (parcelId: string, parcelCode: string) => {
    setConfirmModal({
      isOpen: true,
      parcelId,
      parcelCode,
      type: 'cancel'
    });
  };

  const handleDeleteParcel = (parcelId: string, parcelCode: string) => {
    setConfirmModal({
      isOpen: true,
      parcelId,
      parcelCode,
      type: 'delete'
    });
  };

  const confirmAction = async () => {
    const { parcelId, type } = confirmModal;
    let success = false;
    
    if (type === 'cancel') {
      success = await cancelParcel(parcelId);
    } else {
      success = await deleteParcel(parcelId);
    }

    if (success) {
      loadData();
      setConfirmModal({ isOpen: false, parcelId: '', parcelCode: '', type: 'cancel' });
    } else {
      setNotificationModal({
        isOpen: true,
        title: 'Erreur',
        message: `Erreur lors de la ${type === 'cancel' ? 'suspension' : 'suppression'} du colis.`,
        type: 'error'
      });
    }
  };

  const handleEditSuccess = () => {
    loadData();
    setEditingParcel(null);
  };

  const handleStatusUpdate = async (parcelId: string, newStatus: Parcel['status']) => {
    const parcel = allParcels.find(p => p.id === parcelId);
    if (!parcel) return;

    const updates: Partial<Parcel> = { status: newStatus };
    if (newStatus === 'ARRIVE') {
      updates.arrivedAt = new Date().toISOString();
      sendBothNotifications(parcel.recipientPhone, createParcelArrivedMessage(parcel.code));
      logNotification('Notification (Arrivée)', parcel.recipientPhone, parcel.code);
    } else if (newStatus === 'LIVRE') {
      updates.deliveredAt = new Date().toISOString();
      sendBothNotifications(parcel.senderPhone, createParcelDeliveredMessage(parcel.code));
      logNotification('Notification (Livraison)', parcel.senderPhone, parcel.code);
    }

    const updated = await updateParcel(parcelId, updates);
    if (updated) {
      // Update local state for the modal
      setDetailsModal(prev => ({
        ...prev,
        parcels: prev.parcels.map(p => p.id === parcelId ? updated : p)
      }));
      loadData();
    }
  };

  const handleShowRevenueBreakdown = () => {
    const [year, month] = currentMonth.split('-');
    const monthParcels = myParcels.filter(p => {
      const date = new Date(p.createdAt);
      return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month) && p.status !== 'ANNULE';
    });

    const periods = [
      { label: 'du 1 au 10', start: 1, end: 10, revenue: 0, count: 0 },
      { label: 'du 11 au 20', start: 11, end: 20, revenue: 0, count: 0 },
      { label: 'du 21 au ' + new Date(parseInt(year), parseInt(month), 0).getDate(), start: 21, end: 31, revenue: 0, count: 0 }
    ];

    monthParcels.forEach(p => {
      const day = new Date(p.createdAt).getDate();
      const period = periods.find(per => day >= per.start && day <= per.end);
      if (period && p.isPaid) {
        period.revenue += p.price;
        period.count += 1;
      }
    });

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(month) - 1];

    setRevenueBreakdownModal({
      isOpen: true,
      month: `${monthName} ${year}`,
      data: periods
    });
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
    { 
      title: 'Revenus du Mois', 
      value: `${monthlyRevenue.toLocaleString()} FCFA`, 
      icon: BarChart3, 
      color: 'bg-purple-600',
      onClick: handleShowRevenueBreakdown
    },
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
              10 Jours
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
                      <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(parcel.status)}`}>
                        {getDisplayStatus(parcel.status)}
                      </span>
                      {parcel.isPaid && (
                        <button 
                          onClick={() => printReceipt(parcel)}
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-xs"
                        >
                          <Printer className="w-3 h-3" /> Reçu
                        </button>
                      )}
                      {(parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingParcel(parcel)}
                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-xs"
                          >
                            <Edit className="w-3 h-3" /> Modifier
                          </button>
                          <button 
                            onClick={() => handleCancelParcel(parcel.id, parcel.code)}
                            className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs"
                          >
                            <Archive className="w-3 h-3" /> Annuler
                          </button>
                        </div>
                      )}
                      {parcel.status === 'ANNULE' && (
                        <button 
                          onClick={() => handleDeleteParcel(parcel.id, parcel.code)}
                          className="text-red-500 hover:text-red-400 flex items-center gap-1 text-xs"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
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
                      <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(parcel.status)}`}>
                        {getDisplayStatus(parcel.status)}
                      </span>
                      <div className="flex gap-2">
                        {parcel.status === 'EN_TRANSIT' && (
                          <button 
                            onClick={() => handleStatusUpdate(parcel.id, 'ARRIVE')}
                            className="bg-orange-600 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" /> Arrivé
                          </button>
                        )}
                        {parcel.status === 'ARRIVE' && (
                          <button 
                            onClick={() => handleStatusUpdate(parcel.id, 'LIVRE')}
                            className="bg-green-600 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Livrer
                          </button>
                        )}
                      </div>
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
            {/* Bilan 10 Jours */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Bilan des 10 Jours ({tenDayPeriod.label})
                </h3>
                <button 
                  onClick={handleExportWeeklyExcel}
                  className="p-2 bg-emerald-600/20 border border-emerald-600/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                  title="Exporter la période"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
              
              {(() => {
                const periodParcels = myParcels.filter(p => p.createdAt.split('T')[0] >= tenDayPeriod.start && p.status !== 'ANNULE');
                const periodRevenue = periodParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
                const periodPaidCount = periodParcels.filter(p => p.isPaid).length;
                const periodDelivered = periodParcels.filter(p => p.status === 'LIVRE').length;

                const tariffs: Record<number, number> = {};
                periodParcels.filter(p => p.isPaid).forEach(p => {
                  tariffs[p.price] = (tariffs[p.price] || 0) + 1;
                });

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Créés</p>
                        <p className="text-2xl font-bold text-white mt-1">{periodParcels.length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Revenu Période</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{periodRevenue.toLocaleString()} FCFA</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Payés</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{periodPaidCount}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Colis Livrés</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">{periodDelivered}</p>
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
                          <p className="text-xs text-gray-500 italic">Aucun paiement sur cette période</p>
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
      {revenueBreakdownModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1c2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <div>
                <h3 className="text-xl font-bold text-white">Bilan Mensuel</h3>
                <p className="text-sm text-purple-400">{revenueBreakdownModal.month}</p>
              </div>
              <button 
                onClick={() => setRevenueBreakdownModal({ ...revenueBreakdownModal, isOpen: false })}
                className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {revenueBreakdownModal.data.map((period, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">{period.label}</span>
                    <span className="bg-purple-600/20 text-purple-400 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/20">
                      {period.count} colis payés
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{period.revenue.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 font-medium">FCFA</span>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-semibold">Total du Mois</span>
                  <span className="text-xl font-bold text-purple-400">
                    {revenueBreakdownModal.data.reduce((sum, p) => sum + p.revenue, 0).toLocaleString()} FCFA
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setRevenueBreakdownModal({ ...revenueBreakdownModal, isOpen: false })}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal.isOpen && (
        <ParcelDetailsModal 
          title={detailsModal.title}
          parcels={detailsModal.parcels}
          onClose={() => setDetailsModal({ ...detailsModal, isOpen: false })}
          onStatusUpdate={handleStatusUpdate}
          userCity={user.city}
        />
      )}

      {editingParcel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-4xl my-8">
            <div className="relative">
              <button 
                onClick={() => setEditingParcel(null)}
                className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <CreateParcelForm 
                userId={user.id} 
                parcel={editingParcel} 
                onCancel={() => setEditingParcel(null)}
                onSuccess={handleEditSuccess}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'cancel' ? "Annuler le colis" : "Supprimer le colis"}
        message={confirmModal.type === 'cancel' 
          ? `Voulez-vous vraiment annuler le colis ${confirmModal.parcelCode} ? Il ne sera plus comptabilisé dans les revenus.`
          : `Voulez-vous vraiment supprimer définitivement le colis ${confirmModal.parcelCode} ? Cette action est irréversible.`
        }
        confirmLabel={confirmModal.type === 'cancel' ? "Annuler le colis" : "Supprimer définitivement"}
        cancelLabel="Garder le colis"
        onConfirm={confirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, parcelId: '', parcelCode: '', type: 'cancel' })}
        isDanger={true}
      />

      <NotificationModal 
        isOpen={notificationModal.isOpen}
        title={notificationModal.title}
        message={notificationModal.message}
        type={notificationModal.type}
        onClose={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
