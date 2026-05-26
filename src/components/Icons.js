// Icons — central SVG icon library.
//
// Every icon component takes `{ size, color, strokeWidth }`. Defaults:
//   size = 24, color = '#AEEF4D' (brand lime), strokeWidth = 1.7
// Style: Lucide-inspired outline — round caps + joins, single accent stroke,
// minimal interior detail. Each icon stays under ~5 SVG primitives so they
// rasterize cleanly at small sizes (badge grid 40px, headers 16-22px).
//
// Used everywhere we previously had emoji glyphs (achievement badges, daily
// intentions, post-session reflections, profil section headers, close/check
// affordances, etc.). On Apple TV the same components ship — react-native-svg
// renders identically to iPhone on tvOS.

import Svg, { Path, Circle, Line, Polyline, Rect, Polygon, G } from 'react-native-svg';

const LIME = '#AEEF4D';

function base(props) {
  return {
    width: props.size || 24,
    height: props.size || 24,
    viewBox: '0 0 24 24',
    fill: 'none',
  };
}
function stroke(props) {
  return {
    stroke: props.color || LIME,
    strokeWidth: props.strokeWidth || 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}
function solid(props) {
  return { fill: props.color || LIME };
}

// ─── Achievement icons (15) ────────────────────────────────────────────

export function IconSeedling(props) {
  // first_seance — stem with 2 sprout leaves.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 22 V12" />
      <Path {...s} d="M12 14 C 8 11, 6 12, 6 15" />
      <Path {...s} d="M12 11 C 16 8, 18 9, 18 13" />
    </Svg>
  );
}

export function IconFlame(props) {
  // streak_3 / Energetic / Energized — stylized flame.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 2 C 11 5, 8 7, 8 11 C 8 13, 9 14, 10 14 C 10 12, 11 11, 11 9 C 12 11, 13 12, 13 14 C 15 13, 16 11, 15 8" />
      <Path {...s} d="M6 14 C 6 18, 9 21, 12 21 C 15 21, 18 18, 18 14 C 18 12, 17 11, 16 10" />
    </Svg>
  );
}

export function IconLightning(props) {
  // streak_7 — lightning bolt.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M13 2 L4 14 H11 L10 22 L20 10 H13 L13 2 Z" />
    </Svg>
  );
}

export function IconStar(props) {
  // streak_30 — 5-point star, outline.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 3 L14.5 9 L21 9.7 L16 14 L17.5 21 L12 17.5 L6.5 21 L8 14 L3 9.7 L9.5 9 Z" />
    </Svg>
  );
}

export function IconJellyfish(props) {
  // count_10 / brand méduse — dome + 3 tentacles.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M4 11 C 4 6, 8 3, 12 3 C 16 3, 20 6, 20 11 H 4 Z" />
      <Path {...s} d="M7 14 C 7 17, 9 18, 9 21" />
      <Path {...s} d="M12 14 V 21" />
      <Path {...s} d="M17 14 C 17 17, 15 18, 15 21" />
    </Svg>
  );
}

export function IconMountain(props) {
  // count_50 / Grounded — twin-peak mountain.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M3 19 L9 9 L13 15 L16 11 L21 19 Z" />
    </Svg>
  );
}

export function IconCrown(props) {
  // count_100 — 3-peak crown with band.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M3 18 L4 8 L9 12 L12 6 L15 12 L20 8 L21 18 Z" />
      <Path {...s} d="M4.5 18 H19.5" />
    </Svg>
  );
}

export function IconGlobe(props) {
  // pilier_tour — circle + meridian + equator.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M3 12 H21" />
      <Path {...s} d="M12 3 C 8 7, 8 17, 12 21" />
      <Path {...s} d="M12 3 C 16 7, 16 17, 12 21" />
    </Svg>
  );
}

export function IconMeditation(props) {
  // specialist_mat — seated meditation silhouette (head + body + legs).
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={5.5} r={2.5} {...s} />
      <Path {...s} d="M12 8 C 9 10, 8 13, 8 16 C 6 16, 4 17, 4 19 H 20 C 20 17, 18 16, 16 16 C 16 13, 15 10, 12 8 Z" />
    </Svg>
  );
}

export function IconSpine(props) {
  // specialist_back — vertical spine with vertebrae dots.
  const s = stroke(props);
  const c = props.color || LIME;
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 2 V22" />
      <Circle cx={12} cy={5} r={1.2} fill={c} />
      <Circle cx={12} cy={9} r={1.2} fill={c} />
      <Circle cx={12} cy={13} r={1.2} fill={c} />
      <Circle cx={12} cy={17} r={1.2} fill={c} />
      <Circle cx={12} cy={21} r={1.2} fill={c} />
    </Svg>
  );
}

export function IconDroplet(props) {
  // specialist_mobility / Supple — water droplet.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 3 C 8 8, 5 12, 5 15 C 5 19, 8 22, 12 22 C 16 22, 19 19, 19 15 C 19 12, 16 8, 12 3 Z" />
    </Svg>
  );
}

export function IconLeaf(props) {
  // specialist_posture — leaf with central vein.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M4 20 C 4 11, 11 4, 20 4 C 20 13, 13 20, 4 20 Z" />
      <Path {...s} d="M4 20 L20 4" />
    </Svg>
  );
}

export function IconSunrise(props) {
  // early_bird — half sun over horizon line.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M5 15 A7 7 0 0 1 19 15" />
      <Path {...s} d="M2 18 H22" />
      <Path {...s} d="M12 3 V5" />
      <Path {...s} d="M5 7 L6.5 8.5" />
      <Path {...s} d="M19 7 L17.5 8.5" />
    </Svg>
  );
}

export function IconMoon(props) {
  // night_owl / Tired / dark-theme — crescent moon.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z" />
    </Svg>
  );
}

export function IconCompass(props) {
  // explorer — compass with N pointer.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M14.5 9.5 L12 16 L9.5 14.5 L16 12 Z" />
    </Svg>
  );
}

// ─── Intentions + Reflections extras ───────────────────────────────────

export function IconZen(props) {
  // Calm — concentric circles.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Circle cx={12} cy={12} r={5} {...s} />
      <Circle cx={12} cy={12} r={1.5} fill={props.color || LIME} />
    </Svg>
  );
}

export function IconWave(props) {
  // Détendue / Grounded2 — sine wave.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M3 14 Q 6 9, 9 14 T 15 14 T 21 14" />
      <Path {...s} d="M3 9 Q 6 4, 9 9 T 15 9 T 21 9" opacity={0.5} />
    </Svg>
  );
}

export function IconSparkle(props) {
  // Léger / Light2 — 4-point burst.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 3 L13 11 L21 12 L13 13 L12 21 L11 13 L3 12 L11 11 Z" />
    </Svg>
  );
}

export function IconSmile(props) {
  // Relaxed — face with smile.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M8.5 14 Q 12 17, 15.5 14" />
      <Circle cx={9} cy={10} r={0.8} fill={props.color || LIME} />
      <Circle cx={15} cy={10} r={0.8} fill={props.color || LIME} />
    </Svg>
  );
}

export function IconSleep(props) {
  // Tired — Zz crescent.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 7 H12 L6 14 H12" />
      <Path {...s} d="M14 4 H18 L14 9 H18" strokeWidth={1.3} opacity={0.7} />
      <Path {...s} d="M5 19 Q 12 22, 19 19" />
    </Svg>
  );
}

// ─── UI generics ───────────────────────────────────────────────────────

export function IconTrophy(props) {
  // 🏆 — trophy cup.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M8 4 H16 V11 A4 4 0 0 1 8 11 V4 Z" />
      <Path {...s} d="M16 6 H19 V8 A2 2 0 0 1 16 9" />
      <Path {...s} d="M8 6 H5 V8 A2 2 0 0 0 8 9" />
      <Path {...s} d="M10 15 H14" />
      <Path {...s} d="M9 20 H15" />
      <Path {...s} d="M12 15 V20" />
    </Svg>
  );
}

export function IconHeartFilled(props) {
  return (
    <Svg {...base(props)}>
      <Path {...solid(props)} d="M12 21 L4 13 A4.5 4.5 0 0 1 12 7.5 A4.5 4.5 0 0 1 20 13 L12 21 Z" />
    </Svg>
  );
}

export function IconHeartOutline(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 21 L4 13 A4.5 4.5 0 0 1 12 7.5 A4.5 4.5 0 0 1 20 13 L12 21 Z" />
    </Svg>
  );
}

export function IconSearch(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={11} cy={11} r={6.5} {...s} />
      <Path {...s} d="M16 16 L21 21" />
    </Svg>
  );
}

export function IconLock(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Rect x={5} y={11} width={14} height={10} rx={2} {...s} />
      <Path {...s} d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
    </Svg>
  );
}

export function IconClose(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 6 L18 18" />
      <Path {...s} d="M18 6 L6 18" />
    </Svg>
  );
}

export function IconCheck(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M5 12 L10 17 L19 7" />
    </Svg>
  );
}

export function IconCheckCircle(props) {
  // ✅ verified check.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M8 12 L11 15 L16 9" />
    </Svg>
  );
}

export function IconGear(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={3} {...s} />
      <Path {...s} d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9" />
    </Svg>
  );
}

export function IconBell(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 16 V11 A6 6 0 0 1 18 11 V16 L20 19 H4 L6 16 Z" />
      <Path {...s} d="M10 19 A2 2 0 0 0 14 19" />
    </Svg>
  );
}

export function IconBarChart(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M4 20 V12" />
      <Path {...s} d="M10 20 V8" />
      <Path {...s} d="M16 20 V4" />
      <Path {...s} d="M3 20 H20" />
    </Svg>
  );
}

export function IconCreditCard(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Rect x={3} y={6} width={18} height={13} rx={2} {...s} />
      <Path {...s} d="M3 10 H21" />
      <Path {...s} d="M6 15 H10" />
    </Svg>
  );
}

export function IconUser(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={8} r={4} {...s} />
      <Path {...s} d="M4 21 C 4 16, 8 14, 12 14 C 16 14, 20 16, 20 21" />
    </Svg>
  );
}

export function IconInfo(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M12 10 V17" />
      <Circle cx={12} cy={7} r={0.9} fill={props.color || LIME} />
    </Svg>
  );
}

export function IconWarning(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 3 L22 20 H2 L12 3 Z" />
      <Path {...s} d="M12 10 V15" />
      <Circle cx={12} cy={18} r={0.9} fill={props.color || LIME} />
    </Svg>
  );
}

export function IconConfetti(props) {
  // 🎉 — pop burst lines.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M3 21 L9 8 L16 15 L3 21 Z" />
      <Path {...s} d="M14 4 V7" />
      <Path {...s} d="M18 6 L20 5" />
      <Path {...s} d="M20 11 H22" />
      <Path {...s} d="M16 11 L18 10" />
    </Svg>
  );
}

export function IconGift(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Rect x={4} y={9} width={16} height={12} rx={1.5} {...s} />
      <Path {...s} d="M2 9 H22" />
      <Path {...s} d="M12 9 V21" />
      <Path {...s} d="M12 9 C 9 9, 7 6, 9 4 C 11 3, 12 6, 12 9 C 12 6, 13 3, 15 4 C 17 6, 15 9, 12 9 Z" />
    </Svg>
  );
}

export function IconNoTracking(props) {
  // 🚫 — circle with diagonal slash.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...s} d="M5.5 5.5 L18.5 18.5" />
    </Svg>
  );
}

export function IconApple(props) {
  // 🍎 — apple (HealthKit).
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 8 C 9 8, 5 9, 5 14 C 5 18, 8 22, 11 22 C 11.5 22, 12 21.5, 12 21.5 C 12 21.5, 12.5 22, 13 22 C 16 22, 19 18, 19 14 C 19 9, 15 8, 12 8 Z" />
      <Path {...s} d="M12 8 C 12 6, 13 4, 15 3" />
      <Path {...s} d="M11 7 C 9 6, 8 4, 9 2" />
    </Svg>
  );
}

export function IconCamera(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Rect x={3} y={7} width={18} height={13} rx={2} {...s} />
      <Path {...s} d="M9 7 L10.5 4 H13.5 L15 7" />
      <Circle cx={12} cy={13.5} r={3.5} {...s} />
    </Svg>
  );
}

export function IconSun(props) {
  // ☀ — light theme.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={4} {...s} />
      <Path {...s} d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9" />
    </Svg>
  );
}

export function IconAutoTheme(props) {
  // ◐ — half-filled circle = "auto follows system".
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Circle cx={12} cy={12} r={9} {...s} />
      <Path {...solid(props)} d="M12 3 A9 9 0 0 1 12 21 V3 Z" />
    </Svg>
  );
}

export function IconPlay(props) {
  // ▶ — play triangle (used in TV cards).
  return (
    <Svg {...base(props)}>
      <Path {...solid(props)} d="M7 4 V20 L20 12 L7 4 Z" />
    </Svg>
  );
}

export function IconDownload(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 4 V16" />
      <Path {...s} d="M7 12 L12 17 L17 12" />
      <Path {...s} d="M4 20 H20" />
    </Svg>
  );
}

export function IconRotate(props) {
  // ↺ — rotate / reset.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M4 12 A8 8 0 1 1 7 18" />
      <Path {...s} d="M4 18 V13 H9" />
    </Svg>
  );
}

export function IconChevronUp(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 15 L12 9 L18 15" />
    </Svg>
  );
}

export function IconChevronDown(props) {
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 9 L12 15 L18 9" />
    </Svg>
  );
}

export function IconChair(props) {
  // 🪑 — active pause / office chair.
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M6 3 V12 H18 V3" />
      <Path {...s} d="M5 12 H19 L18 16 H6 L5 12 Z" />
      <Path {...s} d="M7 16 V21" />
      <Path {...s} d="M17 16 V21" />
    </Svg>
  );
}

export function IconTree(props) {
  // 🌳 — tree (Grounded intention alt).
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 3 L17 11 H14 L19 18 H5 L10 11 H7 L12 3 Z" />
      <Path {...s} d="M12 18 V22" />
    </Svg>
  );
}

export function IconLotus(props) {
  // 🪷 — lotus petals (statistics member-since).
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M12 22 C 7 19, 4 14, 4 10 C 7 10, 9 13, 12 14 C 15 13, 17 10, 20 10 C 20 14, 17 19, 12 22 Z" />
      <Path {...s} d="M12 14 C 10 12, 9 10, 10 7 C 12 8, 13 10, 12 14" />
      <Path {...s} d="M12 14 C 14 12, 15 10, 14 7 C 12 8, 11 10, 12 14" />
    </Svg>
  );
}

export function IconArrowLeft(props) {
  // ← — back chevron (used in screen headers).
  const s = stroke(props);
  return (
    <Svg {...base(props)}>
      <Path {...s} d="M19 12 H5" />
      <Path {...s} d="M11 6 L5 12 L11 18" />
    </Svg>
  );
}

// ─── Icon key map (used by data-driven contexts) ───────────────────────
// Achievements catalogue references icons by key instead of emoji strings.

export const ICON_BY_KEY = {
  seedling: IconSeedling,
  flame: IconFlame,
  lightning: IconLightning,
  star: IconStar,
  jellyfish: IconJellyfish,
  mountain: IconMountain,
  crown: IconCrown,
  globe: IconGlobe,
  meditation: IconMeditation,
  spine: IconSpine,
  droplet: IconDroplet,
  leaf: IconLeaf,
  sunrise: IconSunrise,
  moon: IconMoon,
  compass: IconCompass,
  zen: IconZen,
  wave: IconWave,
  sparkle: IconSparkle,
  smile: IconSmile,
  sleep: IconSleep,
  trophy: IconTrophy,
  heart_filled: IconHeartFilled,
  heart_outline: IconHeartOutline,
  search: IconSearch,
  lock: IconLock,
  close: IconClose,
  check: IconCheck,
  check_circle: IconCheckCircle,
  gear: IconGear,
  bell: IconBell,
  bar_chart: IconBarChart,
  credit_card: IconCreditCard,
  user: IconUser,
  info: IconInfo,
  warning: IconWarning,
  confetti: IconConfetti,
  gift: IconGift,
  no_tracking: IconNoTracking,
  apple: IconApple,
  camera: IconCamera,
  sun: IconSun,
  auto_theme: IconAutoTheme,
  play: IconPlay,
  download: IconDownload,
  rotate: IconRotate,
  chevron_up: IconChevronUp,
  chevron_down: IconChevronDown,
  chair: IconChair,
  tree: IconTree,
  lotus: IconLotus,
  arrow_left: IconArrowLeft,
};

export function Icon({ name, size, color, strokeWidth }) {
  const C = ICON_BY_KEY[name];
  if (!C) return null;
  return <C size={size} color={color} strokeWidth={strokeWidth} />;
}

export default Icon;
