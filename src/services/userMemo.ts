import { supabase } from '../lib/supabaseClient';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

export async function getUserMemo(userId: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('user_memos')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.content ?? '';
}

export async function saveUserMemo(userId: string, content: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_memos')
    .upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    throw error;
  }
}
