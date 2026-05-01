// Service de notifications SMS Orange et WhatsApp

// Fonction pour formater le numéro de téléphone
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    return '225' + cleaned.substring(1);
  }
  if (cleaned.startsWith('+')) {
    return cleaned.substring(1);
  }
  if (!cleaned.startsWith('225') && cleaned.length === 10) {
    return '225' + cleaned;
  }
  return cleaned;
};

// Fonction utilitaire pour afficher des notifications dans l'interface
const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'error' ? 'bg-red-600 text-white' :
    'bg-blue-600 text-white'
  }`;
  notification.textContent = message;
  
  document.body.appendChild(notification);

  window.setTimeout(() => {
    notification.style.opacity = '0';
    window.setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
};

export const sendSMS = async (phone: string, message: string, type: string = 'SYSTEM'): Promise<boolean> => {
  if (!phone || phone.length < 8) {
    console.warn('Invalid phone number:', phone);
    return false;
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    
    // Appel à notre API backend
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
        type: type
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      if (data.simulated) {
        console.log(`📱 [SIMULATION] SMS envoyé à ${formattedPhone}:`, message);
        showNotification(`SMS simulé pour ${formattedPhone}`, 'info');
        logNotification('SMS (Simulé)', formattedPhone, 'N/A', 'info');
      } else {
        console.log(`📱 SMS Orange envoyé à ${formattedPhone}`);
        showNotification(`SMS envoyé à ${formattedPhone}`, 'success');
        logNotification('SMS Expédié (Réel)', formattedPhone, 'OK', 'success');
      }
      return true;
    } else {
      console.error('API Error:', data);
      const errorMsg = data.details?.message || data.error || 'Erreur inconnue';
      showNotification(`Erreur SMS: ${errorMsg}`, 'error');
      logNotification('Erreur SMS (Réel)', formattedPhone, errorMsg, 'error');
      return false;
    }
  } catch (error) {
    console.error('Erreur réseau envoi SMS:', error);
    showNotification('Erreur réseau lors de l\'envoi du SMS', 'error');
    return false;
  }
};

export const sendWhatsApp = async (phone: string, message: string): Promise<boolean> => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    console.log(`💬 WhatsApp envoyé à ${formattedPhone}:`, message);
    await new Promise<void>(resolve => setTimeout(resolve, 700));
    showNotification(`Message WhatsApp préparé pour ${formattedPhone}`, 'success');
    return true;
  } catch (error) {
    console.error('Erreur envoi WhatsApp:', error);
    showNotification('Erreur lors de l\'envoi WhatsApp', 'error');
    return false;
  }
};

export const sendBothNotifications = async (phone: string, message: string): Promise<void> => {
  try {
    await Promise.all([
      sendSMS(phone, message),
      sendWhatsApp(phone, message)
    ]);
  } catch (error) {
    console.error('Erreur envoi notifications:', error);
  }
};

export const createParcelRegisteredMessage = (
  parcelCode: string, 
  senderName: string, 
  senderCity: string,
  price: number
): string => {
  return `🚚 DBS-BAN COURRIER\nBonjour, ${senderName} vous a expédié un colis depuis ${senderCity}. Code: ${parcelCode}. Gardez ce code pour le retrait. Merci de votre confiance!`;
};

export const createParcelShippedMessage = (parcelCode: string, destination: string): string => {
  return `🚚 DBS-BAN SERVICE COURRIER\nVotre colis ${parcelCode} a été EXPÉDIÉ vers ${destination}.\nSuivez son arrivée prochaine.\nMerci de votre confiance !`;
};

export const createParcelArrivedMessage = (parcelCode: string): string => {
  return `🎉 DBS-BAN SERVICE COURRIER\nBonne nouvelle ! Votre colis est arrivé.\n📦 Code: ${parcelCode}\n✅ Statut: Arrivé à destination\nVous pouvez venir le récupérer.\nMerci !`;
};

export const createParcelDeliveredMessage = (parcelCode: string): string => {
  return `✅ DBS-BAN SERVICE COURRIER\nVotre colis a été livré avec succès.\n📦 Code: ${parcelCode}\n🎯 Statut: Livré\nMerci d'avoir utilisé nos services !`;
};

export const createParcelReceiptMessage = (
  parcelCode: string,
  recipientName: string,
  destinationCity: string,
  parcelValue: string,
  price: number,
  isPaid: boolean
): string => {
  return `🧾 DBS-BAN REÇU\nColis: ${parcelCode}\nDestinataire: ${recipientName}\nDestination: ${destinationCity}\nMontant: ${price} FCFA\nStatut: ${isPaid ? 'PAYÉ' : 'À PAYER'}\nMerci de votre confiance!`;
};

export const createManualSMSMessage = (
  parcelCode: string, 
  status: string, 
  destination: string,
  senderName: string,
  recipientName: string
): string => {
  return `📦 DBS-BAN SERVICE COURRIER\ninfo expéditeur: ${senderName}\nInfo Colis: ${parcelCode}\nStatut: ${status}\nDestination: ${destination}\ninfo destinataire: ${recipientName}\nMerci de votre confiance !`;
};

export const logNotification = (action: string, phone: string, parcelCode: string, forcedStatus?: 'real' | 'simulated' | 'error' | 'success' | 'info') => {
  const timestamp = new Date().toLocaleString('fr-FR');
  const isSimulated = action.toLowerCase().includes('simulé');
  const isError = action.toLowerCase().includes('erreur') || parcelCode === 'FAIL';
  
  const logEntry = {
    timestamp,
    action,
    phone,
    parcelCode,
    status: forcedStatus === 'success' ? 'real' : (forcedStatus === 'info' ? 'simulated' : (forcedStatus || (isError ? 'error' : (isSimulated ? 'simulated' : 'real'))))
  };

  const existingLogs = localStorage.getItem('notification_logs') || '[]';
  const logs = JSON.parse(existingLogs);
  logs.unshift(logEntry);
  if (logs.length > 100) logs.splice(100);
  localStorage.setItem('notification_logs', JSON.stringify(logs));
  console.log(`[${timestamp}] ${action} - ${parcelCode} - ${phone}`);
};

export const getSMSLogs = async () => {
  try {
    const response = await fetch('/api/sms-logs');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des logs SMS:', error);
  }
  return [];
};
