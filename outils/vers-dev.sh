#!/usr/bin/env bash
# Copie pupitre/ dans le dossier des mods de la session indiquée (rechargement à chaud).
# Usage : outils/vers-dev.sh <id-de-session>
set -euo pipefail
cd "$(dirname "$0")/.."
cible="$HOME/.claude/dev-mods/$1/pupitre"
mkdir -p "$cible"
cp -r pupitre/. "$cible/"
echo "copié vers $cible"
