import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, Truck, Package, CreditCard, Printer, Send, Archive, FileDown, TrendingUp, User as UserIcon, Calendar, MessageSquare, Edit, X } from 'lucide-react';
import { getParcels, updateParcel, Parcel, getCurrentUser, archiveParcel, getUsers, User, getDisplayStatus, getStatusColor } from '../lib/auth';
import { sendBothNotifications, createParcelArrivedMessage, createParcelDeliveredMessage, logNotification, sendSMS, createManualSMSMessage } from '../lib/notifications';
import { printReceipt } from '../lib/receipt';
import { exportParcelListToExcel } from '../lib/exportUtils';
import CreateParcelForm from './CreateParcelForm';

interface ParcelListProps {
  isAdmin: boolean;
  userCity: string;
}

export default function ParcelList({ isAdmin, userCity }: ParcelListProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<boolean>(false);
  const [arrivalDateFilter, setArrivalDateFilter] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);

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
        (p.destinationCity === userCity && ['EN_TRANSIT', 'ARRIVE', 'LIVRE'].includes(p.status))
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
    setFilteredParcels(filtered);
  }, [parcels, searchTerm, statusFilter, courierFilter, dateFilter, arrivalDateFilter]);

  const currentUser = getCurrentUser();

  const handleStatusUpdate = async (parcelId: string, newStatus: Parcel['status']) => {
    const parcel = parcels.find(p => p.id === parcelId);
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
    if (updated) setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
  };

  const handlePayment = async (parcelId: string) => {
    const updated = await updateParcel(parcelId, { isPaid: true, status: 'PAYE' });
    if (updated) setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
  };

  const handleShip = async (parcelId: string) => {
    const updated = await updateParcel(parcelId, { status: 'EN_TRANSIT' });
    if (updated) setParcels(prev => prev.map(p => p.id === parcelId ? updated : p));
  };

  const handleArchiveParcel = async (parcelId: string, parcelCode: string) => {
    if (confirm(`Voulez-vous vraiment annuler le colis ${parcelCode} ?`)) {
      const success = await archiveParcel(parcelId);
      if (success) {
        setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: 'ANNULE' } : p));
      } else {
        alert('Erreur lors de l\'annulation du colis.');
      }
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
      alert('Aucun colis à exporter.');
      return;
    }
    exportParcelListToExcel(filteredParcels, users, 'Liste_Colis_Filtres');
  };

  const today = new Date().toLocaleDateString();
  const todayParcelsCount = parcels.filter(p => 
    new Date(p.createdAt).toLocaleDateString() === today
  ).length;

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            Gestion des Colis
          </h2>
          <div className="flex gap-3 mt-1">
            <span className="px-3 py-1 bg-blue-600/20 border border-blue-600/30 rounded-full text-xs font-medium text-blue-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Aujourd'hui: {todayParcelsCount}
            </span>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-400">
              Total: {parcels.length}
            </span>
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
              <option value="EN_TRANSIT">Expédié</option>
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
            {filteredParcels.map(parcel => (
              <tr key={parcel.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-4 text-white">{parcel.code}</td>
                <td className="py-4">
                  <p className="text-white">{parcel.recipientName}</p>
                  <p className="text-xs text-gray-400">{parcel.quantity} x {parcel.packageType}</p>
                  <p className="text-sm text-gray-300">{parcel.destinationCity}</p>
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
                  <span className={`px-3 py-1 rounded-full text-xs text-white ${getStatusColor(parcel.status)}`}>
                    {getDisplayStatus(parcel.status)}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex flex-wrap gap-2">
                    {!parcel.isPaid && parcel.createdBy === currentUser?.id && <button onClick={() => handlePayment(parcel.id)} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> Payer</button>}
                    {parcel.isPaid && parcel.status === 'PAYE' && parcel.createdBy === currentUser?.id && <button onClick={() => handleShip(parcel.id)} className="bg-indigo-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><Send className="w-3 h-3" /> Expédier</button>}
                    {parcel.isPaid && (isAdmin || parcel.createdBy === currentUser?.id) && <button onClick={() => printReceipt(parcel)} className="bg-purple-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><Printer className="w-3 h-3" /> Reçu</button>}
                    
                    {parcel.createdBy === currentUser?.id && (parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (
                      <>
                        <button 
                          onClick={() => setEditingParcel(parcel)} 
                          className="bg-amber-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-amber-700 transition-colors"
                        >
                          <Edit className="w-3 h-3" /> Modifier
                        </button>
                        <button 
                          onClick={() => handleArchiveParcel(parcel.id, parcel.code)} 
                          className="bg-red-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-red-700 transition-colors"
                        >
                          <Archive className="w-3 h-3" /> Annuler
                        </button>
                      </>
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
                    {isDestinationCourier(parcel) && parcel.status === 'EN_TRANSIT' && <button onClick={() => handleStatusUpdate(parcel.id, 'ARRIVE')} className="bg-orange-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><Truck className="w-3 h-3" /> Arrivé</button>}
                    {isDestinationCourier(parcel) && parcel.status === 'ARRIVE' && <button onClick={() => handleStatusUpdate(parcel.id, 'LIVRE')} className="bg-green-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Livrer</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                userId={currentUser?.id || ''} 
                parcel={editingParcel} 
                onCancel={() => setEditingParcel(null)}
                onSuccess={handleEditSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
