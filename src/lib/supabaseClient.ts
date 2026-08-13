import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../services/logger';

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

if (!isSupabaseConfigured) {
  logger.warn('supabase_env_missing', {
    hasUrl: Boolean(env.supabaseUrl),
    hasAnonKey: Boolean(env.supabaseAnonKey),
  });
}

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : fallbackUrl,
  isSupabaseConfigured ? env.supabaseAnonKey : fallbackKey,
);
