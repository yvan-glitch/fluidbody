-- user_favorites: séances marquées en favori par l'utilisateur.
--
-- Modèle : une ligne par (user, session_id) où `session_id` est la clé
-- composite `${pilierKey}_${seanceIndex}` (cohérent avec DownloadManager
-- et video_assets). Le client tient un cache AsyncStorage et resync au
-- pull-to-refresh + à l'ouverture de la Biblio.
--
-- Sécurité : RLS isole strictement les favoris au propriétaire. Pas de
-- lecture cross-user, pas de leak des préférences d'un autre. Cascade
-- ON DELETE sur auth.users garantit le nettoyage si un compte est
-- supprimé.

CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  favorited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
  ON public.user_favorites (user_id, favorited_at DESC);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own favorites" ON public.user_favorites;
CREATE POLICY "Users see own favorites" ON public.user_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
