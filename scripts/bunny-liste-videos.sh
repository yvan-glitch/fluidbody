#!/bin/bash
# Liste les vidéos d'une bibliothèque Bunny Stream dans bunny-videos.csv.
# Usage : ./scripts/bunny-liste-videos.sh [numero_bibliotheque]
LIB="${1:-627513}"
KEY="${BUNNY_KEY:-}"
if [ -z "$KEY" ]; then read -p "Clé API de la bibliothèque Bunny $LIB (visible) : " KEY; fi
KEY=$(printf %s "$KEY" | tr -d '[:space:]')
echo "Clé reçue : ${#KEY} caractères, commence par ${KEY:0:4}…"
OUT="$(cd "$(dirname "$0")/.." && pwd)/bunny-videos.csv"
echo "titre;guid;duree_s;etat;collection" > "$OUT"
page=1; total=0
while :; do
  resp=$(curl -s -w "\n%{http_code}" "https://video.bunnycdn.com/library/$LIB/videos?page=$page&itemsPerPage=100&orderBy=title" -H "AccessKey: $KEY" -H "accept: application/json")
  code=$(echo "$resp" | tail -1); json=$(echo "$resp" | sed '$d')
  if [ "$code" != "200" ]; then
    echo "Bunny répond $code pour la bibliothèque $LIB :"; echo "$json" | head -c 300; echo
    echo "→ 401 = mauvaise clé ; 404 = mauvais numéro de bibliothèque."; exit 1
  fi
  n=$(echo "$json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('items',[])
with open('$OUT','a') as f:
    for v in items: f.write(f\"{v['title']};{v['guid']};{v.get('length',0)};{v.get('status')};{v.get('collectionId','')}\n\")
print(len(items), d.get('totalItems','?'))")
  cnt=${n% *}; tot=${n#* }
  [ $page -eq 1 ] && echo "Bibliothèque $LIB : $tot vidéos au total"
  total=$((total+cnt))
  [ "$cnt" -lt 100 ] && break
  page=$((page+1))
done
echo "OK : $total vidéos listées dans bunny-videos.csv"
