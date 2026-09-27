import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Config from './index.js';

if (!Config.URL || !Config.KEY) {
  console.warn('URL atau KEY database tidak ditemukan');
}

const supabase: SupabaseClient = createClient(Config.URL, Config.KEY);

export default supabase;