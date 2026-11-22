// Comptes admin (Yvan, Sabrina, testeurs) : catalogue complet + accès vidéo.
//
// Source de vérité depuis le 22.11.2026 : la table Supabase `app_admins`,
// lue par l'edge function sign-video-url et exposée au client par la RPC
// `is_admin()` (migration 20261122030000). Pour ajouter un admin : une ligne
// dans cette table, plus rien à changer dans l'app.
//
// FALLBACK_ADMIN_EMAILS ne sert que si la RPC ne répond pas (migration pas
// encore poussée, hors-ligne au tout premier lancement). À vider une fois la
// migration en production.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FALLBACK_ADMIN_EMAILS = ['admin@fluidbody.ch', 'yvan@espace-pilates.ch', 'sabrina@espace-pilates.ch', 'sabrina.tissot@icloud.com', 'yvan.tissot@icloud.com', 'qcrm6vkbnx@privaterelay.appleid.com', 'maelle.raemy@gmail.com'];

export function isFallbackAdmin(email) {
  return !!email && FALLBACK_ADMIN_EMAILS.indexOf(String(email).toLowerCase()) !== -1;
}

export function useIsAdmin(supabase, user) {
  const uid = user && user.id;
  const email = user && user.email;
  const [flag, setFlag] = useState(isFallbackAdmin(email));
  useEffect(function () {
    let cancelled = false;
    if (!uid) { setFlag(false); return undefined; }
    setFlag(isFallbackAdmin(email));
    const key = 'fluid_is_admin_' + uid;
    AsyncStorage.getItem(key).then(function (v) {
      if (!cancelled && (v === '1' || v === '0')) setFlag(v === '1');
    }).catch(function () {});
    if (supabase) {
      Promise.resolve(supabase.rpc('is_admin')).then(function (res) {
        if (cancelled || !res || res.error || typeof res.data !== 'boolean') return;
        setFlag(res.data);
        AsyncStorage.setItem(key, res.data ? '1' : '0').catch(function () {});
      }).catch(function () {});
    }
    return function () { cancelled = true; };
  }, [uid, email]);
  return flag;
}
