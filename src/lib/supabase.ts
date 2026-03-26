import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('L\'URL Supabase ou la clé Anon est manquante. Vérifiez vos variables d\'environnement.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
