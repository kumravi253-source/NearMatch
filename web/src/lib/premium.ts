import { supabase } from './supabase';

// Port of src/lib/premium.js. Both RPCs are SECURITY DEFINER and read the
// caller's own subscription state, so there is nothing to pass in.

export async function getPremiumStatus(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_premium');
  if (error) {
    console.error('Failed to check premium status', error);
    return false;
  }
  return !!data;
}

export async function getWalletBalancePaise(): Promise<number> {
  const { data, error } = await supabase.rpc('get_wallet_balance_paise');
  if (error) {
    console.error('Failed to fetch wallet balance', error);
    return 0;
  }
  return data ?? 0;
}

export function formatPaiseAsRupees(paise: number): string {
  return `₹${Math.floor(paise / 100)}`;
}
