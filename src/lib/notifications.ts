// Service de notifications SMS et WhatsApp (Simulation)

// Fonction pour formater le numéro de téléphone
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    return '+225' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    return '+225' + cleaned;
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

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    console.log(`📱 SMS envoyé à ${formattedPhone}:`, message);
    await new Promise<void>(resolve => setTimeout(resolve, 500));
    showNotification(`SMS envoyé à ${formattedPhone}`, 'success');
    return true;
  } catch (error) {
    console.error('Erreur envoi SMS:', error);
    showNotification('Erreur lors de l\'envoi du SMS', 'error');
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
  return `🚚 DBS-BAN SERVICE COURRIER\nBojnjour,\n${senderName}\nvous à expédié un colis dépuis\n${senderCity}\n${parcelCode}\nconservé le code pour le rétrait. DBS-BAN vous rémercie pour votre confiance`;
};

export const createParcelArrivedMessage = (parcelCode: string): string => {
  return `🎉 DBS-BAN SERVICE COURRIER\nBonne nouvelle ! Votre colis est arrivé.\n📦 Code: ${parcelCode}\n✅ Statut: Arrivé à destination\nVous pouvez venir le récupérer.\nMerci !`;
};

export const createParcelDeliveredMessage = (parcelCode: string): string => {
  return `✅ DBS-BAN SERVICE COURRIER\nVotre colis a été livré avec succès.\n📦 Code: ${parcelCode}\n🎯 Statut: Livré\nMerci d'avoir utilisé nos services !`;
};

export const logNotification = (action: string, phone: string, parcelCode: string) => {
  const timestamp = new Date().toLocaleString('fr-FR');
  const logEntry = `[${timestamp}] 📱 ${action} - Colis ${parcelCode} - Tél: ${phone}`;
  const existingLogs = localStorage.getItem('notification_logs') || '[]';
  const logs = JSON.parse(existingLogs);
  logs.unshift(logEntry);
  if (logs.length > 100) logs.splice(100);
  localStorage.setItem('notification_logs', JSON.stringify(logs));
  console.log(logEntry);
};
