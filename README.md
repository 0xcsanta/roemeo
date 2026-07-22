# 🎟️ Roméo Bot

Bot Telegram de **veille billetterie**. Trois sources complémentaires :

1. **API officielle Ticketmaster** — excellente à l'**international** (UK/US…), quasi vide pour la France.
2. **Surveillance de pages FR** (Playwright, fenêtre visible) — lit une page **Ticketmaster.fr** et alerte au passage **🟡 bientôt → 🟢 en vente** (ou 🔥 place réapparue).
3. **Relais d'emails** (IMAP) — récupère les alertes « billets disponibles » envoyées par mail par les billetteries (TM.fr, Fnac…) et les pousse sur Telegram. Couvre ce que le scraping ne peut pas (Fnac est protégé par un anti-bot).

> ⚖️ **Périmètre légal.** Veille + alerte uniquement. **Aucun achat automatisé**, aucun contournement de file d'attente : l'achat reste un **clic humain**. Vérifie aussi la légalité de la **revente** (en France, la revente habituelle sans autorisation de l'organisateur est interdite — art. 313-6-2 du Code pénal).

## Ce qui marche (et ce qui ne marche pas)

| Source | État | Note |
| --- | --- | --- |
| API Ticketmaster (international) | ✅ | Fiable. |
| Ticketmaster.fr (pages event) | ✅ **en mode fenêtre visible** | `HEADLESS=false`. En invisible, Datadome sert une page vide. |
| Fnac Spectacles (scraping) | ❌ | Bloqué par Akamai. → passe par le **relais email**. |
| Relais email | ✅ | Marche avec toutes les billetteries qui envoient des alertes mail. |

## Prérequis

- **Node.js ≥ 18.17** (testé sur v22)
- Un **bot Telegram** (token via @BotFather)
- Une **clé API Ticketmaster** (https://developer.ticketmaster.com)
- *(optionnel)* une **adresse mail dédiée** pour le relais d'alertes

## Installation

```bash
npm install
```

Puis télécharge le navigateur pour la surveillance de pages :

```bash
npm run setup:browser
```

Configure enfin le `.env` (copie `.env.example` si besoin) : `TELEGRAM_BOT_TOKEN` et `TICKETMASTER_API_KEY` au minimum.

## Lancer

```bash
npm start
```

Sur Telegram, envoie `/start` à ton bot.

## Commandes

| Commande | Effet |
| --- | --- |
| `/watch <artiste>` | Veille **internationale** via l'API Ticketmaster (ex : `/watch Coldplay`) |
| `/watch <lien>` | Veille d'une **page FR** (ex : `/watch https://www.ticketmaster.fr/fr/manifestation/...`) |
| `/list` | Mes veilles + leur statut |
| `/unwatch <id>` | Arrêter une veille |
| `/check` | Forcer une vérification maintenant |
| `/help` | Aide |

## Le relais email (optionnel mais recommandé pour la France)

Le principe : sur **Ticketmaster.fr, Fnac, etc.**, tu cliques « Créer une alerte » sur les events qui t'intéressent. Ces sites t'envoient un mail quand des billets sont dispo. Le bot lit cette boîte mail et relaie l'alerte sur Telegram avec le lien.

### Mise en place (Gmail conseillé, adresse dédiée)

1. Crée/dédie une adresse Gmail pour ça.
2. Active la **validation en 2 étapes**, puis génère un **mot de passe d'application** (Google → Sécurité → Mots de passe des applications).
3. Dans `.env` :
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_USER=ton.adresse@gmail.com
   IMAP_PASSWORD=le_mot_de_passe_application_16_lettres
   ```
4. Sur TM.fr / Fnac, mets cette adresse comme contact et crée tes alertes.

> Le bot est en **lecture seule** : il ne marque ni ne supprime aucun mail, il suit juste les nouveaux messages.

## Config (`.env`)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `TM_COUNTRY_CODE` | `FR` | Pays pour l'API TM (international) |
| `POLL_INTERVAL_MINUTES` | `10` | Fréquence de la veille |
| `ONSALE_SOON_HOURS` | `24` | Délai de l'alerte « ouverture imminente » |
| `HEADLESS` | `false` | `false` = fenêtre visible (requis pour TM.fr) |
| `PAGE_TIMEOUT_SECONDS` | `30` | Délai max de chargement d'une page |
| `IMAP_*` | vide | Relais email (vide = désactivé) |
| `EMAIL_POLL_SECONDS` | `60` | Fréquence de vérif des mails |

## Limites connues

- **Ticketmaster.fr** exige `HEADLESS=false` : une fenêtre Chrome s'ouvre, donc il faut un **PC allumé** (pas un serveur sans écran).
- **Fnac** n'est pas scrapable directement → utilise le relais email.
- Pour du **24/7 sans ton PC** et pour scraper Fnac, il faudrait un **service anti-bot payant** (ScraperAPI, etc.) — évolution possible.

## Roadmap

- [ ] Dashboard web (mini-app Telegram) : veilles, historique, stats, rappels
- [ ] Option service anti-bot pour tourner 24/7 sur serveur (+ Fnac)
- [ ] Passerelle WhatsApp
