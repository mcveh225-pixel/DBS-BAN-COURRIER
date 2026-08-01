import { supabase } from './supabase';
import { sendSMS, createParcelShippedMessage, createParcelArrivedMessage, createParcelDeliveredMessage, logNotification } from './notifications';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'courier';
  city?: string;
  isArchived: boolean;
  createdAt: string;
  password?: string;
}

export interface Parcel {
  id: string;
  code: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  destinationCity: string;
  packageType: string;
  quantity: number;
  value: string;
  status: 'ENREGISTRE' | 'PAYE' | 'EXPEDIE' | 'EN_TRANSIT' | 'ARRIVE' | 'LIVRE' | 'ANNULE';
  price: number;
  isPaid: boolean;
  paidAt?: string;
  shippedAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  createdBy: string;
  originCity: string;
  createdAt: string;
  notes?: string;
}

export interface DailyRevenue {
  date: string;
  totalRevenue: number;
  totalParcels: number;
  paidParcels: number;
  deliveredParcels: number;
}

export interface AuditLog {
  id: string;
  parcelId: string;
  parcelCode: string;
  originalStatus: string;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  notes?: string;
}

export const getDisplayStatus = (status: Parcel['status']) => {
  switch (status) {
    case 'ENREGISTRE': return 'ENREGISTRÉ';
    case 'PAYE': return 'ENREGISTRÉ';
    case 'EXPEDIE': return 'EXPÉDIÉ';
    case 'EN_TRANSIT': return 'EN TRANSIT';
    case 'ARRIVE': return 'ARRIVÉ';
    case 'LIVRE': return 'LIVRÉ';
    case 'ANNULE': return 'ANNULÉ';
    default: return status;
  }
};

export const getStatusColor = (status: Parcel['status']) => {
  switch (status) {
    case 'ENREGISTRE': return 'bg-gray-600';
    case 'PAYE': return 'bg-blue-600';
    case 'EXPEDIE': return 'bg-purple-600';
    case 'EN_TRANSIT': return 'bg-indigo-600';
    case 'ARRIVE': return 'bg-orange-600';
    case 'LIVRE': return 'bg-green-600';
    case 'ANNULE': return 'bg-red-600';
    default: return 'bg-gray-600';
  }
};

export const isParcelDelayed = (parcel: Parcel): boolean => {
  if (parcel.status === 'LIVRE' || parcel.status === 'ANNULE') {
    return false;
  }
  const refDateStr = parcel.shippedAt || parcel.createdAt;
  if (!refDateStr) return false;
  const refTime = new Date(refDateStr).getTime();
  if (isNaN(refTime)) return false;
  const now = Date.now();
  const diffHours = (now - refTime) / (1000 * 60 * 60);
  return diffHours >= 48;
};

export const getParcelDelayHours = (parcel: Parcel): number => {
  if (parcel.status === 'LIVRE' || parcel.status === 'ANNULE') return 0;
  const refDateStr = parcel.shippedAt || parcel.createdAt;
  if (!refDateStr) return 0;
  const refTime = new Date(refDateStr).getTime();
  if (isNaN(refTime)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - refTime) / (1000 * 60 * 60)));
};

const LOCAL_STORAGE_KEYS = {
  CURRENT_USER: 'dbs_ban_current_user'
};

// --- DIRECT DATABASE ONLY ENGINE ---
export interface PendingAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE';
  parcelId: string;
  payload: any;
  timestamp: string;
}

export const getCachedParcels = (): Parcel[] => [];
export const saveCachedParcels = (_parcels: Parcel[]) => {};
export const getPendingActions = (): PendingAction[] => [];
export const savePendingActions = (_actions: PendingAction[]) => {};
export const getUnsyncedCount = (): number => 0;
export const getMergedParcels = (): Parcel[] => [];
export const syncPendingActions = async (): Promise<void> => {};
export const triggerBackgroundSync = () => {};

// Utilitaire pour mapper snake_case (DB) vers camelCase
const mapUser = (dbUser: any): User => ({
  id: dbUser.id,
  email: dbUser.email,
  name: dbUser.name,
  role: dbUser.role,
  city: dbUser.city,
  isArchived: dbUser.is_archived || false,
  createdAt: dbUser.created_at,
  password: dbUser.password
});

const mapParcel = (dbParcel: any): Parcel => ({
  id: dbParcel.id,
  code: dbParcel.code,
  senderName: dbParcel.sender_name,
  senderPhone: dbParcel.sender_phone,
  recipientName: dbParcel.recipient_name,
  recipientPhone: dbParcel.recipient_phone,
  destinationCity: dbParcel.destination_city,
  packageType: dbParcel.package_type,
  quantity: dbParcel.quantity || 1,
  value: dbParcel.value,
  status: dbParcel.status,
  price: dbParcel.price,
  isPaid: dbParcel.is_paid,
  paidAt: dbParcel.paid_at,
  shippedAt: dbParcel.shipped_at,
  arrivedAt: dbParcel.arrived_at,
  deliveredAt: dbParcel.delivered_at,
  createdBy: dbParcel.created_by,
  originCity: (dbParcel.creator && dbParcel.creator.city) || 'Inconnue',
  createdAt: dbParcel.created_at,
  notes: dbParcel.notes
});

export const initializeAdmin = async () => {
  try {
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('*')
      .eq('id', 'admin-1')
      .single();

    if (!existingAdmin) {
      const admin = {
        id: 'admin-1',
        email: 'mcveh225@gmail.com',
        name: 'Administrateur Principal',
        role: 'admin',
        city: 'Adjamé',
        password: 'admin123',
        created_at: new Date().toISOString()
      };

      await supabase.from('users').insert([admin]);
      return mapUser(admin);
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de l\'administrateur:', error);
  }
  return null;
};

export const login = async (email: string, password: string): Promise<User | null> => {
  try {
    await initializeAdmin();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (user && !error) {
      if (user.is_archived) {
        console.error('Le compte est archivé');
        return null;
      }
      if (user.password === password) {
        const mappedUser = mapUser(user);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_USER, JSON.stringify(mappedUser));
        return mappedUser;
      }
    }
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
  return userStr ? JSON.parse(userStr) : null;
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(mapUser);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return [];
  }
};

export const createCourierUser = async (email: string, name: string, city: string, password?: string): Promise<User> => {
  try {
    const newUser = {
      id: `courier-${Date.now()}`,
      email,
      name,
      role: 'courier',
      city,
      password: password || 'courier123',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('users').insert([newUser]);
    if (error) throw error;
    return mapUser(newUser);
  } catch (error) {
    console.error('Erreur lors de la création du responsable:', error);
    throw error;
  }
};

export const createAdminUser = async (email: string, name: string, password?: string): Promise<User> => {
  try {
    const newUser = {
      id: `admin-${Date.now()}`,
      email,
      name,
      role: 'admin',
      password: password || 'admin123',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('users').insert([newUser]);
    if (error) throw error;
    return mapUser(newUser);
  } catch (error) {
    console.error('Erreur lors de la création de l\'admin:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const { data: targetUser } = await supabase.from('users').select('email, role').eq('id', userId).single();
    
    // L'administrateur principal (admin-1) ne peut jamais être supprimé
    if (userId === 'admin-1' || targetUser?.email === 'mcveh225@gmail.com') return false;

    if (targetUser?.role === 'admin') {
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
      if (count && count <= 1) return false;
    }

    const { error } = await supabase.from('users').delete().eq('id', userId);
    return !error;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    return false;
  }
};

export const getParcels = async (): Promise<Parcel[]> => {
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select('*, creator:users!created_by(city)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(mapParcel);
  } catch (error) {
    console.error('Erreur lors de la récupération des colis depuis la base de données:', error);
    return [];
  }
};

export const cleanupOldDeliveredParcels = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // 1. Supprimer les colis livrés depuis plus de 30 jours
    const { error: parcelError } = await supabase
      .from('parcels')
      .delete()
      .eq('status', 'LIVRE')
      .lt('delivered_at', thirtyDaysAgoISO);

    if (parcelError) throw parcelError;
    console.log('Anciens colis livrés supprimés avec succès.');

    // 2. Supprimer les utilisateurs archivés qui n'ont plus de colis
    const { data: archivedUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('is_archived', true);

    if (usersError) throw usersError;

    for (const user of (archivedUsers || [])) {
      const { count, error: countError } = await supabase
        .from('parcels')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);

      if (countError) {
        console.error(`Erreur lors de la vérification des colis pour l'utilisateur ${user.id}:`, countError);
        continue;
      }

      if (count === 0) {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);
        
        if (deleteError) {
          console.error(`Erreur lors de la suppression de l'utilisateur archivé ${user.id}:`, deleteError);
        } else {
          console.log(`Utilisateur archivé ${user.id} supprimé car il n'a plus de colis.`);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des anciens colis et utilisateurs:', error);
  }
};

export const archiveUser = async (userId: string): Promise<boolean> => {
  try {
    if (userId === 'admin-1') return false;
    const { error } = await supabase
      .from('users')
      .update({ is_archived: true })
      .eq('id', userId);
    return !error;
  } catch (error) {
    console.error('Erreur lors de l\'archivage de l\'utilisateur:', error);
    return false;
  }
};

export const archiveParcel = async (parcelId: string): Promise<boolean> => {
  const user = getCurrentUser();
  if (user?.role !== 'admin') {
    console.error('Tentative d\'annulation non autorisée');
    return false;
  }

  try {
    const { data: parcel } = await supabase
      .from('parcels')
      .select('code, status, is_paid, price, paid_at, created_at')
      .eq('id', parcelId)
      .single();
    
    if (!parcel) return false;

    const originalStatus = parcel.status;
    const parcelCode = parcel.code;

    if (parcel.is_paid) {
      const paidDate = parcel.paid_at ? parcel.paid_at.split('T')[0] : parcel.created_at.split('T')[0];
      const { data: existing } = await supabase.from('daily_revenues').select('*').eq('date', paidDate).single();
      
      if (existing) {
        await supabase
          .from('daily_revenues')
          .update({
            total_revenue: Math.max(0, existing.total_revenue - parcel.price),
            paid_parcels: Math.max(0, existing.paid_parcels - 1)
          })
          .eq('date', paidDate);
      }
    }

    const createdDate = parcel.created_at.split('T')[0];
    const { data: existingCreated } = await supabase.from('daily_revenues').select('*').eq('date', createdDate).single();
    if (existingCreated) {
      await supabase
        .from('daily_revenues')
        .update({
          total_parcels: Math.max(0, existingCreated.total_parcels - 1)
        })
        .eq('date', createdDate);
    }

    const { error } = await supabase
      .from('parcels')
      .update({ status: 'ANNULE' })
      .eq('id', parcelId);
    
    if (error) throw error;

    await logAuditAction(parcelId, parcelCode, originalStatus, 'ANNULE', 'Colis annulé par l\'administrateur');

    return true;
  } catch (error) {
    console.error('Erreur lors de l\'annulation du colis en base de données:', error);
    return false;
  }
};

export const deleteParcel = async (parcelId: string): Promise<boolean> => {
  const user = getCurrentUser();
  if (user?.role !== 'admin') {
    console.error('Tentative de suppression définitive non autorisée');
    return false;
  }

  try {
    const { data: targetParcel } = await supabase
      .from('parcels')
      .select('code, status')
      .eq('id', parcelId)
      .single();

    const originalStatus = targetParcel?.status || 'ANNULE';
    const parcelCode = targetParcel?.code || 'Inconnu';

    const { error } = await supabase
      .from('parcels')
      .delete()
      .eq('id', parcelId);
    
    if (error) throw error;

    await logAuditAction(parcelId, parcelCode, originalStatus, 'SUPPRIME', 'Colis supprimé définitivement par l\'administrateur');

    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression du colis en base de données:', error);
    return false;
  }
};

export const incrementTotalParcels = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('daily_revenues').select('*').eq('date', today).single();

    if (existing) {
      await supabase
        .from('daily_revenues')
        .update({
          total_parcels: (existing.total_parcels || 0) + 1
        })
        .eq('date', today);
    } else {
      await supabase.from('daily_revenues').insert([{
        date: today,
        total_revenue: 0,
        total_parcels: 1,
        paid_parcels: 0,
        delivered_parcels: 0
      }]);
    }
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation du total des colis:', error);
  }
};

export const createParcel = async (parcelData: Omit<Parcel, 'id' | 'code' | 'createdAt'>): Promise<Parcel> => {
  const code = generateParcelCode();
  const tempId = `parcel-${Date.now()}`;
  const nowStr = new Date().toISOString();

  const newParcel: any = {
    id: tempId,
    code,
    sender_name: parcelData.senderName,
    sender_phone: parcelData.senderPhone,
    recipient_name: parcelData.recipientName,
    recipient_phone: parcelData.recipientPhone,
    destination_city: parcelData.destinationCity,
    package_type: parcelData.packageType,
    quantity: parcelData.quantity,
    value: parcelData.value,
    status: parcelData.status,
    price: parcelData.price,
    is_paid: parcelData.isPaid,
    paid_at: parcelData.isPaid ? nowStr : null,
    created_by: parcelData.createdBy,
    created_at: nowStr,
    notes: parcelData.notes
  };

  const { data: createdParcel, error } = await supabase
    .from('parcels')
    .insert([newParcel])
    .select('*, creator:users!created_by(city)')
    .single();
  
  if (error) {
    console.error('Erreur lors de la création du colis en base de données:', error);
    throw error;
  }
  
  const mapped = mapParcel(createdParcel);

  try {
    await incrementTotalParcels();
    if (newParcel.is_paid) {
      await updateDailyRevenue(newParcel.price);
    }
  } catch (statsErr) {
    console.error('Erreur lors de la mise à jour des statistiques:', statsErr);
  }
  
  await logAuditAction(mapped.id, mapped.code, 'N/A', mapped.status, 'Création initiale du colis');

  return mapped;
};

export const incrementDeliveredCount = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('daily_revenues').select('*').eq('date', today).single();

    if (existing) {
      await supabase
        .from('daily_revenues')
        .update({
          delivered_parcels: (existing.delivered_parcels || 0) + 1
        })
        .eq('date', today);
    } else {
      await supabase.from('daily_revenues').insert([{
        date: today,
        total_revenue: 0,
        total_parcels: 0,
        paid_parcels: 0,
        delivered_parcels: 1
      }]);
    }
  } catch (error) {
    console.error('Erreur lors de l\'incrémentation du nombre de livraisons:', error);
  }
};

export const updateParcel = async (id: string, updates: Partial<Parcel>): Promise<Parcel | null> => {
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';
  
  if (!isAdmin) {
    const editKeys = [
      'senderName', 'senderPhone', 'recipientName', 'recipientPhone',
      'destinationCity', 'packageType', 'quantity', 'value', 'price', 'notes'
    ];
    const isEditing = Object.keys(updates).some(key => editKeys.includes(key));
    if (isEditing) {
      console.error('Modification de colis non autorisée : seul un administrateur peut modifier ces informations d\'un colis pour un responsable.');
      return null;
    }
  }

  const { data: currentParcelDb } = await supabase
    .from('parcels')
    .select('*')
    .eq('id', id)
    .single();

  const currentParcel = currentParcelDb ? mapParcel(currentParcelDb) : null;
  const nowStr = new Date().toISOString();

  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.isPaid !== undefined) {
    dbUpdates.is_paid = updates.isPaid;
    if (updates.isPaid && (!currentParcel || !currentParcel.isPaid)) {
      dbUpdates.paid_at = nowStr;
    }
  }
  
  if (updates.status === 'ARRIVE') dbUpdates.arrived_at = nowStr;
  if (updates.status === 'LIVRE') dbUpdates.delivered_at = nowStr;
  if (updates.status === 'EXPEDIE') dbUpdates.shipped_at = nowStr;
  
  if (updates.senderName) dbUpdates.sender_name = updates.senderName;
  if (updates.senderPhone) dbUpdates.sender_phone = updates.senderPhone;
  if (updates.recipientName) dbUpdates.recipient_name = updates.recipientName;
  if (updates.recipientPhone) dbUpdates.recipient_phone = updates.recipientPhone;
  if (updates.destinationCity) dbUpdates.destination_city = updates.destinationCity;
  if (updates.packageType) dbUpdates.package_type = updates.packageType;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.value !== undefined) dbUpdates.value = updates.value;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from('parcels')
    .update(dbUpdates)
    .eq('id', id)
    .select('*, creator:users!created_by(city)')
    .single();

  if (error) {
    console.error('Erreur lors de la mise à jour du colis en base de données:', error);
    throw error;
  }

  const mapped = mapParcel(data);

  if (currentParcel) {
    try {
      if (updates.isPaid && !currentParcel.isPaid) {
        await updateDailyRevenue(currentParcel.price);
      }

      if (updates.status === 'LIVRE' && currentParcel.status !== 'LIVRE') {
        await incrementDeliveredCount();
        const msg = createParcelDeliveredMessage(currentParcel.code);
        sendSMS(currentParcel.recipientPhone, msg, 'LIVRAISON');
        logNotification('SMS Livraison', currentParcel.recipientPhone, currentParcel.code);
      }

      if ((updates.status === 'EXPEDIE' || updates.status === 'ARRIVE') && currentParcel.status !== updates.status) {
        let message = '';
        let type = '';
        
        if (updates.status === 'EXPEDIE') {
          message = createParcelShippedMessage(currentParcel.code, currentParcel.destinationCity);
          type = 'EXPÉDITION';
        } else if (updates.status === 'ARRIVE') {
          message = createParcelArrivedMessage(currentParcel.code);
          type = 'ARRIVÉE';
        }
        
        if (message) {
          sendSMS(currentParcel.recipientPhone, message, type);
          logNotification(`SMS ${type}`, currentParcel.recipientPhone, currentParcel.code);
        }
      }
    } catch (e) {
      console.error('Erreur lors de l\'exécution des effets secondaires:', e);
    }
  }

  const oldStatus = currentParcel?.status || 'ENREGISTRE';
  const oldIsPaid = currentParcel?.isPaid || false;

  if (updates.status && updates.status !== oldStatus) {
    await logAuditAction(id, mapped.code, oldStatus, updates.status, 'Mise à jour du statut du colis');
  } else if (updates.isPaid !== undefined && updates.isPaid !== oldIsPaid) {
    await logAuditAction(id, mapped.code, oldStatus, oldStatus, updates.isPaid ? 'Règlement des frais de transport' : 'Annulation du règlement');
  } else {
    await logAuditAction(id, mapped.code, oldStatus, oldStatus, 'Modification des informations du colis');
  }

  return mapped;
};

const generateParcelCode = (): string => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  
  const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `DBS-${month}${day}-${randomLetters}-${randomDigits}`;
};

export const updateDailyRevenue = async (amount: number) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('daily_revenues').select('*').eq('date', today).single();

    if (existing) {
      await supabase
        .from('daily_revenues')
        .update({
          total_revenue: existing.total_revenue + amount,
          paid_parcels: existing.paid_parcels + 1
        })
        .eq('date', today);
    } else {
      await supabase.from('daily_revenues').insert([{
        date: today,
        total_revenue: amount,
        total_parcels: 1,
        paid_parcels: 1,
        delivered_parcels: 0
      }]);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des revenus quotidiens:', error);
  }
};

export const getDailyRevenues = async (): Promise<DailyRevenue[]> => {
  try {
    const { data, error } = await supabase
      .from('daily_revenues')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);
    
    if (error) throw error;
    return (data || []).map(d => ({
      date: d.date,
      totalRevenue: d.total_revenue,
      totalParcels: d.total_parcels,
      paidParcels: d.paid_parcels,
      deliveredParcels: d.delivered_parcels
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des revenus quotidiens:', error);
    return [];
  }
};

export const getCourierDailyStats = async (courierId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: user } = await supabase.from('users').select('city').eq('id', courierId).single();
    const city = user?.city;

    const { data: parcels, error } = await supabase
      .from('parcels')
      .select('*')
      .eq('created_by', courierId)
      .gte('created_at', `${today}T00:00:00.000Z`);
    
    if (error) throw error;
    
    const todayParcels = parcels || [];

    let destinedCount = 0;
    if (city) {
      const { count } = await supabase
        .from('parcels')
        .select('*', { count: 'exact', head: true })
        .eq('destination_city', city)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .in('status', ['EXPEDIE', 'EN_TRANSIT', 'ARRIVE']);
      destinedCount = count || 0;
    }

    return {
      totalParcels: todayParcels.filter(p => p.status !== 'ANNULE').length,
      deliveredParcels: todayParcels.filter(p => p.status === 'LIVRE').length,
      revenue: todayParcels.filter(p => p.is_paid && p.status !== 'ANNULE').reduce((sum, p) => sum + p.price, 0),
      paidParcels: todayParcels.filter(p => p.is_paid && p.status !== 'ANNULE').length,
      destinedCount
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du responsable:', error);
    return { totalParcels: 0, deliveredParcels: 0, revenue: 0, paidParcels: 0, destinedCount: 0 };
  }
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<boolean> => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return false;

    const isValid = user.password === currentPassword;

    if (!isValid) return false;

    const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', userId);
    return !error;
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    return false;
  }
};

// --- AUDIT LOG SERVICES ---

export const logAuditAction = async (
  parcelId: string,
  parcelCode: string,
  originalStatus: string,
  newStatus: string,
  notes?: string
): Promise<AuditLog | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const logEntry: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    parcelId,
    parcelCode,
    originalStatus,
    newStatus,
    changedBy: currentUser.id,
    changedByName: currentUser.name,
    timestamp: new Date().toISOString(),
    notes
  };

  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        id: logEntry.id,
        parcel_id: logEntry.parcelId,
        parcel_code: logEntry.parcelCode,
        original_status: logEntry.originalStatus,
        new_status: logEntry.newStatus,
        changed_by: logEntry.changedBy,
        changed_by_name: logEntry.changedByName,
        timestamp: logEntry.timestamp,
        notes: logEntry.notes
      }]);
    if (error) {
      console.error('Erreur Supabase lors de l\'enregistrement de l\'audit:', error);
    }
  } catch (err) {
    console.error('Erreur réseau lors de l\'enregistrement de l\'audit:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit_log_added', { detail: logEntry }));
  }

  return logEntry;
};

export const getAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      parcelId: item.parcel_id,
      parcelCode: item.parcel_code,
      originalStatus: item.original_status,
      newStatus: item.new_status,
      changedBy: item.changed_by,
      changedByName: item.changed_by_name,
      timestamp: item.timestamp,
      notes: item.notes
    }));
  } catch (error) {
    console.error('Erreur lors du chargement des logs d\'audit depuis la base de données:', error);
    return [];
  }
};
