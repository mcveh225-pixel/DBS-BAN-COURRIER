import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, Truck, Package, CreditCard, Printer, Send, Archive, FileDown, TrendingUp, User as UserIcon, Calendar, MessageSquare, Edit, X, Trash2, ChevronLeft, AlertTriangle, Clock } from 'lucide-react';
import { getParcels, updateParcel, Parcel, getCurrentUser, archiveParcel, getUsers, User, getDisplayStatus, getStatusColor, deleteParcel, isParcelDelayed, getParcelDelayHours } from '../lib/auth';
import { sendBothNotifications, createParcelArrivedMessage, createParcelDeliveredMessage, logNotification, sendSMS, createManualSMSMessage } from '../lib/notifications';
import { printReceipt } from '../lib/receipt';
import { exportParcelListToExcel } from '../lib/exportUtils';
import CreateParcelForm from './CreateParcelForm';
import ConfirmationModal from './ConfirmationModal';
import NotificationModal from './NotificationModal';
import ParcelDetailsModal from './ParcelDetailsModal';

interface ParcelListProps {
  isAdmin: boolean;
  userCity: string;
  onParcelClick?: (parcel: Parcel) => void;
}

export default function ParcelList({ isAdmin, userCity, onParcelClick }: ParcelListProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<boolean>(false);
  const [arrivalDateFilter, setArrivalDateFilter] = useState('');
  const [delayedFilter, setDelayedFilter] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    parcelId: string;
    parcelCode: string;
  }>({
    isOpen: false,
    parcelId: '',
    parcelCode: ''
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    parcelId: string;
    parcelCode: string;
  }>({
    isOpen: false,
    parcelId: '',
    parcelCode: ''
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
    setLoading(true);
    const [allParcels, allUsers] = await Promise.all([
      getParcels(),
      getUsers()
    ]);
    
    const currentUser = getCurrentUser();
    let parcelsToSet = allParcels;
    
    if (!isAdmin && currentUser) {
      parcelsToSet = allParcels.filter(p => 
        p.createdBy === currentUser.id || 
        (p.destinationCity === userCity && ['EXPEDIE', 'EN_TRANSIT', 'ARRIVE'].includes(p.status))
      );
    }

    setParcels(parcelsToSet);
    setFilteredParcels(parcelsToSet);
    setUsers(allUsers);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  useEffect(() => {
    let filtered = parcels;
    const today = new Date().toLocaleDateString();

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.recipientPhone.includes(searchTerm)
      );
    }
    if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
    if (courierFilter) filtered = filtered.filter(p => p.createdBy === courierFilter);
    if (dateFilter) {
      filtered = filtered.filter(p => new Date(p.createdAt).toLocaleDateString() === today);
    }
    if (arrivalDateFilter) {
      filtered = filtered.filter(p => p.arrivedAt && p.arrivedAt.split('T')[0] === arrivalDateFilter);
    }
    if (delayedFilter) {
      filtered = filtered.filter(p => isParcelDelayed(p));
    }
    setFilteredParcels(filtered);
  }, [parcels, searchTerm, statusFilter, courierFilter, dateFilter, arrivalDateFilter, delayedFilter]);

  const currentUser = getCurrentUser();

  const handleStatusUpdate = async (parcelId: string, newStatus: Parcel['status']) => {
    const parcel = parcels.find(p => p.id === parcelId);
    if (!parcel) return;

    try {
      const updates: Partial<Parcel> = { status: newStatus };
      const updated = await updateParcel(parcelId, updates);
      if (updated) {
        setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
        if (selectedParcel?.id === parcelId) {
          setSelectedParcel(updated);
        }
        setNotificationModal({
          isOpen: true,
          title: 'Statut mis à jour',
          message: `Le colis ${updated.code} est désormais : ${getDisplayStatus(updated.status)}.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Erreur de mise à jour du statut:', err);
      setNotificationModal({
        isOpen: true,
        title: 'Erreur',
        message: 'Erreur lors de la mise à jour du statut du colis : ' + (err?.message || 'Erreur réseau'),
        type: 'error'
      });
    }
  };

  const handlePayment = async (parcelId: string) => {
    try {
      const updated = await updateParcel(parcelId, { isPaid: true, status: 'PAYE' });
      if (updated) {
        setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
        setNotificationModal({
          isOpen: true,
          title: 'Paiement enregistré',
          message: `Le paiement du colis ${updated.code} a été confirmé.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Erreur lors du paiement:', err);
      setNotificationModal({
        isOpen: true,
        title: 'Erreur',
        message: 'Impossible d\'enregistrer le paiement : ' + (err?.message || 'Erreur réseau'),
        type: 'error'
      });
    }
  };

  const handleShip = async (parcelId: string) => {
    try {
      const updated = await updateParcel(parcelId, { status: 'EXPEDIE' });
      if (updated) {
        setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
        if (selectedParcel?.id === parcelId) {
          setSelectedParcel(updated);
        }
        setNotificationModal({
          isOpen: true,
          title: 'Colis Expédié',
          message: `Le colis ${updated.code} est désormais marqué comme EXPÉDIÉ avec succès.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'expédition:', err);
      setNotificationModal({
        isOpen: true,
        title: 'Erreur lors de l\'expédition',
        message: 'Impossible de marquer le colis comme expédié : ' + (err?.message || 'Erreur réseau ou base de données'),
        type: 'error'
      });
    }
  };

  const handleArchiveParcel = (parcelId: string, parcelCode: string) => {
    setConfirmModal({
      isOpen: true,
      parcelId,
      parcelCode
    });
  };

  const confirmArchive = async () => {
    const { parcelId } = confirmModal;
    const success = await archiveParcel(parcelId);
    if (success) {
      loadData();
      setConfirmModal({ isOpen: false, parcelId: '', parcelCode: '' });
    } else {
      setNotificationModal({
        isOpen: true,
        title: 'Erreur',
        message: 'Erreur lors de l\'annulation du colis.',
        type: 'error'
      });
    }
  };

  const handleDeleteParcel = (parcelId: string, parcelCode: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      parcelId,
      parcelCode
    });
  };

  const confirmDelete = async () => {
    const { parcelId } = deleteConfirmModal;
    const success = await deleteParcel(parcelId);
    if (success) {
      setParcels(prev => prev.filter(p => p.id !== parcelId));
      setDeleteConfirmModal({ isOpen: false, parcelId: '', parcelCode: '' });
      setNotificationModal({
        isOpen: true,
        title: 'Succès',
        message: 'Le colis a été supprimé définitivement.',
        type: 'success'
      });
    } else {
      setNotificationModal({
        isOpen: true,
        title: 'Erreur',
        message: 'Erreur lors de la suppression définitive du colis.',
        type: 'error'
      });
    }
  };

  const handleEditSuccess = (updatedParcel: Parcel) => {
    setParcels(prev => prev.map(p => p.id === updatedParcel.id ? updatedParcel : p));
    setEditingParcel(null);
  };

  const handleSendManualSMS = async (parcel: Parcel) => {
    const message = createManualSMSMessage(
      parcel.code, 
      getDisplayStatus(parcel.status), 
      parcel.destinationCity,
      parcel.senderName,
      parcel.recipientName
    );
    const success = await sendSMS(parcel.recipientPhone, message);
    if (success) {
      logNotification('SMS Manuel', parcel.recipientPhone, parcel.code);
    }
  };

  const isDestinationCourier = (parcel: Parcel) => parcel.destinationCity === userCity;

  const handleExport = () => {
    if (filteredParcels.length === 0) {
      setNotificationModal({
        isOpen: true,
        title: 'Export impossible',
        message: 'Aucun colis à exporter.',
        type: 'info'
      });
      return;
    }
    exportParcelListToExcel(filteredParcels, users, 'Liste_Colis_Filtres');
  };

  const today = new Date().toLocaleDateString();
  const todayParcelsCount = parcels.filter(p => 
    new Date(p.createdAt).toLocaleDateString() === today
  ).length;
  const delayedParcelsCount = parcels.filter(p => isParcelDelayed(p)).length;

  if (editingParcel) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-white/15">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setEditingParcel(null)}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/10 flex items-center justify-center cursor-pointer"
              title="Retour à la liste"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                Modification du Colis <span className="font-mono text-blue-400 font-black">{editingParcel.code}</span>
              </h2>
              <p className="text-gray-400 text-xs mt-1">Mettez à jour les informations du colis et enregistrez pour appliquer les modifications.</p>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-black/30 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase block select-none">Statut Actuel</span>
            <span className={`px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase tracking-wider ${getStatusColor(editingParcel.status)} text-white block`}>
              {getDisplayStatus(editingParcel.status)}
            </span>
          </div>
        </div>

        <CreateParcelForm 
          userId={currentUser?.id || ''} 
          parcel={editingParcel} 
          onCancel={() => setEditingParcel(null)}
          onSuccess={handleEditSuccess}
        />
      </div>
    );
  }

  if (selectedParcel) {
    return (
      <ParcelDetailsModal 
        parcel={selectedParcel}
        onBack={() => setSelectedParcel(null)}
        onStatusUpdate={handleStatusUpdate}
        onEdit={(p) => {
          setSelectedParcel(null);
          setEditingParcel(p);
        }}
        onCancel={handleArchiveParcel}
        onDelete={handleDeleteParcel}
        userCity={userCity}
        userId={currentUser?.id}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            Gestion des Colis
          </h2>
          <div className="flex flex-wrap gap-2.5 mt-1">
            <span className="px-3 py-1 bg-blue-600/20 border border-blue-600/30 rounded-full text-xs font-medium text-blue-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Aujourd'hui: {todayParcelsCount}
            </span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-400">
              Total: {parcels.length}
            </span>
            {delayedParcelsCount > 0 && (
              <button
                onClick={() => setDelayedFilter(!delayedFilter)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  delayedFilter
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 animate-pulse'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Retards &gt;48h ({delayedParcelsCount})
              </button>
            )}
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <FileDown className="w-4 h-4" />
            Exporter
          </button>
        )}
      </div>

      {/* Banner Notification Suivi Proactif 48h */}
      {delayedParcelsCount > 0 && (
        <div className="mb-6 p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-200 shadow-lg shadow-amber-950/20 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold text-white text-sm flex items-center gap-2">
                Alerte Suivi Proactif ({delayedParcelsCount} {delayedParcelsCount > 1 ? 'colis en retard' : 'colis en retard'})
              </p>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {delayedParcelsCount > 1 ? 'Ces colis sont' : 'Ce colis est'} en cours de traitement depuis plus de 48 heures sans livraison finale.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDelayedFilter(!delayedFilter)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              delayedFilter 
                ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {delayedFilter ? 'Voir tous les colis' : `Filtrer les ${delayedParcelsCount} retards (>48h)`}
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Rechercher par code, nom ou téléphone..." />
        </div>
        
        <div className="flex flex-wrap gap-4">
          {isAdmin && (
            <div className="w-full md:w-48 relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select value={courierFilter} onChange={(e) => setCourierFilter(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none appearance-none">
                <option value="">Tous les responsables</option>
                {users.filter(u => u.role === 'courier').map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full md:w-48 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none appearance-none">
              <option value="">Tous les statuts</option>
              <option value="ENREGISTRE">Enregistré</option>
              <option value="PAYE">Payé</option>
              <option value="EXPEDIE">Expédié</option>
              <option value="EN_TRANSIT">En Transit</option>
              <option value="ARRIVE">Arrivé</option>
              <option value="LIVRE">Livré</option>
            </select>
          </div>

          <div className="w-full md:w-48 relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="date" 
              value={arrivalDateFilter} 
              onChange={(e) => setArrivalDateFilter(e.target.value)} 
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none [color-scheme:dark]"
              title="Filtrer par date d'arrivée"
            />
          </div>

          <button 
            onClick={() => setDateFilter(!dateFilter)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              dateFilter 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-medium">Aujourd'hui</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 text-gray-300">Code</th>
              <th className="py-3 text-gray-300">Destinataire</th>
              {isAdmin && <th className="py-3 text-gray-300">Responsable</th>}
              <th className="py-3 text-gray-300">Tarif</th>
              <th className="py-3 text-gray-300">Statut</th>
              <th className="py-3 text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParcels.map(parcel => {
              const isDelayed = isParcelDelayed(parcel);
              return (
                <tr 
                  key={parcel.id} 
                  className={`border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer group ${
                    isDelayed ? 'bg-amber-500/10 hover:bg-amber-500/20 border-l-4 border-l-amber-500' : ''
                  }`}
                  onClick={() => onParcelClick ? onParcelClick(parcel) : setSelectedParcel(parcel)}
                >
                  <td className="py-4 text-white">
                    <div className="flex flex-col">
                      <span className="font-bold flex items-center gap-1.5">
                        {parcel.code}
                        {isDelayed && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" title={`Retard +${getParcelDelayHours(parcel)}h`} />
                        )}
                      </span>
                      <span className="text-[10px] text-gray-500 opacity-50 group-hover:opacity-100 transition-opacity">Cliquer pour détails</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="text-white">{parcel.recipientName}</p>
                    <p className="text-xs text-gray-400">{parcel.quantity} x {parcel.packageType}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{parcel.originCity}</span>
                      <span className="text-gray-600 text-xs text-[10px]">→</span>
                      <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">{parcel.destinationCity}</span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="py-4 text-gray-300 text-sm">
                      {users.find(u => u.id === parcel.createdBy)?.name || 'Inconnu'}
                    </td>
                  )}
                  <td className="py-4">
                    <p className="text-green-400">{parcel.price.toLocaleString()} FCFA</p>
                    <p className="text-xs">{parcel.isPaid ? '✓ Payé' : 'Non payé'}</p>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs text-white ${getStatusColor(parcel.status)}`}>
                        {getDisplayStatus(parcel.status)}
                      </span>
                      {isDelayed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse" title={`En cours depuis ${getParcelDelayHours(parcel)}h`}>
                          <Clock className="w-3 h-3 text-amber-400" />
                          +48h ({getParcelDelayHours(parcel)}h)
                        </span>
                      )}
                    </div>
                  </td>
                <td className="py-4">
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {!parcel.isPaid && (parcel.createdBy === currentUser?.id || parcel.originCity === userCity || isAdmin) && <button onClick={() => handlePayment(parcel.id)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-700 transition-colors"><CreditCard className="w-3 h-3" /> Payer</button>}
                    {(parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (parcel.createdBy === currentUser?.id || parcel.originCity === userCity || isAdmin) && <button onClick={() => handleShip(parcel.id)} className="bg-indigo-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:bg-indigo-700 transition-colors"><Send className="w-3 h-3" /> Expédier</button>}
                    {parcel.isPaid && (isAdmin || parcel.createdBy === currentUser?.id || parcel.originCity === userCity) && <button onClick={() => printReceipt(parcel)} className="bg-purple-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><Printer className="w-3 h-3" /> Reçu</button>}
                    
                    {isAdmin && (parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (
                      <button 
                        onClick={() => setEditingParcel(parcel)} 
                        className="bg-amber-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-amber-700 transition-colors"
                      >
                        <Edit className="w-3 h-3" /> Modifier
                      </button>
                    )}
                    {isAdmin && (parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (
                      <button 
                        onClick={() => handleArchiveParcel(parcel.id, parcel.code)} 
                        className="bg-red-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-red-700 transition-colors"
                      >
                        <Archive className="w-3 h-3" /> Annuler
                      </button>
                    )}

                    {parcel.status !== 'LIVRE' && parcel.status !== 'ANNULE' && (
                      <button 
                        onClick={() => handleSendManualSMS(parcel)} 
                        className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-blue-600 transition-colors"
                        title="Envoyer SMS au destinataire"
                      >
                        <MessageSquare className="w-3 h-3" /> SMS
                      </button>
                    )}
                    {isDestinationCourier(parcel) && (parcel.status === 'EN_TRANSIT' || parcel.status === 'EXPEDIE') && <button onClick={() => handleStatusUpdate(parcel.id, 'ARRIVE')} className="bg-orange-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><Truck className="w-3 h-3" /> Arrivé</button>}
                    {isDestinationCourier(parcel) && parcel.status === 'ARRIVE' && <button onClick={() => handleStatusUpdate(parcel.id, 'LIVRE')} className="bg-green-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Livrer</button>}
                    
                    {parcel.status === 'ANNULE' && isAdmin && (
                      <button 
                        onClick={() => handleDeleteParcel(parcel.id, parcel.code)} 
                        className="bg-red-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>



      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title="Annuler le colis"
        message={`Voulez-vous vraiment annuler le colis ${confirmModal.parcelCode} ? Le colis restera visible avec le statut "ANNULÉ" mais ne sera plus comptabilisé dans les revenus.`}
        confirmLabel="Annuler le colis"
        cancelLabel="Garder le colis"
        onConfirm={confirmArchive}
        onCancel={() => setConfirmModal({ isOpen: false, parcelId: '', parcelCode: '' })}
        isDanger={true}
      />

      <ConfirmationModal 
        isOpen={deleteConfirmModal.isOpen}
        title="Supprimer définitivement"
        message={`Voulez-vous vraiment supprimer DÉFINITIVEMENT le colis ${deleteConfirmModal.parcelCode} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, parcelId: '', parcelCode: '' })}
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
