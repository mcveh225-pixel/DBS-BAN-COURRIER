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

const LOCAL_STORAGE_KEYS = {
  CURRENT_USER: 'dbs_ban_current_user'
};

// --- SYNC & LOCAL CACHE ENGINE ---
export interface PendingAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE';
  parcelId: string;
  payload: any;
  timestamp: string;
}

export const getCachedParcels = (): Parcel[] => {
  if (typeof window === 'undefined') return [];
  const cached = localStorage.getItem('dbs_cached_parcels');
  return cached ? JSON.parse(cached) : [];
};

export const saveCachedParcels = (parcels: Parcel[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dbs_cached_parcels', JSON.stringify(parcels));
};

export const getPendingActions = (): PendingAction[] => {
  if (typeof window === 'undefined') return [];
  const pending = localStorage.getItem('dbs_pending_parcel_actions');
  return pending ? JSON.parse(pending) : [];
};

export const savePendingActions = (actions: PendingAction[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dbs_pending_parcel_actions', JSON.stringify(actions));
};

export const getUnsyncedCount = (): number => {
  return getPendingActions().length;
};

export const getMergedParcels = (): Parcel[] => {
  const cached = getCachedParcels();
  const pending = getPendingActions();
  
  let merged = [...cached];
  
  for (const action of pending) {
    if (action.type === 'CREATE') {
      if (!merged.some(p => p.id === action.parcelId)) {
        const p = action.payload;
        const localParcel: Parcel = {
          id: action.parcelId,
          code: p.code,
          senderName: p.senderName,
          senderPhone: p.senderPhone,
          recipientName: p.recipientName,
          recipientPhone: p.recipientPhone,
          destinationCity: p.destinationCity,
          packageType: p.packageType,
          quantity: p.quantity,
          value: p.value,
          status: p.status,
          price: p.price,
          isPaid: p.isPaid,
          paidAt: p.paidAt,
          createdBy: p.createdBy,
          originCity: p.originCity || 'Inconnue',
          createdAt: p.createdAt,
          notes: p.notes
        };
        merged.unshift(localParcel);
      }
    } else if (action.type === 'UPDATE') {
      merged = merged.map(p => {
        if (p.id === action.parcelId) {
          return { ...p, ...action.payload };
        }
        return p;
      });
    } else if (action.type === 'ARCHIVE') {
      merged = merged.map(p => {
        if (p.id === action.parcelId) {
          return { ...p, status: 'ANNULE' as const };
        }
        return p;
      });
    } else if (action.type === 'DELETE') {
      merged = merged.filter(p => p.id !== action.parcelId);
    }
  }
  
  return merged;
};

let isSyncing = false;

export const syncPendingActions = async (): Promise<void> => {
  if (isSyncing) return;
  
  const pending = getPendingActions();
  if (pending.length === 0) return;
  
  isSyncing = true;
  console.log(`[Offline Sync] Starting sync for ${pending.length} pending actions...`);
  
  let i = 0;
  for (; i < pending.length; i++) {
    const action = pending[i];
    try {
      if (action.type === 'CREATE') {
        const p = action.payload;
        const newParcelDb: any = {
          id: action.parcelId,
          code: p.code,
          sender_name: p.senderName,
          sender_phone: p.senderPhone,
          recipient_name: p.recipientName,
          recipient_phone: p.recipientPhone,
          destination_city: p.destinationCity,
          package_type: p.packageType,
          quantity: p.quantity,
          value: p.value,
          status: p.status,
          price: p.price,
          is_paid: p.isPaid,
          paid_at: p.paidAt || null,
          created_by: p.createdBy,
          created_at: p.createdAt,
          notes: p.notes
        };

        const { error } = await supabase
          .from('parcels')
          .insert([newParcelDb]);
        
        if (error) {
          if (error.code !== '23505') {
            throw error;
          }
        }

        try {
          await incrementTotalParcels();
          if (p.isPaid) {
            await updateDailyRevenue(p.price);
          }
        } catch (statsErr) {
          console.error('[Offline Sync] Stats error during CREATE sync:', statsErr);
        }

      } else if (action.type === 'UPDATE') {
        const { data: currentParcel } = await supabase
          .from('parcels')
          .select('*')
          .eq('id', action.parcelId)
          .single();

        const updates = action.payload;
        const dbUpdates: any = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.isPaid !== undefined) {
          dbUpdates.is_paid = updates.isPaid;
          if (updates.isPaid && (!currentParcel || !currentParcel.is_paid)) {
            dbUpdates.paid_at = new Date().toISOString();
          }
        }
        
        if (updates.status === 'ARRIVE') dbUpdates.arrived_at = new Date().toISOString();
        if (updates.status === 'LIVRE') dbUpdates.delivered_at = new Date().toISOString();
        if (updates.status === 'EXPEDIE') dbUpdates.shipped_at = new Date().toISOString();
        
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

        const { error } = await supabase
          .from('parcels')
          .update(dbUpdates)
          .eq('id', action.parcelId);

        if (error) throw error;

        if (currentParcel) {
          try {
            if (updates.isPaid && !currentParcel.is_paid) {
              await updateDailyRevenue(currentParcel.price);
            }

            if (updates.status === 'LIVRE' && currentParcel.status !== 'LIVRE') {
              await incrementDeliveredCount();
              const msg = createParcelDeliveredMessage(currentParcel.code);
              sendSMS(currentParcel.recipient_phone, msg, 'LIVRAISON');
              logNotification('SMS Livraison', currentParcel.recipient_phone, currentParcel.code);
            }

            if ((updates.status === 'EXPEDIE' || updates.status === 'ARRIVE') && currentParcel.status !== updates.status) {
              let message = '';
              let type = '';
              
              if (updates.status === 'EXPEDIE') {
                message = createParcelShippedMessage(currentParcel.code, currentParcel.destination_city);
                type = 'EXPÉDITION';
              } else if (updates.status === 'ARRIVE') {
                message = createParcelArrivedMessage(currentParcel.code);
                type = 'ARRIVÉE';
              }
              
              if (message) {
                sendSMS(currentParcel.recipient_phone, message, type);
                logNotification(`SMS ${type}`, currentParcel.recipient_phone, currentParcel.code);
              }
            }
          } catch (e) {
            console.error('[Offline Sync] Side effects error inside UPDATE sync:', e);
          }
        }

      } else if (action.type === 'ARCHIVE') {
        const { data: parcel } = await supabase
          .from('parcels')
          .select('is_paid, price, paid_at, created_at')
          .eq('id', action.parcelId)
          .single();
        
        if (parcel) {
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
        }

        const { error } = await supabase
          .from('parcels')
          .update({ status: 'ANNULE' })
          .eq('id', action.parcelId);

        if (error) throw error;

      } else if (action.type === 'DELETE') {
        const { error } = await supabase
          .from('parcels')
          .delete()
          .eq('id', action.parcelId);
        
        if (error) throw error;
      }
      
    } catch (err: any) {
      console.error(`[Offline Sync] Failed to sync action of type ${action.type}:`, err);
      break;
    }
  }

  if (i > 0) {
    const remaining = getPendingActions().slice(i);
    savePendingActions(remaining);
    console.log(`[Offline Sync] Synchronised ${i} actions. ${remaining.length} remaining.`);
    
    window.dispatchEvent(new CustomEvent('offline_data_synced'));
    window.dispatchEvent(new CustomEvent('offline_action_queued'));
  }
  
  isSyncing = false;
};

export const triggerBackgroundSync = () => {
  syncPendingActions().catch(err => {
    console.warn('[Offline Sync] Background sync failed:', err);
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Offline Sync] Browser online. Triggering sync...');
    triggerBackgroundSync();
  });

  setInterval(() => {
    triggerBackgroundSync();
  }, 15000);
}

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
    try {
      await syncPendingActions();
    } catch (syncErr) {
      console.warn('Sync failed during getParcels fetch, proceeding:', syncErr);
    }

    const { data, error } = await supabase
      .from('parcels')
      .select('*, creator:users!created_by(city)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const fetched = (data || []).map(mapParcel);
    saveCachedParcels(fetched);
    
    // Merge any remaining queue actions
    const pending = getPendingActions();
    if (pending.length > 0) {
      return getMergedParcels();
    }
    
    return fetched;
  } catch (error) {
    console.error('Erreur lors de la récupération des colis (utilisation du cache local):', error);
    return getMergedParcels();
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

  // Update in local cache immediately
  const cached = getCachedParcels();
  const cachedIdx = cached.findIndex(p => p.id === parcelId);
  let originalStatus = 'ENREGISTRE';
  let parcelCode = '';
  if (cachedIdx !== -1) {
    originalStatus = cached[cachedIdx].status;
    parcelCode = cached[cachedIdx].code;
    cached[cachedIdx].status = 'ANNULE';
    saveCachedParcels(cached);
  }

  try {
    const pendingActions = getPendingActions();
    if (pendingActions.some(act => act.parcelId === parcelId)) {
      throw new Error('Pending actions exist, queuing archive.');
    }

    // Fetch parcel first to check if it was paid, its price and creation date
    const { data: parcel } = await supabase
      .from('parcels')
      .select('is_paid, price, paid_at, created_at')
      .eq('id', parcelId)
      .single();
    
    if (parcel) {
      // 1. Handle revenue subtraction if it was paid
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

      // 2. Decrement total parcels for the creation date
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
    }

    // 3. Update the parcel status to ANNULE
    const { error } = await supabase
      .from('parcels')
      .update({ status: 'ANNULE' })
      .eq('id', parcelId);
    
    if (error) throw error;

    // Log cancellation dynamically
    logAuditAction(parcelId, parcelCode, originalStatus, 'ANNULE', 'Colis annulé par l\'administrateur');

    return true;
  } catch (error) {
    console.warn('Erreur de connexion. Annulation locale (gérée en tâche de fond):', error);

    // Queue archive action
    const actions = getPendingActions();
    actions.push({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'ARCHIVE',
      parcelId: parcelId,
      payload: null,
      timestamp: new Date().toISOString()
    });
    savePendingActions(actions);
    
    window.dispatchEvent(new CustomEvent('offline_action_queued'));
    triggerBackgroundSync();

    // Log cancellation offline
    logAuditAction(parcelId, parcelCode, originalStatus, 'ANNULE', 'Colis annulé par l\'administrateur (Hors-ligne)');

    return true;
  }
};

export const deleteParcel = async (parcelId: string): Promise<boolean> => {
  const user = getCurrentUser();
  if (user?.role !== 'admin') {
    console.error('Tentative de suppression définitive non autorisée');
    return false;
  }

  // Get info before cache removal
  const cachedParcels = getCachedParcels();
  const targetParcel = cachedParcels.find(p => p.id === parcelId);
  const originalStatus = targetParcel?.status || 'ANNULE';
  const parcelCode = targetParcel?.code || 'Inconnu';

  // Remove from cache locally immediately
  const cached = cachedParcels.filter(p => p.id !== parcelId);
  saveCachedParcels(cached);

  try {
    const pendingActions = getPendingActions();
    if (pendingActions.some(act => act.parcelId === parcelId)) {
      throw new Error('Pending actions exist, queuing delete.');
    }

    const { error } = await supabase
      .from('parcels')
      .delete()
      .eq('id', parcelId);
    
    if (error) throw error;

    // Log deletion
    logAuditAction(parcelId, parcelCode, originalStatus, 'SUPPRIME', 'Colis supprimé définitivement par l\'administrateur');

    return true;
  } catch (error) {
    console.warn('Erreur de connexion. Suppression locale (gérée en tâche de fond):', error);

    // Queue delete action
    const actions = getPendingActions();
    actions.push({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'DELETE',
      parcelId: parcelId,
      payload: null,
      timestamp: new Date().toISOString()
    });
    savePendingActions(actions);
    
    window.dispatchEvent(new CustomEvent('offline_action_queued'));
    triggerBackgroundSync();

    // Log deletion offline
    logAuditAction(parcelId, parcelCode, originalStatus, 'SUPPRIME', 'Colis supprimé définitivement par l\'administrateur (Hors-ligne)');

    return true;
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
  
  const localParcel: Parcel = {
    id: tempId,
    code,
    senderName: parcelData.senderName,
    senderPhone: parcelData.senderPhone,
    recipientName: parcelData.recipientName,
    recipientPhone: parcelData.recipientPhone,
    destinationCity: parcelData.destinationCity,
    packageType: parcelData.packageType,
    quantity: parcelData.quantity,
    value: parcelData.value,
    status: parcelData.status,
    price: parcelData.price,
    isPaid: parcelData.isPaid,
    paidAt: parcelData.isPaid ? nowStr : undefined,
    createdBy: parcelData.createdBy,
    originCity: parcelData.originCity || getCurrentUser()?.city || 'Inconnue',
    createdAt: nowStr,
    notes: parcelData.notes
  };

  try {
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
    
    if (error) throw error;
    
    // Save to cache immediately
    const mapped = mapParcel(createdParcel);
    const cached = getCachedParcels();
    cached.unshift(mapped);
    saveCachedParcels(cached);

    // Dynamic stats update
    try {
      await incrementTotalParcels();
      if (newParcel.is_paid) {
        await updateDailyRevenue(newParcel.price);
      }
    } catch (statsErr) {
      console.error('Stats update error inside createParcel:', statsErr);
    }
    
    // Log creation
    logAuditAction(mapped.id, mapped.code, 'N/A', mapped.status, 'Création initiale du colis');

    return mapped;
  } catch (error) {
    console.warn('Erreur de connexion. Enregistrement local du colis (hors ligne):', error);
    
    // Save to cache
    const cached = getCachedParcels();
    cached.unshift(localParcel);
    saveCachedParcels(cached);
    
    // Queue CREATE action
    const actions = getPendingActions();
    actions.push({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'CREATE',
      parcelId: localParcel.id,
      payload: { ...parcelData, id: localParcel.id, code: localParcel.code, createdAt: localParcel.createdAt, originCity: localParcel.originCity },
      timestamp: nowStr
    });
    savePendingActions(actions);
    
    window.dispatchEvent(new CustomEvent('offline_action_queued'));
    triggerBackgroundSync();
    
    // Log creation offline
    logAuditAction(localParcel.id, localParcel.code, 'N/A', localParcel.status, 'Création initiale du colis (Hors-ligne)');

    return localParcel;
  }
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

  let currentParcel: Parcel | null = null;
  const cached = getCachedParcels();
  const cachedIdx = cached.findIndex(p => p.id === id);
  if (cachedIdx !== -1) {
    currentParcel = cached[cachedIdx];
  }

  const localUpdatedParcel: Parcel = {
    ...(currentParcel || {
      id,
      code: '',
      senderName: '',
      senderPhone: '',
      recipientName: '',
      recipientPhone: '',
      destinationCity: '',
      packageType: '',
      quantity: 1,
      value: '',
      status: 'ENREGISTRE' as const,
      price: 0,
      isPaid: false,
      createdBy: '',
      originCity: '',
      createdAt: new Date().toISOString()
    }),
    ...updates
  };

  const nowStr = new Date().toISOString();
  if (updates.status) {
    localUpdatedParcel.status = updates.status;
    if (updates.status === 'ARRIVE') localUpdatedParcel.arrivedAt = nowStr;
    if (updates.status === 'LIVRE') localUpdatedParcel.deliveredAt = nowStr;
    if (updates.status === 'EXPEDIE') localUpdatedParcel.shippedAt = nowStr;
  }
  if (updates.isPaid !== undefined) {
    localUpdatedParcel.isPaid = updates.isPaid;
    if (updates.isPaid && (!currentParcel || !currentParcel.isPaid)) {
      localUpdatedParcel.paidAt = nowStr;
    }
  }

  try {
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

    const pendingActions = getPendingActions();
    if (pendingActions.some(act => act.parcelId === id)) {
      throw new Error('Unsynced creations/updates exist, queue this update.');
    }

    const { data, error } = await supabase
      .from('parcels')
      .update(dbUpdates)
      .eq('id', id)
      .select('*, creator:users!created_by(city)')
      .single();

    if (error) throw error;

    const mapped = mapParcel(data);

    if (cachedIdx !== -1) {
      cached[cachedIdx] = mapped;
      saveCachedParcels(cached);
    } else {
      cached.unshift(mapped);
      saveCachedParcels(cached);
    }

    if (currentParcel) {
      const runSideEffects = async () => {
        try {
          if (updates.isPaid && !currentParcel!.isPaid) {
            updateDailyRevenue(currentParcel!.price);
          }

          if (updates.status === 'LIVRE' && currentParcel!.status !== 'LIVRE') {
            incrementDeliveredCount();
            const msg = createParcelDeliveredMessage(currentParcel!.code);
            sendSMS(currentParcel!.recipientPhone, msg, 'LIVRAISON');
            logNotification('SMS Livraison', currentParcel!.recipientPhone, currentParcel!.code);
          }

          if ((updates.status === 'EXPEDIE' || updates.status === 'ARRIVE') && currentParcel!.status !== updates.status) {
            let message = '';
            let type = '';
            
            if (updates.status === 'EXPEDIE') {
              message = createParcelShippedMessage(currentParcel!.code, currentParcel!.destinationCity);
              type = 'EXPÉDITION';
            } else if (updates.status === 'ARRIVE') {
              message = createParcelArrivedMessage(currentParcel!.code);
              type = 'ARRIVÉE';
            }
            
            if (message) {
              sendSMS(currentParcel!.recipientPhone, message, type);
              logNotification(`SMS ${type}`, currentParcel!.recipientPhone, currentParcel!.code);
            }
          }
        } catch (e) {
          console.error('Side effects error:', e);
        }
      };
      runSideEffects();
    }

    const oldStatus = currentParcel?.status || 'ENREGISTRE';
    const oldIsPaid = currentParcel?.isPaid || false;

    if (updates.status && updates.status !== oldStatus) {
      logAuditAction(id, mapped.code, oldStatus, updates.status, 'Mise à jour du statut du colis');
    } else if (updates.isPaid !== undefined && updates.isPaid !== oldIsPaid) {
      logAuditAction(id, mapped.code, oldStatus, oldStatus, updates.isPaid ? 'Règlement des frais de transport' : 'Annulation du règlement');
    } else {
      logAuditAction(id, mapped.code, oldStatus, oldStatus, 'Modification des informations du colis');
    }

    return mapped;
  } catch (error) {
    console.warn('Erreur de connexion. Mise à jour locale (gérée en tâche de fond):', error);

    if (cachedIdx !== -1) {
      cached[cachedIdx] = localUpdatedParcel;
      saveCachedParcels(cached);
    } else {
      cached.unshift(localUpdatedParcel);
      saveCachedParcels(cached);
    }

    const actions = getPendingActions();
    actions.push({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'UPDATE',
      parcelId: id,
      payload: updates,
      timestamp: nowStr
    });
    savePendingActions(actions);

    window.dispatchEvent(new CustomEvent('offline_action_queued'));
    triggerBackgroundSync();

    const oldStatus = currentParcel?.status || 'ENREGISTRE';
    const oldIsPaid = currentParcel?.isPaid || false;

    if (updates.status && updates.status !== oldStatus) {
      logAuditAction(id, localUpdatedParcel.code, oldStatus, updates.status, 'Mise à jour du statut du colis (Hors-ligne)');
    } else if (updates.isPaid !== undefined && updates.isPaid !== oldIsPaid) {
      logAuditAction(id, localUpdatedParcel.code, oldStatus, oldStatus, updates.isPaid ? 'Règlement des frais de transport (Hors-ligne)' : 'Annulation du règlement (Hors-ligne)');
    } else {
      logAuditAction(id, localUpdatedParcel.code, oldStatus, oldStatus, 'Modification des informations du colis (Hors-ligne)');
    }

    return localUpdatedParcel;
  }
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
    
    // Fetch user to get their city
    const { data: user } = await supabase.from('users').select('city').eq('id', courierId).single();
    const city = user?.city;

    const { data: parcels, error } = await supabase
      .from('parcels')
      .select('*')
      .eq('created_by', courierId)
      .gte('created_at', `${today}T00:00:00.000Z`);
    
    if (error) throw error;
    
    const todayParcels = parcels || [];

    // Fetch parcels destined for this courier's city (not just today)
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

const getCachedAuditLogs = (): AuditLog[] => {
  if (typeof window === 'undefined') return [];
  const logs = localStorage.getItem('dbs_audit_logs');
  return logs ? JSON.parse(logs) : [];
};

const saveCachedAuditLogs = (logs: AuditLog[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dbs_audit_logs', JSON.stringify(logs));
};

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

  // 1. Save to local storage cache immediately
  const cached = getCachedAuditLogs();
  cached.unshift(logEntry);
  if (cached.length > 200) cached.pop();
  saveCachedAuditLogs(cached);

  // 2. Try to insert into Supabase
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
      console.warn('Erreur Supabase lors de l\'enregistrement de l\'audit:', error);
    }
  } catch (err) {
    console.warn('Erreur réseau lors de l\'enregistrement de l\'audit:', err);
  }

  // Dispatch event so that listening UI components update reactive state
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

    const mappedLogs: AuditLog[] = (data || []).map((item: any) => ({
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

    const localLogs = getCachedAuditLogs();
    const merged = [...localLogs];
    
    for (const dbLog of mappedLogs) {
      if (!merged.some(l => l.id === dbLog.id)) {
        merged.push(dbLog);
      }
    }

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const finalLogs = merged.slice(0, 200);
    saveCachedAuditLogs(finalLogs);
    
    return finalLogs.slice(0, 100);
  } catch (error) {
    console.warn('Impossible de charger les logs d\'audit de Supabase, retour du cache local:', error);
    return getCachedAuditLogs();
  }
};
