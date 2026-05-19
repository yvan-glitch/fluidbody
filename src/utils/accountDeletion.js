// accountDeletion
//
// Client side of the Apple-mandated in-app account deletion flow.
// Wraps the Supabase RPC `delete_my_account` (see
// supabase/migrations/20260521000000_delete_account.sql), then signs out
// and clears local user data so the next launch lands on onboarding.
//
// Errors are surfaced as thrown Error objects so the caller (Profil
// "Danger Zone" UI) can show a localized Alert and offer the support
// email fallback.

import { clearLocalUserData } from './clearLocalData';

export async function deleteMyAccount(supabase) {
  if (!supabase) {
    throw new Error('supabase_unavailable');
  }

  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) {
    // PostgREST surfaces RPC failures here. Preserve the original error so
    // upstream code can inspect .code / .message if needed.
    throw error;
  }
  if (!data || data.ok !== true) {
    const reason = (data && data.error) || 'delete_failed';
    throw new Error(reason);
  }

  // Best-effort: even if signOut or local clear partially fails we still
  // consider the deletion successful (the server-side row is gone). The
  // App.js auth listener will pick up the SIGNED_OUT event and reset
  // state regardless.
  try { await supabase.auth.signOut(); } catch (e) {}
  try { await clearLocalUserData(); } catch (e) {}

  return data.deleted || {};
}

export default deleteMyAccount;
