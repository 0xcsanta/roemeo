# 🎟️ Roméo Bot

Bot Telegram de **veille billetterie**. Deux sources complémentaires :

1. **API officielle Ticketmaster** — recherche **mondiale** par artiste, alerte à l'ouverture des ventes. Quasi vide pour la France.
2. **Relais d'emails** (IMAP) — récupère les alertes « billets disponibles » envoyées par mail par les billetteries (Ticketmaster.fr, Fnac…) et les pousse sur Telegram. **C'est la solution pour la France.**

> ⚖️ **Périmètre légal.** Veille + alerte uniquement. **Aucun achat automatisé**, aucun contournement de file d'attente ni d'anti-bot : l'achat reste un **clic humain**. Vérifie aussi la légalité de la **revente** (en France, la revente habituelle sans autorisation de l'organisateur est interdite — art. 313-6-2 du Code pénal).

## Ce qui marche (et ce qui ne marche pas)

| Source | État | Note |
| --- | --- | --- |
| API Ticketmaster (monde) | ✅ | Fiable. Laisser `TM_COUNTRY_CODE` vide. |
| API Ticketmaster (France) | ❌ | Le catalogue FR est quasi vide côté API. → relais email. |
| Lecture des pages billetterie | ❌ *(retiré)* | Ticketmaster.fr est derrière Datadome, Fnac derrière Akamai. Les contourner sortirait du périmètre légal du projet → fonctionnalité supprimée. |
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

Configure ensuite le `.env` (copie `.env.example` si besoin) : `TELEGRAM_BOT_TOKEN` et `TICKETMASTER_API_KEY` au minimum.

## Lancer

```bash
npm start
```

Sur Telegram, envoie `/start` à ton bot.

## Commandes

| Commande | Effet |
| --- | --- |
| `/watch <artiste>` | Veille **mondiale** via l'API Ticketmaster (ex : `/watch Coldplay`) |
| `/list` | Mes veilles |
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
| `TM_COUNTRY_CODE` | *(vide)* | Filtre pays de l'API TM. **Vide = monde entier** (recommandé : l'API est quasi vide pour la FR) |
| `POLL_INTERVAL_MINUTES` | `10` | Fréquence de la veille |
| `ONSALE_SOON_HOURS` | `24` | Délai de l'alerte « ouverture imminente » |
| `ALLOWED_CHAT_IDS` | vide | IDs Telegram autorisés (réception **et** envoi). Vide = ouvert à tous |
| `IMAP_*` | vide | Relais email (vide = désactivé) |
| `EMAIL_POLL_SECONDS` | `60` | Fréquence de vérif des mails |

## Limites connues

- L'API Ticketmaster **ne couvre pas la France** : pour un event FR, crée l'alerte sur le site de la billetterie avec l'adresse mail dédiée, le relais email fera le reste.
- La **lecture des pages** de billetterie a été retirée : Ticketmaster.fr et Fnac sont derrière des anti-bot, et les contourner sortirait du périmètre légal que se fixe le projet.
- Le relais email ne voit que ce qui **arrive dans la boîte surveillée** — pense à mettre cette adresse sur les comptes billetterie (ou un transfert automatique).

## Roadmap

- [ ] Dashboard web (mini-app Telegram) : veilles, historique, stats, rappels
- [ ] Passerelle WhatsApp
