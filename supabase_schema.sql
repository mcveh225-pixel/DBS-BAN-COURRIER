-- Script de configuration pour DBS-BAN Service Courrier

-- 1. Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'courier')),
  city TEXT,
  password TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des colis
CREATE TABLE IF NOT EXISTS parcels (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  package_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  value TEXT,
  status TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 3. Table des revenus journaliers
CREATE TABLE IF NOT EXISTS daily_revenues (
  date DATE PRIMARY KEY,
  total_revenue NUMERIC DEFAULT 0,
  total_parcels INTEGER DEFAULT 0,
  paid_parcels INTEGER DEFAULT 0,
  delivered_parcels INTEGER DEFAULT 0
);

-- 4. Insertion de l'administrateur par défaut
INSERT INTO users (id, email, name, role, password, created_at)
VALUES ('admin-1', 'admin@dbs-ban.ci', 'Administrateur Principal', 'admin', 'admin123', NOW())
ON CONFLICT (id) DO NOTHING;

-- Note sur la sécurité (RLS) :
-- Pour un prototype, vous pouvez désactiver RLS ou créer des politiques simples.
-- Exemple pour activer RLS et autoriser tout accès authentifié (à affiner en production) :
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for authenticated" ON users FOR ALL TO anon USING (true);
