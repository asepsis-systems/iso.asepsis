import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseServiceKey);

if (!hasSupabase) {
  console.warn('Faltan las variables de entorno de Supabase (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY). Se usará almacenamiento local.');
}

export const supabase = hasSupabase ? createClient(supabaseUrl, supabaseServiceKey) : null;

