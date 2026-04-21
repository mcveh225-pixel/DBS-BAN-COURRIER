import React from 'react';
import { ChevronLeft, Package, Printer, Truck, CheckCircle, Edit, Archive, Trash2, User, Phone, MapPin, Calendar, Info, DollarSign, Settings, Send } from 'lucide-react';
import { Parcel, getDisplayStatus, getStatusColor } from '../lib/auth';
import { printReceipt } from '../lib/receipt';

interface ParcelDetailsPageProps {
  parcel: Parcel;
  onBack: () => void;
  onStatusUpdate?: (parcelId: string, status: Parcel['status']) => void;
  onEdit?: (parcel: Parcel) => void;
  onCancel?: (parcelId: string, parcelCode: string) => void;
  onDelete?: (parcelId: string, parcelCode: string) => void;
  userCity?: string;
  userId?: string;
}

export default function ParcelDetailsPage({ parcel, onBack, onStatusUpdate, onEdit, onCancel, onDelete, userCity, userId }: ParcelDetailsPageProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Retour à la liste</span>
        </button>

        <div className="flex gap-3">
          {parcel.isPaid && (
            <button 
              onClick={() => printReceipt(parcel)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-lg shadow-purple-900/40 font-bold text-sm"
            >
              <Printer className="w-4 h-4" /> Imprimer Reçu
            </button>
          )}
          {onEdit && (parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && userId === parcel.createdBy && (
            <button 
              onClick={() => onEdit(parcel)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all shadow-lg shadow-amber-900/40 font-bold text-sm"
            >
              <Edit className="w-4 h-4" /> Modifier le colis
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none group-hover:rotate-6 transition-transform duration-700">
              <Package className="w-64 h-64 text-blue-500" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${getStatusColor(parcel.status)} text-white shadow-xl ring-1 ring-white/20`}>
                    {getDisplayStatus(parcel.status)}
                  </span>
                  <h2 className="text-5xl font-black text-white mt-4 tracking-tighter">{parcel.code}</h2>
                  <p className="text-gray-400 flex items-center gap-2 mt-2 font-medium">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    Enregistré le {new Date(parcel.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center md:text-right min-w-[200px]">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Montant Total</p>
                  <p className="text-5xl font-black text-emerald-400">{parcel.price.toLocaleString()} <span className="text-lg font-medium opacity-70">FCFA</span></p>
                  <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${parcel.isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                    {parcel.isPaid ? '✓ Payé' : '! En attente de paiement'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                {/* Expéditeur */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-blue-400 font-black text-xs uppercase tracking-[0.2em]">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <span>Provenance</span>
                  </div>
                  <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-4">
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Expéditeur</p>
                      <p className="text-xl text-white font-bold">{parcel.senderName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Contact</p>
                      <button className="text-blue-400 font-black text-lg flex items-center gap-2 hover:text-blue-300 transition-colors">
                        <Phone className="w-4 h-4" />
                        {parcel.senderPhone}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Destinataire */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-orange-400 font-black text-xs uppercase tracking-[0.2em]">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span>Destination</span>
                  </div>
                  <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-4">
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Destinataire</p>
                      <p className="text-xl text-white font-bold">{parcel.recipientName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Contact</p>
                        <button className="text-orange-400 font-black text-lg flex items-center gap-2 hover:text-orange-300 transition-colors">
                          <Phone className="w-4 h-4" />
                          {parcel.recipientPhone}
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Ville</p>
                        <p className="text-white font-black text-lg flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-red-500" />
                          {parcel.destinationCity}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3 text-emerald-400 font-black text-xs uppercase tracking-[0.2em]">
                <Info className="w-4 h-4" />
                <span>Spécifications</span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Type d'article</p>
                  <p className="text-white font-bold text-lg">{parcel.packageType}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Quantité</p>
                  <p className="text-white font-bold text-lg">{parcel.quantity}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Valeur estimée</p>
                  <p className="text-white font-bold text-lg">{parcel.value || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Frais DBS-BAN</p>
                  <p className="text-emerald-400 font-black text-lg">{parcel.price.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-400 font-black text-xs uppercase tracking-[0.2em]">
                <Info className="w-4 h-4" />
                <span>Instructions</span>
              </div>
              <div className="bg-black/20 rounded-xl p-4 min-h-[120px]">
                {parcel.notes ? (
                  <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed italic">
                    "{parcel.notes}"
                  </p>
                ) : (
                  <p className="text-gray-500 italic text-sm">Pas d'instructions particulières.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions Column */}
        <div className="space-y-6">
          {onStatusUpdate && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6 sticky top-6">
              <div className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-[0.2em]">
                <Settings className="w-4 h-4 text-blue-400" />
                <span>Gestion</span>
              </div>
              
              <div className="space-y-3">
                {/* Actions for Creator */}
                {userId === parcel.createdBy && (
                  <>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-2 px-1">Actions Port de Départ</p>
                    {parcel.status === 'PAYE' && (
                      <button 
                        onClick={() => onStatusUpdate(parcel.id, 'EXPEDIE')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-900/40 border border-indigo-400/20"
                      >
                        <Send className="w-5 h-5" /> Expédier maintenant
                      </button>
                    )}
                    {onCancel && (parcel.status === 'ENREGISTRE' || parcel.status === 'PAYE') && (
                      <button 
                        onClick={() => onCancel(parcel.id, parcel.code)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl font-black text-sm transition-all border border-red-600/30"
                      >
                        <Archive className="w-5 h-5" /> Annuler l'envoi
                      </button>
                    )}
                    {parcel.status === 'ANNULE' && onDelete && (
                      <button 
                        onClick={() => onDelete(parcel.id, parcel.code)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-900/40"
                      >
                        <Trash2 className="w-5 h-5" /> Supprimer Définitivement
                      </button>
                    )}
                  </>
                )}

                {/* Actions for Destination */}
                {userCity === parcel.destinationCity && (
                  <>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-2 pt-4 px-1">Actions Port d'Arrivée</p>
                    {(parcel.status === 'EN_TRANSIT' || parcel.status === 'EXPEDIE') && (
                      <button 
                        onClick={() => onStatusUpdate(parcel.id, 'ARRIVE')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-orange-900/40 border border-orange-400/20"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <Truck className="w-5 h-5" />
                        </div>
                        Enregistrer Arrivée
                      </button>
                    )}
                    {parcel.status === 'ARRIVE' && (
                      <button 
                        onClick={() => onStatusUpdate(parcel.id, 'LIVRE')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-emerald-900/40 border border-emerald-400/20"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      Confirmer Livraison
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
                  <span>Audit Trail</span>
                </div>
                <div className="text-[10px] text-gray-500 space-y-2">
                  <div className="flex justify-between">
                    <span>Création</span>
                    <span className="text-gray-300">{new Date(parcel.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ID Interne</span>
                    <span className="text-gray-400 font-mono truncate ml-4">{parcel.id}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Keep the old name for backward compatibility during migration, then I'll rename the file
export const ParcelDetailsModal = ParcelDetailsPage;
