// accountDeletion
//
// Client side of the Apple-mandated in-app account deletion flow.
// Wraps the Supabase RPC `delete_my_account` (see
// supabase/migrations/20260521000000_delete_account.sql), then logs out
// of RevenueCat (Apple 5.1.1(v) — full revocation), signs out of
// Supabase, and clears local user data so the next launch lands on
// onboarding.
//
// Errors are surfaced as thrown Error objects so the caller (Profil
// "Danger Zone" UI) can show a localized Alert and offer the support
// email fallback.

import { clearLocalUserData } from './clearLocalData';

// Safe-require de react-native-purchases : optional sur Expo Go / simulateur
// où le module natif n'est pas dispo. On no-op si absent.
let _Purchases = null;
try { _Purchases = require('react-native-purchases').default; } catch (e) {}

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
  // RC logOut AVANT supabase.auth.signOut() — Apple 5.1.1(v) demande la
  // dissociation complète de l'utilisateur, y compris ses achats. Sans
  // ça, le user RC reste lié au compte supprimé.
  try { if (_Purchases && _Purchases.logOut) await _Purchases.logOut(); } catch (e) {}
  try { await supabase.auth.signOut(); } catch (e) {}
  try { await clearLocalUserData(); } catch (e) {}

  return data.deleted || {};
}

export default deleteMyAccount;
