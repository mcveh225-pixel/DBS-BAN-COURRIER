import React, { useState } from 'react';
import { Package, User, Phone, MapPin, FileText, DollarSign, Printer, Plus } from 'lucide-react';
import { createParcel, getCurrentUser, Parcel } from '../lib/auth';
import { sendBothNotifications, createParcelRegisteredMessage, createParcelReceiptMessage, logNotification } from '../lib/notifications';
import { printReceipt } from '../lib/receipt';

interface CreateParcelFormProps {
  userId: string;
  onCancel?: () => void;
}

const cities = [
  'Adjamé', 'Yopougon', 'Man', 'Sangouiné', 'Mahapleu', 'Danané', 'Teapleu', 'Zouhan-Hounien',
  'Bin-Houyé', 'Touba', 'Facobly', 'Biankouma', 'Bangolo', 'Duékoué'
];

export default function CreateParcelForm({ userId, onCancel }: CreateParcelFormProps) {
  const [formData, setFormData] = useState({
    senderName: '', senderPhone: '', recipientName: '', recipientPhone: '',
    destinationCity: '', packageType: '', quantity: '1', value: '', price: '', notes: '',
    isPaid: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string; parcel?: Parcel }>({ type: '', text: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const parcel = await createParcel({
        senderName: formData.senderName, senderPhone: formData.senderPhone,
        recipientName: formData.recipientName, recipientPhone: formData.recipientPhone,
        destinationCity: formData.destinationCity, packageType: formData.packageType,
        quantity: Number(formData.quantity),
        value: formData.value, price: Number(formData.price),
        status: formData.isPaid ? 'PAYE' : 'ENREGISTRE', isPaid: formData.isPaid, createdBy: userId, notes: formData.notes
      });

      const msg = createParcelRegisteredMessage(parcel.code, formData.senderName, getCurrentUser()?.city || 'Inconnue', Number(formData.price));
      sendBothNotifications(formData.recipientPhone, msg);
      logNotification('Notification (Enregistrement)', formData.recipientPhone, parcel.code);

      // Envoi du reçu à l'expéditeur
      const receiptMsg = createParcelReceiptMessage(
        parcel.code, 
        formData.recipientName, 
        formData.destinationCity, 
        formData.value || '0',
        Number(formData.price), 
        formData.isPaid
      );
      sendBothNotifications(formData.senderPhone, receiptMsg);
      logNotification('Notification (Reçu Expéditeur)', formData.senderPhone, parcel.code);

      setMessage({ type: 'success', text: `Colis ${parcel.code} créé avec succès !`, parcel });
      setFormData({ senderName: '', senderPhone: '', recipientName: '', recipientPhone: '', destinationCity: '', packageType: '', quantity: '1', value: '', price: '', notes: '', isPaid: false });
    } catch (error: any) {
      console.error('Erreur détaillée de création:', error);
      setMessage({ 
        type: 'error', 
        text: `Erreur lors de la création du colis: ${error.message || 'Problème de base de données'}` 
      });
    } finally { setIsSubmitting(false); }
  };

  const handleChange = (e: any) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-6 h-6 text-blue-400" />
        <h3 className="text-xl font-semibold text-white">Créer un nouveau colis</h3>
      </div>
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg border flex justify-between items-center ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
          <span>{message.text}</span>
          {message.parcel && message.parcel.isPaid && (
            <button 
              onClick={() => printReceipt(message.parcel!)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimer Reçu
            </button>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Déposant</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" name="senderName" value={formData.senderName} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Nom complet" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tél Déposant</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="tel" name="senderPhone" value={formData.senderPhone} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="07 00 00 00 00" required />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Destinataire</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" name="recipientName" value={formData.recipientName} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Nom complet" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tél Destinataire</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="tel" name="recipientPhone" value={formData.recipientPhone} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="07 00 00 00 00" required />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select name="destinationCity" value={formData.destinationCity} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none" required>
                <option value="">Sélectionner une ville</option>
                {cities.map(city => <option key={city} value={city} className="bg-slate-800">{city}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type de colis</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" name="packageType" value={formData.packageType} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="ex: Carton" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nombre d'articles</label>
            <div className="relative">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="1" min="1" required />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Valeur déclarée</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" name="value" value={formData.value} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="ex: 50000 FCFA" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tarif (FCFA)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="5000" min="0" required />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isPaid" 
              name="isPaid" 
              checked={formData.isPaid} 
              onChange={handleChange}
              className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isPaid" className="text-sm font-medium text-gray-300">Colis payé à l'enregistrement</label>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
            {isSubmitting ? 'Création...' : <><Package className="w-5 h-5" /> Créer le colis</>}
          </button>
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-lg transition-colors border border-white/10"
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
