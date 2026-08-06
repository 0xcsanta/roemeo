# 🚀 Déployer Roméo Bot sur Oracle Cloud (gratuit à vie)

Objectif : faire tourner le bot **24/7**, sans ton PC, pour **0 €**.

Le bot utilise **l'API Ticketmaster (monde)** + **le relais email** (qui couvre Ticketmaster.fr
ET Fnac). Aucun navigateur, aucune dépendance lourde : ça tient dans la plus petite VM gratuite.

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

**Option A (recommandée) — GitHub :** le dépôt est **public** (aucun secret dedans : le `.env` est ignoré par git). Sur le serveur :

```bash
git clone https://github.com/0xcsanta/roemeo.git && cd roemeo
```

**Option B — sans GitHub :** sur ton PC, zippe le dossier **sans** `node_modules` ni `.env`, envoie-le puis décompresse :

```bash
scp -i ma-cle.key romeo-bot.zip ubuntu@TON_IP:~/ && unzip romeo-bot.zip -d romeo-bot && cd romeo-bot
```

Puis installe les dépendances (sans le navigateur, inutile ici) :

```bash
npm install
```

## Étape 6 — Configurer le `.env` du serveur

```bash
nano .env
```

Colle ceci (adapte les valeurs) :

```
TELEGRAM_BOT_TOKEN=ton_token
TICKETMASTER_API_KEY=ta_cle

# Vide = recherche mondiale (l'API TM ne couvre quasiment pas la France)
TM_COUNTRY_CODE=
POLL_INTERVAL_MINUTES=10
ONSALE_SOON_HOURS=24

# Accès réservé : mets DÉJÀ ton ID ici (voir Étape 8), ne laisse pas vide
ALLOWED_CHAT_IDS=

# Relais email
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=adresse.dediee@gmail.com
IMAP_PASSWORD=mot_de_passe_application
EMAIL_POLL_SECONDS=60
```

Enregistre : `Ctrl+O`, `Entrée`, puis `Ctrl+X`.

Puis restreins les droits du fichier — il contient le mot de passe d'application Gmail,
qui donne accès en **lecture à toute la boîte** :

```bash
chmod 600 .env
```

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

> ⚠️ Tant que `ALLOWED_CHAT_IDS` est **vide**, le bot est ouvert : n'importe qui le trouvant
> sur Telegram peut s'abonner et recevoir tes alertes (objet et lien de tes mails compris).
> Ne laisse pas cette fenêtre ouverte.

`/whoami` répond **même aux comptes non autorisés** — tu peux donc verrouiller dès le départ :

1. Envoie **`/whoami`** au bot depuis ton compte → il te donne ton **ID** (un nombre).
2. Mets-le tout de suite dans `.env` (`nano .env`), puis `pm2 restart romeo`.
3. Ton copain envoie **`/whoami`** à son tour (ça marche même s'il est bloqué), il te donne son ID.
4. Ajoute-le, séparé par une virgule, et redémarre :
   ```
   ALLOWED_CHAT_IDS=123456789,987654321
   ```
   ```bash
   pm2 restart romeo
   ```

Désormais le bot **ignore tout autre compte** — en réception comme en envoi : un inconnu
abonné avant le verrouillage cesse immédiatement de recevoir quoi que ce soit.

## Étape 9 — Mettre à jour plus tard

- **Option A (GitHub)** : `cd roemeo && git pull && npm install && pm2 restart romeo`
- **Option B (zip)** : renvoie le zip, décompresse par-dessus, puis `pm2 restart romeo`.

---

## Aide-mémoire pm2

| Commande | Effet |
| --- | --- |
| `pm2 logs romeo` | Voir les logs en direct |
| `pm2 restart romeo` | Redémarrer après une modif |
| `pm2 stop romeo` | Arrêter |
| `pm2 status` | État des processus |
