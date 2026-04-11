import React, { useState, useEffect } from 'react';
import { Users, Package, DollarSign, TrendingUp, Plus, Eye, Shield, Trash2, FileDown, Bell } from 'lucide-react';
import { getUsers, getParcels, createCourierUser, createAdminUser, deleteUser, archiveUser, getDailyRevenues, getCourierDailyStats, getCurrentUser, getDisplayStatus, getStatusColor } from '../lib/auth';
import { exportMonthlyReportToExcel, exportTenDayReportToExcel } from '../lib/exportUtils';
import { sendSMS } from '../lib/notifications';
import CreateCourierModal from './CreateCourierModal';
import CreateAdminModal from './CreateAdminModal';
import ParcelList from './ParcelList';
import RevenueChart from './RevenueChart';
import AdminBreakdownModal from './AdminBreakdownModal';
import ConfirmationModal from './ConfirmationModal';
import NotificationModal from './NotificationModal';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'couriers' | 'parcels' | 'revenue' | 'notifications'>('overview');
  const [dailyRevenues, setDailyRevenues] = useState<any[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<string[]>([]);
  const [courierStats, setCourierStats] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
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
  const currentUser = getCurrentUser();

  const loadData = async () => {
    const [usersData, parcelsData, revenuesData] = await Promise.all([
      getUsers(),
      getParcels(),
      getDailyRevenues()
    ]);
    setUsers(usersData);
    setParcels(parcelsData);
    setDailyRevenues(revenuesData);

    // Load notification logs
    const logs = JSON.parse(localStorage.getItem('notification_logs') || '[]');
    setNotificationLogs(logs);

    // Load stats for each user
    const stats: Record<string, any> = {};
    for (const user of usersData) {
      stats[user.id] = await getCourierDailyStats(user.id);
    }
    setCourierStats(stats);
  };

  useEffect(() => {
    loadData();
  }, []);

  const courierUsers = users.filter(u => u.role === 'courier');

  const todayUTC = new Date().toISOString().split('T')[0];
  const todayRevenue = parcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.split('T')[0] === todayUTC)
    .reduce((sum, p) => sum + p.price, 0);
  
  const todayParcels = parcels.filter(p => p.createdAt.split('T')[0] === todayUTC && p.status !== 'ANNULE');

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
  const currentMonthUTC = new Date().toISOString().slice(0, 7);
  const currentYearUTC = new Date().toISOString().slice(0, 4);

  const monthlyRevenue = parcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.startsWith(currentMonthUTC))
    .reduce((sum, p) => sum + p.price, 0);

  const totalRevenue = parcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.startsWith(currentYearUTC))
    .reduce((sum, p) => sum + p.price, 0);

  const tenDayRevenue = parcels
    .filter(p => p.isPaid && p.status !== 'ANNULE' && p.createdAt.split('T')[0] >= tenDayPeriod.start)
    .reduce((sum, p) => sum + p.price, 0);
    
  const tenDayParcels = parcels.filter(p => p.createdAt.split('T')[0] >= tenDayPeriod.start && p.status !== 'ANNULE');

  const handleCreateCourier = async (email: string, name: string, city: string, password?: string) => {
    try {
      const newUser = await createCourierUser(email, name, city, password);
      setUsers([...users, newUser]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating courier:', err);
    }
  };

  const handleCreateAdmin = async (email: string, name: string, password?: string) => {
    try {
      const newUser = await createAdminUser(email, name, password);
      setUsers([...users, newUser]);
      setShowCreateAdminModal(false);
    } catch (err) {
      console.error('Error creating admin:', err);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, userRole: string) => {
    if (userId === 'admin-1') {
      setNotificationModal({
        isOpen: true,
        title: 'Action impossible',
        message: "L'administrateur principal ne peut pas être supprimé.",
        type: 'error'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Supprimer l\'utilisateur',
      message: `Êtes-vous sûr de vouloir supprimer ${userRole === 'admin' ? "l'administrateur" : "le responsable"} "${userName}" ?`,
      onConfirm: async () => {
        try {
          const success = await deleteUser(userId);
          if (success) {
            setUsers(users.filter(u => u.id !== userId));
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          } else {
            setNotificationModal({
              isOpen: true,
              title: 'Erreur',
              message: 'Impossible de supprimer le dernier administrateur.',
              type: 'error'
            });
          }
        } catch (err) {
          console.error('Error deleting user:', err);
        }
      }
    });
  };

  const handleArchiveUser = async (userId: string, userName: string) => {
    if (userId === 'admin-1') {
      setNotificationModal({
        isOpen: true,
        title: 'Action impossible',
        message: "L'administrateur principal ne peut pas être archivé.",
        type: 'error'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Archiver l\'utilisateur',
      message: `Voulez-vous archiver le compte de "${userName}" ? Il ne pourra plus se connecter, et son compte sera définitivement supprimé une fois que tous ses colis auront été nettoyés (après 30 jours).`,
      onConfirm: async () => {
        try {
          const success = await archiveUser(userId);
          if (success) {
            setUsers(users.map(u => u.id === userId ? { ...u, isArchived: true } : u));
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        } catch (err) {
          console.error('Error archiving user:', err);
        }
      }
    });
  };

  const handleExportExcel = () => {
    if (parcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis à exporter.',
        type: 'info'
      });
      return;
    }
    
    const [year, month] = selectedMonth.split('-');
    const filteredParcels = parcels.filter(p => {
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
    
    exportMonthlyReportToExcel(filteredParcels, users, `Bilan_${monthName}_${year}`);
  };

  const handleExportWeeklyExcel = () => {
    if (parcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis à exporter.',
        type: 'info'
      });
      return;
    }
    exportTenDayReportToExcel(parcels, users);
  };

  const stats = [
    { 
      title: 'Responsables', 
      value: courierUsers.length, 
      icon: Users, 
      color: 'bg-blue-500',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: 'Liste des Responsables',
        type: 'responsables',
        data: courierUsers.map(u => ({
          name: u.name,
          city: u.city,
          value: u.email
        }))
      })
    },
    { 
      title: 'Colis Aujourd\'hui', 
      value: todayParcels.length, 
      icon: Package, 
      color: 'bg-emerald-500',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: 'Colis par Responsable (Aujourd\'hui)',
        type: 'parcels_today',
        data: courierUsers.map(u => {
          const count = todayParcels.filter(p => p.createdBy === u.id).length;
          return {
            name: u.name,
            city: u.city,
            value: `${count} colis`
          };
        }).filter(d => parseInt(d.value) > 0)
      })
    },
    { 
      title: `Colis (${tenDayPeriod.label})`, 
      value: tenDayParcels.length, 
      icon: Package, 
      color: 'bg-indigo-500',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: `Colis par Responsable (${tenDayPeriod.label})`,
        type: 'parcels_week',
        data: courierUsers.map(u => {
          const count = tenDayParcels.filter(p => p.createdBy === u.id).length;
          return {
            name: u.name,
            city: u.city,
            value: `${count} colis`
          };
        }).filter(d => parseInt(d.value) > 0)
      })
    },
    { 
      title: 'Revenus Aujourd\'hui', 
      value: `${todayRevenue.toLocaleString()} FCFA`, 
      icon: TrendingUp, 
      color: 'bg-orange-500',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: 'Revenus par Responsable (Aujourd\'hui)',
        type: 'revenue_today',
        data: courierUsers.map(u => {
          const userTodayParcels = todayParcels.filter(p => p.createdBy === u.id && p.isPaid);
          const revenue = userTodayParcels.reduce((sum, p) => sum + p.price, 0);
          return {
            name: u.name,
            city: u.city,
            value: revenue,
            subValue: userTodayParcels.length
          };
        }).filter(d => (d.value as number) > 0)
      })
    },
    { 
      title: `Revenus (${tenDayPeriod.label})`, 
      value: `${tenDayRevenue.toLocaleString()} FCFA`, 
      icon: DollarSign, 
      color: 'bg-blue-600',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: `Revenus par Responsable (${tenDayPeriod.label})`,
        type: 'revenue_week',
        data: courierUsers.map(u => {
          const userTenDayParcels = tenDayParcels.filter(p => p.createdBy === u.id && p.isPaid);
          const revenue = userTenDayParcels.reduce((sum, p) => sum + p.price, 0);
          return {
            name: u.name,
            city: u.city,
            value: revenue,
            subValue: userTenDayParcels.length
          };
        }).filter(d => (d.value as number) > 0)
      })
    },
    { 
      title: 'Revenus du Mois', 
      value: `${monthlyRevenue.toLocaleString()} FCFA`, 
      icon: DollarSign, 
      color: 'bg-pink-600',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: 'Revenus par Responsable (Mois)',
        type: 'revenue_month',
        data: courierUsers.map(u => {
          const userMonthlyParcels = parcels.filter(p => 
            p.createdBy === u.id && 
            p.isPaid && 
            p.status !== 'ANNULE' && 
            p.createdAt.startsWith(currentMonthUTC)
          );
          const revenue = userMonthlyParcels.reduce((sum, p) => sum + p.price, 0);
          return {
            name: u.name,
            city: u.city,
            value: revenue,
            subValue: userMonthlyParcels.length
          };
        }).filter(d => (d.value as number) > 0)
      })
    },
    { 
      title: 'Revenus de l\'Année', 
      value: `${totalRevenue.toLocaleString()} FCFA`, 
      icon: DollarSign, 
      color: 'bg-purple-500',
      onClick: () => setBreakdownModal({
        isOpen: true,
        title: 'Revenus par Responsable (Année)',
        type: 'revenue_month', // We can reuse this type or add a new one, but revenue_month logic in modal is generic enough
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
      })
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex flex-wrap gap-1 bg-black/20 rounded-lg p-1">
          {[
            { key: 'overview', label: 'Vue d\'ensemble', icon: Eye },
            { key: 'couriers', label: 'Utilisateurs', icon: Users },
            { key: 'parcels', label: 'Colis', icon: Package },
            { key: 'revenue', label: 'Revenus', icon: DollarSign },
            { key: 'notifications', label: 'Notifications', icon: Bell }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index} 
            className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 transition-all ${stat.onClick ? 'cursor-pointer hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
            onClick={stat.onClick}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">{stat.title}</p>
                <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Résumé des Responsables</h3>
            <div className="space-y-3">
              {courierUsers.map(user => {
                const s = courierStats[user.id] || { revenue: 0, deliveredParcels: 0 };
                const userTenDayParcels = parcels.filter(p => p.createdBy === user.id && p.createdAt.split('T')[0] >= tenDayPeriod.start && p.status !== 'ANNULE');
                const userTenDayRevenue = userTenDayParcels.filter(p => p.isPaid).reduce((sum, p) => sum + p.price, 0);
                
                return (
                  <div key={user.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-gray-300">{user.city}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-right text-sm">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Aujourd'hui</p>
                          <p className="text-green-400 font-medium">{s.revenue.toLocaleString()} FCFA</p>
                          <p className="text-gray-400 text-xs">{s.deliveredParcels} livrés</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Période</p>
                          <p className="text-blue-400 font-medium">{userTenDayRevenue.toLocaleString()} FCFA</p>
                          <p className="text-gray-400 text-xs">{userTenDayParcels.length} colis</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Activité Récente</h3>
            <div className="space-y-3">
              {parcels.slice(0, 5).map(parcel => (
                <div key={parcel.id} className="bg-white/5 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{parcel.code}</p>
                      <p className="text-sm text-gray-300">{parcel.destinationCity}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(parcel.status)}`}>
                      {getDisplayStatus(parcel.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'couriers' && (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Gestion des Utilisateurs</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateAdminModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Shield className="w-4 h-4" /> Nouvel Admin
              </button>
              <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nouveau Responsable
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 text-gray-300 font-medium">Nom</th>
                  <th className="py-3 text-gray-300 font-medium">Email</th>
                  <th className="py-3 text-gray-300 font-medium">Rôle</th>
                  <th className="py-3 text-gray-300 font-medium">Ville</th>
                  <th className="py-3 text-gray-300 font-medium">Colis Destinés</th>
                  <th className="py-3 text-gray-300 font-medium">Revenus Aujourd'hui</th>
                  <th className="py-3 text-gray-300 font-medium">Revenus du Mois</th>
                  <th className="py-3 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="py-3 text-white">{user.name}</td>
                    <td className="py-3 text-gray-300">{user.email}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs w-fit ${user.role === 'admin' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                          {user.role === 'admin' ? 'Admin' : 'Responsable'}
                        </span>
                        {user.isArchived && (
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-500 text-white w-fit">
                            Archivé
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-gray-300">{user.city || '-'}</td>
                    <td className="py-3 text-blue-400 font-medium">
                      {courierStats[user.id]?.destinedCount || 0}
                    </td>
                    <td className="py-3">
                      <span className="text-green-400 font-medium">
                        {(courierStats[user.id]?.revenue || 0).toLocaleString()} FCFA
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-purple-400 font-medium">
                        {(() => {
                          const currentMonth = new Date().toISOString().slice(0, 7);
                          return parcels
                            .filter(p => 
                              p.createdBy === user.id && 
                              p.isPaid && 
                              p.status !== 'ANNULE' && 
                              p.createdAt.startsWith(currentMonth)
                            )
                            .reduce((sum, p) => sum + p.price, 0)
                            .toLocaleString();
                        })()} FCFA
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {user.id !== 'admin-1' && user.email !== 'mcveh225@gmail.com' && user.id !== currentUser?.id && !user.isArchived && (
                          <button onClick={() => handleArchiveUser(user.id, user.name)} className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Archiver
                          </button>
                        )}
                        {user.id !== 'admin-1' && user.email !== 'mcveh225@gmail.com' && user.id !== currentUser?.id && (
                          <button onClick={() => handleDeleteUser(user.id, user.name, user.role)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'parcels' && <ParcelList isAdmin={true} userCity="" />}
      {activeTab === 'revenue' && <RevenueChart />}
      
      {activeTab === 'notifications' && (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              Historique des Notifications
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  const phone = prompt('Numéro de téléphone (ex: 0700000000):');
                  if (phone) {
                    const success = await sendSMS(phone, 'Ceci est un test du service SMS DBS-BAN.');
                    if (success) {
                      const logs = JSON.parse(localStorage.getItem('notification_logs') || '[]');
                      setNotificationLogs(logs);
                    }
                  }
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-400/30 px-2 py-1 rounded"
              >
                Tester l'envoi
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('notification_logs');
                  setNotificationLogs([]);
                }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Effacer l'historique
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {notificationLogs.length > 0 ? (
              notificationLogs.map((log, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 rounded-lg p-3 text-sm text-gray-300 font-mono">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 italic">
                Aucune notification envoyée pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && <CreateCourierModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateCourier} />}
      {showCreateAdminModal && <CreateAdminModal onClose={() => setShowCreateAdminModal(false)} onCreate={handleCreateAdmin} />}
      
      {breakdownModal.isOpen && (
        <AdminBreakdownModal 
          title={breakdownModal.title}
          type={breakdownModal.type}
          data={breakdownModal.data}
          onClose={() => setBreakdownModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
