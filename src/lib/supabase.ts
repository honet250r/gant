import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Collaboration features may not work.');
}

console.log('Supabase Environmental Variables Check:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Set (Length: ' + supabaseUrl.length + ')' : 'Not Set',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set (Length: ' + supabaseAnonKey.length + ')' : 'Not Set'
});

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
