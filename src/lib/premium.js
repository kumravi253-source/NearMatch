import { supabase } from './supabase';

export async function getPremiumStatus() {
  const { data, error } = await supabase.rpc('is_premium');
  if (error) {
    console.error('Failed to check premium status', error);
    return false;
  }
  return !!data;
}

export async function getWalletBalancePaise() {
  const { data, error } = await supabase.rpc('get_wallet_balance_paise');
  if (error) {
    console.error('Failed to fetch wallet balance', error);
    return 0;
  }
  return data ?? 0;
}

export function formatPaiseAsRupees(paise) {
  return `₹${Math.floor(paise / 100)}`;
}
