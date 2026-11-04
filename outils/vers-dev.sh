#!/usr/bin/env bash
# Copie pupitre/ (ou le mod indiqué) dans le dossier des mods de la session indiquée (rechargement à chaud).
# Usage : outils/vers-dev.sh <id-de-session> [dossier-du-mod, outils/pupitre-regle par exemple]
set -euo pipefail
cd "$(dirname "$0")/.."
mod="${2:-pupitre}"
cible="$HOME/.claude/dev-mods/$1/$(basename "$mod")"
mkdir -p "$cible"
cp -r "$mod/." "$cible/"
echo "copié vers $cible"
