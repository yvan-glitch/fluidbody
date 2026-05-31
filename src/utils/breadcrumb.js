// Centralized Sentry breadcrumb helper (OTA, 2026-06).
//
// Breadcrumbs are the trail of user actions Sentry attaches to a crash report,
// so a prod crash arrives with "Login → Started session → Video error" context
// instead of a bare stack. They cost ~nothing at runtime.
//
// Safe-require so this is a pure no-op in Expo Go and when Sentry was never
// init'd (no DSN) — `addBreadcrumb` on an uninitialised hub just drops the
// crumb. No PII: pass only ids / enum-ish values in `data`, never email.

let _Sentry = null;
try { _Sentry = require('@sentry/react-native'); } catch (e) {}

/**
 * breadcrumb('Started session', { pilier, seanceIndex }, { category, level })
 * @param {string} message  short human label
 * @param {object} [data]   small key/value bag (no PII)
 * @param {object} [opts]   { category = 'user', level = 'info' }
 */
export function breadcrumb(message, data, opts) {
  if (!_Sentry || typeof _Sentry.addBreadcrumb !== 'function') return;
  try {
    _Sentry.addBreadcrumb({
      category: (opts && opts.category) || 'user',
      message: message,
      level: (opts && opts.level) || 'info',
      data: data || undefined,
    });
  } catch (e) {}
}
