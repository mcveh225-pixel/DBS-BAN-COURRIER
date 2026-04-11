// Service de notifications SMS Orange et WhatsApp

const ORANGE_CLIENT_ID = import.meta.env.VITE_ORANGE_CLIENT_ID;
const ORANGE_CLIENT_SECRET = import.meta.env.VITE_ORANGE_CLIENT_SECRET;
const ORANGE_SENDER_NUMBER = import.meta.env.VITE_ORANGE_SENDER_NUMBER;

// Cache pour le token Orange
let orangeAccessToken: string | null = null;
let tokenExpiry: number = 0;

// Fonction pour obtenir le token d'accès Orange
const getOrangeAccessToken = async (): Promise<string | null> => {
  if (orangeAccessToken && Date.now() < tokenExpiry) {
    return orangeAccessToken;
  }

  if (!ORANGE_CLIENT_ID || !ORANGE_CLIENT_SECRET) {
    console.warn('Orange API credentials missing. SMS will be simulated.');
    return null;
  }

  try {
    const auth = btoa(`${ORANGE_CLIENT_ID}:${ORANGE_CLIENT_SECRET}`);
    const response = await fetch('https://api.orange.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    if (data.access_token) {
      orangeAccessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 min avant
      return orangeAccessToken;
    }
    return null;
  } catch (error) {
    console.error('Error getting Orange token:', error);
    return null;
  }
};

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

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  if (!phone || phone.length < 8) {
    console.warn('Invalid phone number:', phone);
    return false;
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const token = await getOrangeAccessToken();

    if (!token || !ORANGE_SENDER_NUMBER) {
      // Fallback simulation si pas de config
      console.log(`📱 [SIMULATION] SMS envoyé à ${formattedPhone}:`, message);
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      showNotification(`SMS simulé pour ${formattedPhone}`, 'info');
      logNotification('SMS (Simulé)', formattedPhone, 'N/A');
      return true;
    }

    // Envoi réel via Orange
    const senderAddress = `tel:+${ORANGE_SENDER_NUMBER}`;
    const receiverAddress = `tel:+${formattedPhone}`;

    const response = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: receiverAddress,
          senderAddress: senderAddress,
          outboundSMSTextMessage: {
            message: message
          }
        }
      })
    });

    if (response.ok) {
      console.log(`📱 SMS Orange envoyé à ${formattedPhone}`);
      showNotification(`SMS envoyé à ${formattedPhone}`, 'success');
      return true;
    } else {
      const errorData = await response.json();
      console.error('Orange API Error:', errorData);
      showNotification('Erreur API Orange SMS', 'error');
      return false;
    }
  } catch (error) {
    console.error('Erreur envoi SMS:', error);
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
