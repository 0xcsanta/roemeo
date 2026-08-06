#!/usr/bin/env bash
# Met à jour Roméo Bot sur le serveur : récupère le code, réinstalle si besoin, redémarre.
# Usage sur le serveur :  bash update.sh
set -e
cd "$(dirname "$0")"
echo "⬇️  Récupération de la dernière version…"
git pull
echo "📦 Vérification des dépendances…"
npm install
echo "🔄 Redémarrage du bot…"
pm2 restart romeo
echo "✅ Bot mis à jour et redémarré."
