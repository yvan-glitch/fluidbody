// HeartRateZoneBar — barre segmentée + légende temps/% des 3 zones de FC d'une
// séance (Récup / Modéré / Intense). Lecture seule : les `zones` viennent de
// healthkit.js#buildSessionRecap (`[{ key, label, seconds }]`).
//
// Couleurs : palette océan FluidBody. Texte en clair car l'app est en thème
// sombre (#000a1a) — du charcoal y serait illisible (contraste ~1.1:1).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ZONE_COLORS = {
  recup: '#0CA3B8',   // teal
  modere: '#AEEF4D',  // lime (accent de marque)
  intense: '#2CC4D6', // turquoise
  _fallback: 'rgba(255,255,255,0.25)',
};

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export default function HeartRateZoneBar({ zones = [] }) {
  const list = Array.isArray(zones) ? zones : [];
  const total = list.reduce(function (sum, z) { return sum + (z && Number(z.seconds) > 0 ? Number(z.seconds) : 0); }, 0);

  if (total === 0) {
    return (
      <Text style={styles.empty}>
        Pas de données de fréquence cardiaque pour cette séance.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {/* La barre segmentée — décorative pour un lecteur d'écran (la légende
          porte l'info textuelle). */}
      <View
        style={styles.bar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {list.map(function (z) {
          const sec = Number(z.seconds);
          if (!(sec > 0)) return null;
          return (
            <View
              key={z.key}
              style={{ flex: sec, backgroundColor: ZONE_COLORS[z.key] || ZONE_COLORS._fallback }}
            />
          );
        })}
      </View>

      {/* La légende — chaque ligne est lue comme une phrase unique. */}
      <View style={styles.legend}>
        {list.map(function (z) {
          const sec = Number(z.seconds) > 0 ? Number(z.seconds) : 0;
          const pct = Math.round((sec / total) * 100);
          return (
            <View
              key={z.key}
              style={styles.legendRow}
              accessibilityRole="text"
              accessibilityLabel={z.label + ' : ' + formatTime(sec) + ', ' + pct + '%'}
            >
              <View
                style={styles.legendLabel}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={[styles.dot, { backgroundColor: ZONE_COLORS[z.key] || ZONE_COLORS._fallback }]} />
                <Text style={styles.label}>{z.label}</Text>
              </View>
              <Text
                style={styles.value}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {formatTime(sec)}  ·  {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  legend: { marginTop: 14, gap: 10 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: '#EAF2F8', fontSize: 14 },
  value: { color: 'rgba(234,242,248,0.6)', fontSize: 14, fontVariant: ['tabular-nums'] },
  empty: {
    color: 'rgba(234,242,248,0.55)',
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 12,
  },
});
