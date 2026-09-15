import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ipwheuikchuoyskrfghi.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'replace-with-your-anon-key';

let supabase;

const isDev = process.env.NODE_ENV !== 'production';
const isPlaceholderKey =
  !supabaseAnonKey || supabaseAnonKey.includes('replace') || supabaseAnonKey.length < 20;

// Use the mock client during development or when the anon key is missing/placeholder.
if (!isDev && !isPlaceholderKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} else {
  /*
    Mock supabase client for local development when anon/public key is missing or left as placeholder.
    This provides the minimal API surface used by the app so UI flows can be exercised without real backend.
    It intentionally returns empty data and successful responses where appropriate.
    The mock now implements a basic auth state event system so sign-in/out will trigger
    the onAuthStateChange callbacks that App.js relies on to set the session state.
  */
  console.warn('Supabase anon key missing or placeholder. Using mock supabase client for local dev.');

  let mockSession = null;
  const authHandlers = [];

  const mockFrom = (table) => {
    return {
      select: async () => ({ data: [], error: null }),
      insert: async (rows) => ({ data: Array.isArray(rows) ? rows : [rows], error: null }),
      upsert: async (rows) => ({ data: Array.isArray(rows) ? rows : [rows], error: null }),
      eq: function () { return this; },
      in: function () { return this; },
      or: function () { return this; },
      order: function () { return this; },
      limit: function () { return this; },
      maybeSingle: async function () { return { data: null, error: null }; },
    };
  };

  const mockStorageFrom = (bucket) => ({
    upload: async (path, data) => ({ data: null, error: null }),
    download: async (path) => ({ data: null, error: null }),
    list: async (opts) => ({ data: [], error: null }),
  });

  const mockChannel = (name) => {
    const handlers = [];
    return {
      on: function (event, filter, handler) { handlers.push({ event, filter, handler }); return this; },
      subscribe: function () { return { unsubscribe: () => {} }; },
      unsubscribe: function () {},
    };
  };

  supabase = {
    auth: {
      getSession: async () => {
        console.log('MOCK_SUPABASE: getSession ->', !!mockSession);
        return ({ data: { session: mockSession }, error: null });
      },
      onAuthStateChange: (callback) => {
        // Register the callback and return a subscription-like object
        const idx = authHandlers.push(callback) - 1;
        console.log('MOCK_SUPABASE: onAuthStateChange registered at', idx);
        const subscription = {
          unsubscribe: () => { authHandlers[idx] = null; console.log('MOCK_SUPABASE: onAuthStateChange unsubscribed', idx); },
        };
        return { data: { subscription } };
      },
      signUp: async ({ email, password } = {}) => {
        mockSession = { user: { id: 'mock_user', email } };
        console.log('MOCK_SUPABASE: signUp ->', email);
        // notify handlers
        authHandlers.forEach((h) => { if (typeof h === 'function') try { h('SIGNED_IN', mockSession); } catch (e) { console.error('MOCK_SUPABASE handler error', e); } });
        return { data: { user: mockSession.user, session: mockSession }, error: null };
      },
      signInWithPassword: async ({ email, password } = {}) => {
        mockSession = { user: { id: 'mock_user', email } };
        console.log('MOCK_SUPABASE: signInWithPassword ->', email);
        // notify handlers so App.js sees the session change
        authHandlers.forEach((h) => { if (typeof h === 'function') try { h('SIGNED_IN', mockSession); } catch (e) { console.error('MOCK_SUPABASE handler error', e); } });
        return { data: { user: mockSession.user, session: mockSession }, error: null };
      },
      signOut: async () => {
        console.log('MOCK_SUPABASE: signOut');
        mockSession = null;
        authHandlers.forEach((h) => { if (typeof h === 'function') try { h('SIGNED_OUT', null); } catch (e) { console.error('MOCK_SUPABASE handler error', e); } });
        return { error: null };
      },
    },
    from: mockFrom,
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
    storage: { from: mockStorageFrom },
    channel: (name) => mockChannel(name),
    removeChannel: (channel) => { if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe(); },
  };
}

export { supabase };
