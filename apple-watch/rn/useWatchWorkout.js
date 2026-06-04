// useWatchWorkout.js — hook React Native pour piloter la séance montre depuis
// l'app (côté iPhone). À déposer dans src/hooks/ lors de l'intégration, et à
// utiliser dans VideoPlayer.js.
//
// Usage :
//   const { startOnWatch, stopOnWatch, watchBpm } = useWatchWorkout();
//   // au lancement d'une séance :
//   startOnWatch({ title: seanceTitle, plannedDuration: dureeSecondes });
//   // watchBpm se met à jour en temps réel avec les BPM renvoyés par la montre.
//
// Require protégé : si le module natif n'est pas là (build sans la cible montre,
// Android, Expo Go), le hook devient un no-op — aucun crash.

import { useEffect, useRef, useState, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const WatchSession = Platform.OS === 'ios' ? NativeModules.WatchSession : null;

export function useWatchWorkout() {
  const [watchBpm, setWatchBpm] = useState(0);
  const [watchElapsed, setWatchElapsed] = useState(0);
  const emitterRef = useRef(null);

  useEffect(() => {
    if (!WatchSession) return;
    const emitter = new NativeEventEmitter(WatchSession);
    emitterRef.current = emitter;
    const subHr = emitter.addListener('onWatchHeartRate', (e) => {
      if (e && typeof e.bpm === 'number') setWatchBpm(Math.round(e.bpm));
      if (e && typeof e.elapsed === 'number') setWatchElapsed(e.elapsed);
    });
    const subEnd = emitter.addListener('onWatchWorkoutEnded', () => {
      setWatchBpm(0);
    });
    return () => { subHr.remove(); subEnd.remove(); };
  }, []);

  const startOnWatch = useCallback(async (info) => {
    if (!WatchSession) return { ok: false, reason: 'no-module' };
    try { return await WatchSession.startWatchWorkout(info || {}); }
    catch (e) { return { ok: false, reason: e?.message }; }
  }, []);

  const stopOnWatch = useCallback(() => {
    if (!WatchSession) return;
    try { WatchSession.stopWatchWorkout(); } catch (e) {}
  }, []);

  return { startOnWatch, stopOnWatch, watchBpm, watchElapsed, available: !!WatchSession };
}
