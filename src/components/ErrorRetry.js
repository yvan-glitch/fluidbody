// ErrorRetry — Liquid Glass error card with a retry button.
//
// Used by any caller that wants to surface a recoverable network/IO
// failure without dropping into an Alert.alert (which feels too
// system-modal for the Fluidbody style). Three preset "kinds" pre-fill a
// reasonable copy so call sites don't have to repeat the same strings —
// override `title`/`description` when needed.
//
// Kinds:
//   - 'network' : generic connection failure
//   - 'video'   : video could not be played
//   - 'auth'    : session expired / supabase auth lost
//
// Pass `compact` for an inline pill (used inside scrollable lists), or
// leave it false for the standard card layout.

import { View, Text } from 'react-native';
import { GlassCard, GlassButton } from './ui';
import { useTheme } from '../theme/ThemeProvider';

const KIND_FALLBACKS = {
  network: {
    title: { fr: 'Hors-ligne', en: 'Offline' },
    description: {
      fr: 'On reprend dès que la connexion revient.',
      en: 'We\'ll pick up as soon as the connection is back.',
    },
  },
  video: {
    title: {
      fr: 'Lecture impossible',
      en: 'Playback unavailable',
    },
    description: {
      fr: 'Cette séance ne peut pas être lue maintenant.',
      en: 'This session can\'t be played right now.',
    },
  },
  auth: {
    title: {
      fr: 'Connecte-toi pour continuer',
      en: 'Sign in to continue',
    },
    description: {
      fr: 'Ta session a expiré — reconnecte-toi pour retrouver ta progression.',
      en: 'Your session expired — sign in to recover your progress.',
    },
  },
};

function pick(map, lang) {
  if (!map) return '';
  if (map[lang]) return map[lang];
  return map.fr || map.en || '';
}

export default function ErrorRetry({
  kind = 'network',     // 'network' | 'video' | 'auth'
  title,                // override
  description,          // override
  retryLabel,           // override CTA text
  onRetry,              // function — when omitted, the button is hidden
  lang = 'fr',
  compact = false,
  style,
}) {
  const { theme } = useTheme();
  const fallback = KIND_FALLBACKS[kind] || KIND_FALLBACKS.network;
  const resolvedTitle = title || pick(fallback.title, lang);
  const resolvedDesc = description || pick(fallback.description, lang);
  const resolvedRetry = retryLabel ||
    (lang === 'en' ? 'Retry' : lang === 'es' ? 'Reintentar' : lang === 'it' ? 'Riprova' : 'Réessayer');

  return (
    <GlassCard padded padding={compact ? 14 : 20} style={style}>
      <View style={{ flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'flex-start' }}>
        <View style={{ flex: compact ? 1 : undefined, marginRight: compact ? 12 : 0, marginBottom: compact ? 0 : 10 }}>
          <Text
            style={{
              fontSize: compact ? 14 : 16,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 4,
            }}
          >
            {resolvedTitle}
          </Text>
          {resolvedDesc ? (
            <Text
              style={{
                fontSize: compact ? 12 : 13,
                color: theme.colors.textSecondary,
                lineHeight: compact ? 17 : 19,
              }}
            >
              {resolvedDesc}
            </Text>
          ) : null}
        </View>
        {onRetry ? (
          <GlassButton
            variant="accent"
            size={compact ? 'sm' : 'md'}
            fullWidth={!compact}
            onPress={onRetry}
          >
            {resolvedRetry}
          </GlassButton>
        ) : null}
      </View>
    </GlassCard>
  );
}
