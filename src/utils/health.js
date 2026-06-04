// health.js — façade santé multi-plateforme.
//
// Aiguille vers HealthKit (iOS) ou Health Connect (Android) selon la
// plateforme, avec une interface IDENTIQUE. Les écrans (Activity, Statistics,
// ProfileOnboarding, profileSync…) importent CE fichier au lieu de healthkit.js
// directement, et n'ont plus à se soucier de la plateforme.
//
//   import health from '../utils/health';
//   await health.ensureHealthKitInit();
//   const rings = await health.readActivitySummary();

import { Platform } from 'react-native';
import * as ios from './healthkit';
import * as android from './healthConnect';

const impl = Platform.OS === 'android' ? android : ios;

export const ensureHealthKitInit = impl.ensureHealthKitInit;
export const isHealthKitReady = impl.isHealthKitReady;
export const readDateOfBirth = impl.readDateOfBirth;
export const readBiologicalSex = impl.readBiologicalSex;
export const readLatestWeightKg = impl.readLatestWeightKg;
export const readLatestHeightCm = impl.readLatestHeightCm;
export const writeWeightKg = impl.writeWeightKg;
export const writeHeightCm = impl.writeHeightCm;
export const readActivitySummary = impl.readActivitySummary;
export const readDayDetails = impl.readDayDetails;
export const readDayWorkouts = impl.readDayWorkouts;
export const readActivityHistory = impl.readActivityHistory;
// Android uniquement (lecture ponctuelle du BPM pour la pastille en séance).
// Sur iOS la pastille passe par le hook useLiveHeartRate → ici undefined, OK.
export const readRecentHeartRate = impl.readRecentHeartRate;

export default {
  ensureHealthKitInit,
  isHealthKitReady,
  readDateOfBirth,
  readBiologicalSex,
  readLatestWeightKg,
  readLatestHeightCm,
  writeWeightKg,
  writeHeightCm,
  readActivitySummary,
  readDayDetails,
  readDayWorkouts,
  readActivityHistory,
  readRecentHeartRate,
};
