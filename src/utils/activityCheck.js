// Smart Notifications — HealthKit-based "is the user already active?" probe.
//
// Used by the smart-notifications layer to decide whether to suppress the
// hourly "pause active" notifications during a day where the user has
// already moved enough. Failures degrade silently to `active: false` so the
// notification system keeps firing as a safe default.
//
// Spec (MVP) — OR semantics on the current calendar day :
//   steps        > 8000
//   activeEnergy > 250 kcal
//   standHours   > 6
//
// Any one threshold breached => the user counts as already active.

import healthkit from './health';

const STEP_THRESHOLD = 8000;
const ACTIVE_ENERGY_THRESHOLD_KCAL = 250;
const STAND_HOURS_THRESHOLD = 6;

const SAFE_FALLBACK = Object.freeze({ active: false, reason: null, values: null });

/**
 * Read today's activity from HealthKit and tell whether at least one of the
 * MVP thresholds has been crossed.
 *
 * Returns `{ active, reason, values }` where:
 *   - active : boolean — true if any threshold breached
 *   - reason : 'steps' | 'energy' | 'stand' | null — which threshold won
 *             (priority: steps > energy > stand, so the most "obvious" signal
 *             surfaces first in logs)
 *   - values : { steps, activeEnergy, standHours } | null — raw HK reading,
 *             null when HK unavailable / authorisation refused / error
 */
export async function isUserAlreadyActive() {
  try {
    const init = await healthkit.ensureHealthKitInit();
    if (!init || !init.ok) return SAFE_FALLBACK;

    const now = new Date();
    const [summary, details] = await Promise.all([
      healthkit.readActivitySummary(now),
      healthkit.readDayDetails(now),
    ]);

    const steps = (details && Number(details.steps)) || 0;
    const activeEnergy = (summary && Number(summary.moveKcal)) || 0;
    const standHours = (summary && Number(summary.standHours)) || 0;

    const values = { steps: steps, activeEnergy: activeEnergy, standHours: standHours };

    if (steps > STEP_THRESHOLD) {
      return { active: true, reason: 'steps', values: values };
    }
    if (activeEnergy > ACTIVE_ENERGY_THRESHOLD_KCAL) {
      return { active: true, reason: 'energy', values: values };
    }
    if (standHours > STAND_HOURS_THRESHOLD) {
      return { active: true, reason: 'stand', values: values };
    }
    return { active: false, reason: null, values: values };
  } catch (e) {
    return SAFE_FALLBACK;
  }
}

export const ACTIVITY_THRESHOLDS = Object.freeze({
  steps: STEP_THRESHOLD,
  activeEnergyKcal: ACTIVE_ENERGY_THRESHOLD_KCAL,
  standHours: STAND_HOURS_THRESHOLD,
});

export default { isUserAlreadyActive: isUserAlreadyActive, ACTIVITY_THRESHOLDS: ACTIVITY_THRESHOLDS };
