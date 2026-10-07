// useWatchLiveData — données en direct de l'Apple Watch (Phase 3, 07.10.2026).
//
// Retour : { heartRate, activeKcal, isConnected, isStale, isActive, phase,
//            start(title), pause(), resume(), stop(), cancel(), usedWatch() }
//   isConnected : séance montre en cours ET message reçu il y a < 5 s.
//   isStale     : séance montre en cours mais plus de message (perte de
//                 connexion) → l'overlay garde la dernière valeur, grisée.
//   isActive    : une séance montre a été lancée et n'est pas terminée.
//
// Sans montre (pas appairée, app montre absente, Expo Go, Android, Apple TV,
// ancien build sans le module) : tout reste à null / false, aucune erreur.
//
// Kill switch : WATCH_DISABLED (coupe tout par OTA, sans rebuild).

import { useEffect, useRef, useState } from 'react';
import {
  getWatchStatus,
  startWatchWorkout,
  sendWatchCommand,
  addWatchListener,
  isWatchModuleAvailable,
} from '../../modules/fluidbody-watch';

export const WATCH_DISABLED = false;
const STALE_MS = 5000;

export default function useWatchLiveData(opts) {
  const enabled = !WATCH_DISABLED && !!(opts && opts.enabled) && isWatchModuleAvailable();
  const onRemotePhaseRef = useRef(null);
  onRemotePhaseRef.current = opts && opts.onRemotePhase;

  const [live, setLive] = useState({ heartRate: null, activeKcal: null, lastAt: 0, phase: 'idle' });
  const activeRef = useRef(false);
  const gotDataRef = useRef(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(function () {
    if (!enabled) return undefined;
    const sub = addWatchListener(function (msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'live') {
        if (!activeRef.current) return;
        gotDataRef.current = true;
        setLive(function (prev) {
          const hr = Number(msg.hr);
          const kcal = Number(msg.kcal);
          return {
            heartRate: hr > 0 ? Math.round(hr) : prev.heartRate,
            activeKcal: Number.isFinite(kcal) && kcal >= 0 ? kcal : prev.activeKcal,
            lastAt: Date.now(),
            phase: msg.phase || prev.phase,
          };
        });
      } else if (msg.type === 'state') {
        if (!activeRef.current) return;
        setLive(function (prev) { return Object.assign({}, prev, { phase: msg.phase, lastAt: Date.now() }); });
        try { if (onRemotePhaseRef.current) onRemotePhaseRef.current(msg.phase); } catch (e) {}
      } else if (msg.type === 'ended') {
        activeRef.current = false;
        setIsActive(false);
        setLive(function (prev) { return Object.assign({}, prev, { phase: 'ended' }); });
      }
    });
    return function () { try { sub.remove(); } catch (e) {} };
  }, [enabled]);

  // Démarre la séance sur la montre si elle est appairée et que l'app montre
  // est installée. Renvoie true si une séance montre a été lancée.
  function start(title) {
    if (!enabled || activeRef.current) return false;
    const st = getWatchStatus();
    if (!st.paired || !st.installed) return false;
    activeRef.current = true;
    gotDataRef.current = false;
    setIsActive(true);
    startWatchWorkout(title).then(function (r) {
      if (r && r.launched === false && r.error === 'no_watch') {
        activeRef.current = false;
        setIsActive(false);
      }
    }).catch(function () {});
    return true;
  }

  function command(cmd) {
    if (!activeRef.current) return false;
    return sendWatchCommand(cmd);
  }

  function finish(cmd) {
    if (!activeRef.current) return;
    sendWatchCommand(cmd);
    activeRef.current = false;
    setIsActive(false);
  }

  const now = Date.now();
  const fresh = isActive && live.lastAt > 0 && now - live.lastAt < STALE_MS;
  const stale = isActive && live.lastAt > 0 && !fresh;

  return {
    heartRate: isActive ? live.heartRate : null,
    activeKcal: isActive ? live.activeKcal : null,
    isConnected: fresh,
    isStale: stale,
    isActive: isActive,
    phase: live.phase,
    start: start,
    pause: function () { return command('pause'); },
    resume: function () { return command('resume'); },
    // stop = termine ET enregistre dans Santé (côté montre) ; cancel = abandon.
    stop: function () { finish('stop'); },
    cancel: function () { finish('cancel'); },
    // La montre a-t-elle réellement suivi la séance ? Si oui, c'est ELLE qui
    // enregistre l'entraînement dans Santé : l'iPhone ne doit pas en créer un
    // second (doublon dans les anneaux).
    usedWatch: function () { return activeRef.current && gotDataRef.current; },
    isActiveNow: function () { return activeRef.current; },
  };
}
