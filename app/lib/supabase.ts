import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const getSupabaseClient = async (supabaseToken: string | null) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: supabaseToken ? `Bearer ${supabaseToken}` : '',
      },
    },
  });
};