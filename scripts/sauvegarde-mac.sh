#!/usr/bin/env bash
# sauvegarde-mac.sh : à lancer UNE fois avant de céder ce Mac.
#   bash ~/fluidbody/scripts/sauvegarde-mac.sh
# 1) Met à l'abri tout ce qui n'est pas commité (branches sauvegarde/*, sans toucher aux fichiers de travail)
# 2) Pousse toutes les branches sur GitHub
# 3) Rassemble sur le Bureau ce qui ne va PAS sur GitHub (secrets, bundles git complets)
DATE="$(date +%F)"
OUT="$HOME/Desktop/transfert-nouveau-mac-$DATE"
mkdir -p "$OUT"
ERR=()
OKN=0

# Instantané de l'arbre de travail dans une branche, sans modifier ni l'index ni les fichiers.
snap() { # $1 = nom de branche, $2 = all | tracked
  local tmp tree c
  tmp="$(mktemp)"; cp "$(git rev-parse --git-path index)" "$tmp"
  if [ "$2" = all ]; then
    GIT_INDEX_FILE="$tmp" git add -A -- . ':(exclude)*.zip' ':(exclude)_backups' ':(exclude)_to_delete' 2>/dev/null
  else
    GIT_INDEX_FILE="$tmp" git add -u 2>/dev/null
  fi
  tree="$(GIT_INDEX_FILE="$tmp" git write-tree)"; rm -f "$tmp"
  [ -z "$tree" ] && { ERR+=("instantané impossible : $1"); return; }
  [ "$tree" = "$(git rev-parse 'HEAD^{tree}')" ] && return
  c="$(git commit-tree "$tree" -p HEAD -m "Sauvegarde du travail non commité ($DATE, avant changement de Mac)")"
  git branch -f "$1" "$c" && echo "   instantané : $1"
}

push_branches() { # $1 = nom du dépôt, $2 = branches à ne pas pousser (séparées par des espaces)
  local b
  for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
    case " $2 " in *" $b "*) echo "   (non poussée, voir bundle) $b"; continue;; esac
    if git push -q origin "$b" 2>/dev/null; then OKN=$((OKN+1)); else ERR+=("$1 : push refusé pour $b"); fi
  done
}

# ---------- fluidbody ----------
if cd "$HOME/fluidbody" 2>/dev/null; then
  echo "== fluidbody"
  git add scripts/sauvegarde-mac.sh
  git diff --cached --quiet || git commit -q -m "Script de sauvegarde avant changement de Mac"
  snap "sauvegarde/mac-pro-$DATE" all
  i=0
  while git rev-parse -q --verify "stash@{$i}" >/dev/null 2>&1; do
    git branch -f "sauvegarde/stash-$i" "stash@{$i}"; i=$((i+1))
  done
  for wt in .claude/worktrees/*/; do
    [ -e "$wt/.git" ] || continue
    ( cd "$wt" && snap "sauvegarde/wt-$(basename "$wt")" tracked )
  done
  # Dépôt PUBLIC : la branche de stratégie reste hors GitHub (elle est dans le bundle).
  push_branches fluidbody "claude/festive-kilby-7f6157"
  git push -q origin --tags 2>/dev/null || ERR+=("fluidbody : push des tags")
  git bundle create "$OUT/fluidbody.bundle" --all 2>/dev/null || ERR+=("fluidbody : bundle")
fi

# ---------- sites web (dépôts privés) ----------
# main n'est PAS poussé : les sites sont déployés depuis ce Mac, un push de main
# pourrait faire redéployer une vieille version par Vercel. main est contenu dans
# la branche courante, donc rien n'est perdu.
for r in espace-pilates-web fluidbody-web fluidbody-privacy; do
  cd "$HOME/$r" 2>/dev/null || continue
  echo "== $r"
  snap "sauvegarde/mac-pro-$DATE" all
  if [ "$r" = fluidbody-privacy ]; then push_branches "$r" ""; else push_branches "$r" "main"; fi
  git bundle create "$OUT/$r.bundle" --all 2>/dev/null || ERR+=("$r : bundle")
done

# ---------- fichiers hors git (secrets : jamais sur GitHub) ----------
cd "$HOME"
shopt -s nullglob
FILES=()
for p in fluidbody/.env fluidbody/.env.local fluidbody/credentials.json fluidbody/credentials fluidbody/KEY \
         fluidbody/eas-last-builds.json fluidbody/CLAUDE-SECURITY-* fluidbody/assets/fluidbody-wallpaper-*.jpg \
         espace-pilates-web/.vercel espace-pilates-web/.env* espace-pilates-web/CLAUDE-SECURITY-* \
         fluidbody-web/.vercel fluidbody-web/.env* fluidbody-web/CLAUDE-SECURITY-* \
         fluidbody-screensaver .app-store; do
  [ -e "$p" ] && FILES+=("$p")
done
rm -f "$OUT/fichiers-hors-git.zip"
zip -qry "$OUT/fichiers-hors-git.zip" "${FILES[@]}" -x '*.DS_Store' || ERR+=("zip des fichiers hors git")

echo
echo "================ RÉSULTAT ================"
echo "Branches poussées ou déjà à jour : $OKN"
echo "Dossier à copier sur le nouveau Mac (AirDrop ou clé USB, PAS par e-mail) :"
echo "   $OUT"
ls -lh "$OUT" | tail -n +2 | awk '{print "   " $5 "  " $9}'
if [ ${#ERR[@]} -gt 0 ]; then
  echo "⚠️  À signaler à Claude :"; for e in "${ERR[@]}"; do echo "   - $e"; done
else
  echo "✅ Tout est passé, aucune erreur."
fi
