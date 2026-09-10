import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.'
  );
}

// Same project, same anon key, same RLS as the mobile app — this client is
// another front door onto one backend, not a second backend.
//
// Two settings differ from src/lib/supabase.js deliberately:
//   storage           the browser has localStorage, so no AsyncStorage shim
//   detectSessionInUrl  true here, false on mobile. Email confirmation and
//                     password-reset links land back in the browser with the
//                     tokens in the URL fragment; the client has to consume
//                     them. On mobile those links are handled out of band.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
