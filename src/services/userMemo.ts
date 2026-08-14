import { supabase } from '../lib/supabaseClient';

export async function getUserMemo(userId: string): Promise<string> {
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from('user_memos')
    .upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    throw error;
  }
}
