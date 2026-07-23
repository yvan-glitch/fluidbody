// ── reportError ──
// Helper unique pour les échecs d'I/O critiques (Supabase, IAP, HealthKit…).
// Avant (audit 2026-07-23) : ~236 `catch {}` vides avalaient les erreurs — un
// upsert profil raté passait inaperçu (ni Sentry, ni feedback utilisateur).
// Usage :
//   reportError('profiles.upsert.postAuth', e);                    // silencieux (Sentry + log dev)
//   reportError('progression.upsert', e, { alert: tr.err_sync }); // + alerte utilisateur
import { Alert } from 'react-native';

let Sentry = null;
try { Sentry = require('@sentry/react-native'); } catch (e) {}

export function reportError(scope, error, opts) {
  try {
    if (__DEV__) console.warn('[reportError:' + scope + ']', (error && (error.message || error)) || 'unknown');
    if (Sentry && Sentry.captureException) {
      const err = error instanceof Error ? error : new Error(scope + ': ' + String((error && error.message) || error || 'unknown'));
      if (Sentry.withScope) {
        Sentry.withScope(function (s) {
          try { s.setTag('scope', scope); } catch (e) {}
          Sentry.captureException(err);
        });
      } else {
        Sentry.captureException(err);
      }
    }
    if (opts && opts.alert) Alert.alert('FluidBody+', opts.alert);
  } catch (e) {}
}
