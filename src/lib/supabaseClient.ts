import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../services/logger';

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

if (!isSupabaseConfigured) {
  logger.warn('supabase_env_missing', {
    hasUrl: Boolean(env.supabaseUrl),
    hasAnonKey: Boolean(env.supabaseAnonKey),
  });
}

// Do not construct a fake client. Supabase validates its URL during module
// evaluation, which used to crash unrelated pages (including the map) when
// local auth variables were intentionally omitted.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey)
  : null;
