# 🚀 Déployer Roméo Bot sur Oracle Cloud (gratuit à vie)

Objectif : faire tourner le bot **24/7**, sans ton PC, pour **0 €**.

Sur le serveur, le bot utilise **l'API Ticketmaster (international)** + **le relais email**
(qui couvre Ticketmaster.fr ET Fnac). Pas de navigateur → `PAGE_WATCH_ENABLED=false`.

---

## Étape 1 — Créer le compte Oracle Cloud

1. Va sur **oracle.com/cloud/free** → **Start for free**.
2. Renseigne email, pays (**choisis la région la plus proche**, ex. *Paris* ou *Frankfurt* — ce choix est définitif).
3. Vérification par téléphone + **carte bancaire** (pour l'identité, **non débitée** sur l'offre Always Free).
4. Une fois le compte créé, tu arrives sur la **Console** Oracle.

## Étape 2 — Créer la machine (Always Free)

1. Menu ☰ → **Compute** → **Instances** → **Create instance**.
2. **Name** : `romeo`.
3. **Image** : clique *Edit* → **Canonical Ubuntu 22.04**.
4. **Shape** : *Edit* → onglet **Always Free eligible** → **VM.Standard.E2.1.Micro** (AMD, 1 Go RAM — suffisant).
5. **SSH keys** : choisis **Generate a key pair for me** et **télécharge la clé privée** (garde-la précieusement), OU colle ta propre clé publique.
6. **Create**. Attends ~1 min, puis note l'**adresse IP publique** de l'instance.

> 🔒 Aucun port entrant à ouvrir : le bot ne fait que des connexions **sortantes** (Telegram, Ticketmaster, mail). Rien à configurer côté réseau.

## Étape 3 — Se connecter en SSH

Depuis PowerShell (Windows), en remplaçant le chemin de la clé et l'IP :

```bash
ssh -i C:\Users\cleme\Downloads\ssh-key-romeo.key ubuntu@TON_IP_PUBLIQUE
```

(Si Windows râle sur les permissions de la clé, tape : `icacls C:\chemin\ma-cle.key /inheritance:r /grant:r "%USERNAME%:R"`.)

## Étape 4 — Installer Node.js

Une fois connecté au serveur :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
```

Vérifie : `node --version` doit afficher v22.x.

## Étape 5 — Mettre le code sur le serveur

**Option A (recommandée) — GitHub :** on pousse le projet sur un dépôt **privé**, puis :

```bash
git clone https://github.com/0xcsanta/roemeo.git && cd roemeo
```

**Option B — sans GitHub :** sur ton PC, zippe le dossier **sans** `node_modules` ni `.env`, envoie-le puis décompresse :

```bash
scp -i ma-cle.key romeo-bot.zip ubuntu@TON_IP:~/ && unzip romeo-bot.zip -d romeo-bot && cd romeo-bot
```

Puis installe les dépendances (sans le navigateur, inutile ici) :

```bash
npm install --omit=optional
```

## Étape 6 — Configurer le `.env` du serveur

```bash
nano .env
```

Colle ceci (adapte les valeurs) :

```
TELEGRAM_BOT_TOKEN=ton_token
TICKETMASTER_API_KEY=ta_cle

TM_COUNTRY_CODE=FR
POLL_INTERVAL_MINUTES=10
ONSALE_SOON_HOURS=24

# Serveur sans écran : pas de navigateur
PAGE_WATCH_ENABLED=false

# Accès réservé (voir Étape 8 pour récupérer les IDs)
ALLOWED_CHAT_IDS=

# Relais email
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=adresse.dediee@gmail.com
IMAP_PASSWORD=mot_de_passe_application
EMAIL_POLL_SECONDS=60
```

Enregistre : `Ctrl+O`, `Entrée`, puis `Ctrl+X`.

## Étape 7 — Lancer en continu avec pm2

pm2 garde le bot en vie (redémarrage auto si crash ou reboot du serveur) :

```bash
sudo npm install -g pm2 && pm2 start src/index.js --name romeo && pm2 save
```

Puis active le démarrage automatique au boot :

```bash
pm2 startup
```

→ pm2 affiche **une commande** à copier-coller (elle commence par `sudo env ...`). Exécute-la, puis refais `pm2 save`.

Vérifie que tout tourne :

```bash
pm2 logs romeo
```

Tu dois voir `✅ Connecté en tant que @...` et `📧 Veille email active`.

## Étape 8 — Verrouiller l'accès à ton pote (et toi)

1. Ton copain (et toi) ouvre le bot sur Telegram et envoie **`/whoami`** → le bot répond un **ID** (un nombre).
2. Sur le serveur : `nano .env`, mets les deux IDs dans `ALLOWED_CHAT_IDS`, séparés par une virgule :
   ```
   ALLOWED_CHAT_IDS=123456789,987654321
   ```
3. Applique : `pm2 restart romeo`.

Désormais le bot **ignore tout autre compte**.

## Étape 9 — Mettre à jour plus tard

- **Option A (GitHub)** : `cd roemeo && git pull && npm install --omit=optional && pm2 restart romeo`
- **Option B (zip)** : renvoie le zip, décompresse par-dessus, puis `pm2 restart romeo`.

---

## Aide-mémoire pm2

| Commande | Effet |
| --- | --- |
| `pm2 logs romeo` | Voir les logs en direct |
| `pm2 restart romeo` | Redémarrer après une modif |
| `pm2 stop romeo` | Arrêter |
| `pm2 status` | État des processus |
