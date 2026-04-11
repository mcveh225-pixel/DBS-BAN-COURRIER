import React from 'react';
import { X, Package, Printer, Truck, CheckCircle } from 'lucide-react';
import { Parcel, getDisplayStatus, getStatusColor } from '../lib/auth';
import { printReceipt } from '../lib/receipt';

interface ParcelDetailsModalProps {
  title: string;
  parcels: Parcel[];
  onClose: () => void;
  onStatusUpdate?: (parcelId: string, status: Parcel['status']) => void;
  userCity?: string;
}

export default function ParcelDetailsModal({ title, parcels, onClose, onStatusUpdate, userCity }: ParcelDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-white/20 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            {title} ({parcels.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {parcels.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 italic">Aucun colis trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parcels.map((parcel) => (
                <div key={parcel.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-lg">{parcel.code}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-300 flex items-center gap-2">
                          <span className="text-gray-500">Dest:</span> {parcel.recipientName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {parcel.quantity} x {parcel.packageType}
                        </p>
                        <p className="text-xs text-blue-400">
                          Vers: {parcel.destinationCity}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(parcel.status)}`}>
                        {getDisplayStatus(parcel.status)}
                      </span>
                      <p className="text-green-400 font-bold">{parcel.price.toLocaleString()} FCFA</p>
                      {parcel.isPaid && (
                        <button 
                          onClick={() => printReceipt(parcel)}
                          className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Printer className="w-3 h-3" /> Imprimer Reçu
                        </button>
                      )}
                      
                      {onStatusUpdate && userCity === parcel.destinationCity && (
                        <div className="flex flex-col gap-1 mt-1">
                          {parcel.status === 'EN_TRANSIT' && (
                            <button 
                              onClick={() => onStatusUpdate(parcel.id, 'ARRIVE')}
                              className="flex items-center justify-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] font-bold transition-colors"
                            >
                              <Truck className="w-3 h-3" /> Marquer Arrivé
                            </button>
                          )}
                          {parcel.status === 'ARRIVE' && (
                            <button 
                              onClick={() => onStatusUpdate(parcel.id, 'LIVRE')}
                              className="flex items-center justify-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold transition-colors"
                            >
                              <CheckCircle className="w-3 h-3" /> Marquer Livré
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
