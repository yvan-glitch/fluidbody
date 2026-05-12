// Compat shim. The original GlassCard is now `src/components/ui/GlassCard.js`,
// built on the GlassView primitive. This re-export keeps existing imports
// (`../components/GlassCard`) working while we migrate call sites.
//
// The new GlassCard exposes the same children-based API; the old
// `reflection`/`reflectionHeight`/`reflectionColor`/`bg` props are silently
// accepted and forwarded to the closest new equivalents so we don't have to
// rewrite every screen in this sprint.

import GlassCard from './ui/GlassCard';
export default GlassCard;
