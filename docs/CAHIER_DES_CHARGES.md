# GeneTrack — Cahier des charges (V1)

Application web de gestion d'un troupeau de Blonde d'Aquitaine (~100 animaux), 100 % gratuite, données stockées sur l'appareil de l'utilisateur.

## 1. Contexte
- Éleveur allaitant, ~100 animaux, vente 100 % au négociant (broutards / réformes).
- Utilisateurs : l'éleveur + son père (occasionnel). Un seul mot de passe.
- Aucun outil existant, aucune reprise de données : saisie 100 % manuelle.
- Usage : PC au bureau, iPhone / Android à l'étable. Réseau 4G/Wi-Fi presque partout, mais le mode hors ligne est apprécié.
- Pas d'organisme de sélection, pas de format réglementaire imposé : outil de gestion interne.

## 2. Périmètre fonctionnel

| Module | Priorité | V1 |
|---|---|---|
| Fiche animal | Indispensable | Oui |
| Reproduction (saillie/IA, diagnostic de gestation, vêlage prévu) | Indispensable | Oui |
| Mouvements (entrée, vente, mort, réforme) | Indispensable | Oui |
| Tableau de bord + alertes | Demandé | Oui |
| Généalogie (mère/père, arbre, consanguinité simple) | Utile | Oui (version simple) |
| Vêlages (facilité, vigueur, incidents, création auto du veau) | Utile | Oui |
| Santé (vaccins, vermifuges, traitements, délai d'attente) | Utile | Oui (version simple) |
| Pesées / croissance | Plus tard | Non |
| Parcelles, alimentation, finances, documents | Plus tard | Non |

### 2.1 Fiche animal
N° national (boucle), n° de travail, nom, sexe, date de naissance, mère, père (animal du troupeau ou texte libre si extérieur), statut (présent / vendu / mort / réformé), date et motif de sortie, notes. Recherche rapide par n° (saisie partielle des derniers chiffres), filtres par statut / sexe / âge.

### 2.2 Reproduction et vêlages
- Saillie ou IA : date, vache, taureau (ou semence).
- Date de vêlage prévue = saillie + 285 jours (paramétrable).
- Diagnostic de gestation : date, résultat (pleine / vide).
- Vêlage : date, mère, sexe du veau, facilité (1 à 4), vigueur, incidents, poids (optionnel). Création du veau en un clic, déjà lié à sa mère et à son père.

### 2.3 Santé
Soin = date, animaux concernés (un ou plusieurs), type (vaccin, vermifuge, antibiotique, autre), produit, dose, délai d'attente (fin calculée), rappel éventuel.

### 2.4 Mouvements
Entrée (achat, naissance), sortie (vente, mort, réforme) : date, animal(aux), acheteur (texte), poids et prix (optionnels). La sortie met à jour le statut.

### 2.5 Tableau de bord
Effectif présent (vaches, génisses, veaux, taureaux), vêlages à venir (30 / 60 jours), diagnostics de gestation à faire, rappels de santé, délais d'attente en cours, animaux vendus dans l'année, rappel de sauvegarde.

### 2.6 Alertes
Le stockage étant local et sans serveur, **l'envoi d'e-mails n'est pas possible**. Alternative gratuite : export d'un calendrier `.ics` (vêlages prévus, diagnostics, rappels), à importer dans Google Calendar / Calendrier iPhone, qui envoient eux-mêmes les rappels par e-mail ou notification. Les alertes sont aussi visibles dans l'app.

## 3. Architecture technique
- **PWA** (Progressive Web App) : installable sur l'écran d'accueil, fonctionne hors ligne (service worker).
- **Aucun serveur, aucune base distante.** Les données restent dans le navigateur de chaque appareil (**IndexedDB**, plus robuste que localStorage, limité à ~5 Mo).
- Code statique (HTML/JS) servi gratuitement par un hébergeur de fichiers (ex. GitHub Pages) ; il est nécessaire de l'ouvrir une fois en HTTPS pour installer la PWA. Les données ne quittent jamais l'appareil.
- Stack : TypeScript, Vite, Preact, Dexie (IndexedDB), Vitest. Interface en français, mobile d'abord (gros boutons, saisie à une main).
- Mot de passe unique : verrouillage de l'application (haché PBKDF2). C'est un verrou d'accès, pas un chiffrement des données.

## 4. Sauvegarde et synchronisation PC ↔ téléphone
- Chaque appareil a **sa propre base**. Il n'y a pas de synchronisation automatique.
- Export complet en JSON (restaurable ultérieurement) + export CSV par tableau, import JSON avec fusion ou remplacement.
- Rappel dans l'app si la dernière sauvegarde a plus de 14 jours.
- Recommandation : une seule source de vérité (par ex. le téléphone) + export régulier vers le PC / clé USB.
- Risque connu : iOS peut purger les données d'un site non installé. Installer la PWA sur l'écran d'accueil et demander le stockage persistant.

## 5. Hors périmètre V1
Synchronisation multi-appareils, e-mails automatiques, import de fichiers existants, scan de boucles, comptes multiples, calcul d'index génétiques officiels, pesées, parcelles, finances.

## 6. Plan de livraison
1. Socle : PWA, base locale, verrou par mot de passe, export/import.
2. Fiche animal + recherche + généalogie.
3. Reproduction, vêlages, mouvements.
4. Santé, tableau de bord, export `.ics`.
5. Tests, finitions mobiles, documentation d'installation.
