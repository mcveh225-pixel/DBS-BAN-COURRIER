import React, { useState, useEffect } from 'react';
import { Search, Clock, ArrowRight, MapPin, User, Calendar, DollarSign, Send, Truck, CheckCircle, Archive, Package, Printer, FileText } from 'lucide-react';
import { Parcel, getParcels, getDisplayStatus, getStatusColor } from '../lib/auth';
import { printReceipt } from '../lib/receipt';

interface ParcelHistoryViewProps {
  initialParcelId?: string;
  onSelectParcel?: (parcel: Parcel) => void;
}

export default function ParcelHistoryView({ initialParcelId, onSelectParcel }: ParcelHistoryViewProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getParcels();
        setParcels(data);
        
        if (initialParcelId) {
          const found = data.find(p => p.id === initialParcelId || p.code === initialParcelId);
          if (found) {
            setSelectedParcel(found);
          }
        }
      } catch (err) {
        console.error('Erreur de chargement des colis:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [initialParcelId]);

  // Handle selected parcel from outside or from autocomplete
  const handleSelect = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setSearchQuery('');
    if (onSelectParcel) {
      onSelectParcel(parcel);
    }
  };

  const filteredParcels = searchQuery.trim() === '' 
    ? [] 
    : parcels.filter(p => 
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.senderPhone.includes(searchQuery) ||
        p.recipientPhone.includes(searchQuery)
      ).slice(0, 5);

  const getTimelineSteps = (parcel: Parcel) => {
    const steps = [];

    // Step 1: Registration
    steps.push({
      status: 'ENREGISTRE' as const,
      title: 'Enregistrement du Colis',
      description: `Le colis a été enregistré par le port de départ à ${parcel.originCity}.`,
      date: parcel.createdAt,
      icon: Package,
      color: 'bg-gray-600',
      textColor: 'text-gray-400',
      active: true,
    });

    // Step 2: Payment
    const isPaid = parcel.isPaid || !!parcel.paidAt;
    steps.push({
      status: 'PAYE' as const,
      title: 'Règlement des Frais',
      description: isPaid 
        ? `Frais de transport de ${parcel.price.toLocaleString()} FCFA réglés avec succès.`
        : 'Attente de règlement des frais de transport.',
      date: parcel.paidAt || (isPaid ? parcel.createdAt : null),
      icon: DollarSign,
      color: isPaid ? 'bg-blue-600' : 'bg-gray-800 text-gray-600 border border-white/5',
      textColor: isPaid ? 'text-blue-400' : 'text-gray-600',
      active: isPaid,
    });

    // Step 3: Shipped
    const isShipped = !!parcel.shippedAt || ['EXPEDIE', 'EN_TRANSIT', 'ARRIVE', 'LIVRE'].includes(parcel.status);
    steps.push({
      status: 'EXPEDIE' as const,
      title: 'Expédition du Colis',
      description: isShipped 
        ? `Le colis a été expédié depuis ${parcel.originCity} en direction de ${parcel.destinationCity}.`
        : 'Préparation pour expédition.',
      date: parcel.shippedAt,
      icon: Send,
      color: isShipped ? 'bg-purple-600' : 'bg-gray-800 text-gray-600 border border-white/5',
      textColor: isShipped ? 'text-purple-400' : 'text-gray-600',
      active: isShipped,
    });

    // Step 4: Arrived
    const isArrived = !!parcel.arrivedAt || ['ARRIVE', 'LIVRE'].includes(parcel.status);
    steps.push({
      status: 'ARRIVE' as const,
      title: 'Arrivée en Gare',
      description: isArrived 
        ? `Le colis a été réceptionné au port de destination de ${parcel.destinationCity}.`
        : 'En transit vers la destination.',
      date: parcel.arrivedAt,
      icon: Truck,
      color: isArrived ? 'bg-orange-600' : 'bg-gray-800 text-gray-600 border border-white/5',
      textColor: isArrived ? 'text-orange-400' : 'text-gray-600',
      active: isArrived,
    });

    // Step 5: Delivered
    const isDelivered = !!parcel.deliveredAt || parcel.status === 'LIVRE';
    steps.push({
      status: 'LIVRE' as const,
      title: 'Livraison Finale',
      description: isDelivered 
        ? `Colis officiellement remis en main propre au destinataire : ${parcel.recipientName}.`
        : 'En attente de récupération par le destinataire.',
      date: parcel.deliveredAt,
      icon: CheckCircle,
      color: isDelivered ? 'bg-green-600' : 'bg-gray-800 text-gray-600 border border-white/5',
      textColor: isDelivered ? 'text-emerald-400' : 'text-gray-600',
      active: isDelivered,
    });

    // Handle cancelled status as an extra node or modification
    if (parcel.status === 'ANNULE') {
      steps.push({
        status: 'ANNULE' as const,
        title: 'Colis Annulé',
        description: 'L\'envoi du colis a été annulé par un administrateur DBS-BAN.',
        date: parcel.deliveredAt || parcel.arrivedAt || parcel.shippedAt || parcel.createdAt,
        icon: Archive,
        color: 'bg-red-600',
        textColor: 'text-red-400',
        active: true,
      });
    }

    // Sort step transitions by date to form chronological order if present
    return steps;
  };

  const calculateDuration = (start: string, end: string | null | undefined) => {
    if (!end) return null;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffMs = endTime - startTime;
    
    if (diffMs < 0) return null;
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      return `+ ${diffDays}j ${remainingHours}h`;
    }
    if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `+ ${diffHours}h ${remainingMins}m`;
    }
    return `+ ${diffMins} min`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-white/15">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Traçabilité & Historique des Colis
          </h2>
          <p className="text-gray-400 text-xs mt-1">Recherchez un colis pour consulter son parcours complet en temps réel.</p>
        </div>

        {/* Global stats quick view */}
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-black/30 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase block select-none">Total Enregistrés</span>
            <span className="text-lg font-black text-white">{parcels.length}</span>
          </div>
          <div className="px-4 py-2 bg-black/30 rounded-xl border border-white/5 text-center">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase block select-none">Livrés</span>
            <span className="text-lg font-black text-green-400">
              {parcels.filter(p => p.status === 'LIVRE').length}
            </span>
          </div>
        </div>
      </div>

      {/* Search Input Card */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 relative">
        <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Recherche de Colis</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-5 h-5 text-gray-500" />
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-xl pl-11 pr-4 py-3 text-white outline-none placeholder-gray-500 text-sm font-medium transition-all"
            placeholder="Saisissez le code du colis (ex: DBS-YYMMDD-XXXX) ou le nom de l'expéditeur/destinataire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Autocomplete Results Box */}
        {filteredParcels.length > 0 && (
          <div className="absolute z-20 left-6 right-6 mt-1 bg-slate-930 border border-white/15 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden divide-y divide-white/5">
            {filteredParcels.map((parcel) => (
              <button
                key={parcel.id}
                onClick={() => handleSelect(parcel)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-blue-400 text-xs">{parcel.code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(parcel.status)} text-white`}>
                      {getDisplayStatus(parcel.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                    <span className="text-gray-300 font-bold">{parcel.senderName}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-gray-600" />
                    <span className="text-gray-300 font-bold">{parcel.recipientName}</span>
                    <span className="text-gray-600">|</span>
                    <span>Dest: <strong className="text-white font-semibold">{parcel.destinationCity}</strong></span>
                  </div>
                </div>
                <div className="text-right text-gray-500 font-mono text-[10px]">
                  {new Date(parcel.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Details & Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-slate-900/10 rounded-2xl border border-white/5">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 text-xs font-medium">Chargement des données de traçabilité...</p>
          </div>
        </div>
      ) : selectedParcel ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Vertical Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Cycle de vie & Traçabilité
                </h3>
                <span className="text-[10px] text-gray-500 font-bold font-mono">CODE: {selectedParcel.code}</span>
              </div>

              {/* Vertical Timeline Component */}
              <div className="relative pl-6 border-l-2 border-white/10 ml-4 space-y-10 py-2">
                {getTimelineSteps(selectedParcel).map((step, idx, arr) => {
                  const IconComponent = step.icon;
                  const timeDiff = idx > 0 && arr[0].date && step.date 
                    ? calculateDuration(arr[0].date, step.date) 
                    : null;

                  return (
                    <div key={idx} className="relative group">
                      {/* Left Dot/Icon node */}
                      <div className={`absolute -left-[38px] top-0 w-8 h-8 rounded-full ${step.color} flex items-center justify-center text-white ring-4 ring-slate-950 transition-transform duration-300 group-hover:scale-110 shadow-lg`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {/* Content block */}
                      <div className={`rounded-xl p-5 border transition-all duration-300 ${
                        step.active 
                          ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                          : 'bg-black/10 border-white/5 opacity-45'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                          <h4 className={`text-sm font-black tracking-wide ${step.active ? 'text-white' : 'text-gray-500'}`}>
                            {step.title}
                          </h4>
                          {step.date && (
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                              <Calendar className="w-3.5 h-3.5 text-blue-400/80" />
                              <span>
                                {new Date(step.date).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {timeDiff && (
                                <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {timeDiff}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed ${step.active ? 'text-gray-300' : 'text-gray-650'}`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Parcel Identity Sidebar */}
          <div className="space-y-6">
            {/* Quick Summary Card */}
            <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="text-center pb-4 border-b border-white/5">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(selectedParcel.status)} text-white shadow-md`}>
                  {getDisplayStatus(selectedParcel.status)}
                </span>
                <h3 className="text-2xl font-black text-white mt-3 tracking-tight">{selectedParcel.code}</h3>
                <p className="text-xs text-gray-500 font-medium">Gare d'envoi: <strong className="text-gray-300">{selectedParcel.originCity}</strong></p>
              </div>

              {/* Transit Pathway */}
              <div className="bg-black/25 rounded-xl p-4 border border-white/5 space-y-3.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="text-left">
                    <span className="text-[10px] text-gray-500 block uppercase tracking-wider">Origine</span>
                    <span className="text-white mt-0.5 block">{selectedParcel.originCity}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 animate-pulse" />
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block uppercase tracking-wider">Destination</span>
                    <span className="text-white mt-0.5 block">{selectedParcel.destinationCity}</span>
                  </div>
                </div>
              </div>

              {/* User Identity Details */}
              <div className="space-y-4 pt-1">
                <div>
                  <h4 className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-blue-500/80" /> Expéditeur
                  </h4>
                  <p className="text-sm font-bold text-white">{selectedParcel.senderName}</p>
                  <p className="text-xs text-gray-400 font-medium">{selectedParcel.senderPhone}</p>
                </div>

                <div>
                  <h4 className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <Truck className="w-3.5 h-3.5 text-orange-500/80" /> Destinataire
                  </h4>
                  <p className="text-sm font-bold text-white">{selectedParcel.recipientName}</p>
                  <p className="text-xs text-gray-400 font-medium">{selectedParcel.recipientPhone}</p>
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-gray-550 block font-black uppercase tracking-widest">Type</span>
                    <span className="text-xs font-bold text-white mt-0.5 block">{selectedParcel.packageType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-550 block font-black uppercase tracking-widest">Frais DBS</span>
                    <span className="text-xs font-extrabold text-emerald-400 mt-0.5 block">{selectedParcel.price.toLocaleString()} FCFA</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => printReceipt(selectedParcel)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 rounded-xl font-bold text-xs transition-all border border-purple-500/20"
                >
                  <Printer className="w-4 h-4" /> Imprimer le Reçu d'envoi
                </button>
              </div>
            </div>
            
            {/* Quick disclaimer / informative box */}
            <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-4 flex gap-3 text-xs text-gray-400">
              <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Le rapprochement chronologique et la traçabilité sont mis à jour périodiquement lors des passages d'étapes de transport de notre flotte.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-900/20 border border-white/10 border-dashed rounded-3xl p-16 text-center text-gray-400 max-w-xl mx-auto mt-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900/60 flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Aucun colis sélectionné</h3>
          <p className="text-xs leading-relaxed text-gray-500 max-w-md mx-auto">
            Saisissez le numéro unique du colis de type <strong className="text-blue-400 font-mono">DBS-YYMMDD-XXXX</strong> ou recherchez par coordonnées ci-dessus pour consulter en détail son historique de suivi.
          </p>
        </div>
      )}
    </div>
  );
}
