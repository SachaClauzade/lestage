/* ============================================================
   Les données du site. C'est le seul fichier à remplir à la main.
   ============================================================ */
const SITE_DATA = {

  /* Envoi des candidatures. Le site est statique : il passe par Web3Forms,
     gratuit, qui transmet le formulaire à ton adresse. Pour l'activer :
     1. va sur https://web3forms.com, entre sacha.clauzade@gmail.com ;
     2. tu reçois une clé d'accès par mail ;
     3. colle-la ci-dessous. Sans clé, le bouton ouvre un mail pré-rempli. */
  form: { web3formsKey: "1a8596dc-2c8e-447f-b7f0-077d3bece9b8", to: "sacha.clauzade@gmail.com" },

  /* Tes posts TikTok qui ont marché, du plus vu au moins vu.
     "vues" vient de la grille du profil @bellysafe.app le 26 octobre 2026,
     "hook" est le texte de la première image, "image" la miniature
     (assets/tt/). Un lien /video/ s'ouvre dans la page, un lien /photo/
     (carrousel) s'ouvre sur TikTok. */
  videos: [
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7619038462536174870", date: "2026-03-19", vues: 711500, hook: "Barbecue chez des amis samedi. Mon mari sort les merguez. Tout le monde me regarde.", format: "Carrousel", image: "assets/tt/7619038462536174870.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/video/7654580434969333024", date: "2026-06-23", vues: 570200, hook: "POV : tu vérifies si tu peux boire du jus de pomme étant enceinte", format: "POV · vidéo", image: "assets/tt/7654580434969333024.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7615013470680993046", date: "2026-03-08", vues: 509500, hook: "« Maman s'il te plaît, mange ces aliments… »", format: "Carrousel", image: "assets/tt/7615013470680993046.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7622718501152836867", date: "2026-03-29", vues: 400900, hook: "Mon copain a préparé un pique-nique surprise pour me faire plaisir. Il avait tout prévu. Sauf que.", format: "Carrousel", image: "assets/tt/7622718501152836867.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7619218451801885974", date: "2026-03-20", vues: 382500, hook: "Apéro du dimanche chez mes parents. Mon père sort le plateau de charcuterie. Et il me regarde avec ses grands yeux…", format: "Carrousel", image: "assets/tt/7619218451801885974.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7650557576874151200", date: "2026-06-12", vues: 283000, hook: "Samedi midi, barbecue. Mon mari sort les saucisses, et là tout le monde se tourne vers moi.", format: "Carrousel · variante", image: "assets/tt/7650557576874151200.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7623021100275993858", date: "2026-03-30", vues: 198700, hook: "Enceinte de 6 mois. Ce soir j'ai pleuré. Pas à cause du bébé. À cause d'un sandwich.", format: "Carrousel", image: "assets/tt/7623021100275993858.jpg" },
  ],

  /* Tes comptes TikTok et leurs vues par mois, pour le survol de la courbe.
     Un compte = un nom et un objet { "AAAA-MM": vues }. Au survol d'un mois,
     la page reconstitue les vues totales, répartit le revenu du mois au
     prorata des vues de chaque compte, et marque celui qui a performé.
     @bellysafe.app est pré-rempli avec les vues des 7 posts ci-dessus,
     rangées par mois de publication (date lue dans l'id TikTok). Les autres
     comptes sont à nommer et à remplir depuis TikTok Analytics. */
  comptes: [
    /* ATTENTION : à part mars et juin de @bellysafe.app (déduits des 7 posts),
       ces vues sont INVENTÉES pour remplir la courbe en attendant les vraies
       (TikTok Analytics, vues par mois et par compte). À remplacer. */
    { nom: "@bellysafe.app", vues: { "2026-02": 180000, "2026-03": 2203100, "2026-04": 1240000, "2026-05": 760000, "2026-06": 853200, "2026-07": 910000, "2026-08": 1050000, "2026-09": 1320000, "2026-10": 1680000 } },
    { nom: "compte 2",       vues: { "2026-04": 95000, "2026-05": 210000, "2026-06": 340000, "2026-07": 420000, "2026-08": 380000, "2026-09": 610000, "2026-10": 740000 } },
    { nom: "compte 3",       vues: { "2026-05": 60000, "2026-06": 150000, "2026-07": 290000, "2026-08": 520000, "2026-09": 450000, "2026-10": 560000 } },
    { nom: "compte 4",       vues: { "2026-07": 40000, "2026-08": 120000, "2026-09": 260000, "2026-10": 390000 } },
    { nom: "compte 5",       vues: { "2026-08": 30000, "2026-09": 140000, "2026-10": 310000 } },
    { nom: "compte 6",       vues: { "2026-09": 25000, "2026-10": 180000 } },
  ],

  /* Ta courbe RevenueCat : l'export "Revenue" en euros, un point par mois,
     dans l'ordre. "tiktok: true" marque le mois de sortie de l'app et des premiers
     posts TikTok (février 2026), affiché sur la courbe. Les "stats" sont les 4 tuiles au-dessus. */
  revenue: {
    series: [
      { mois: "2025-10", revenu: 0 },
      { mois: "2025-11", revenu: 0 },
      { mois: "2025-12", revenu: 0 },
      { mois: "2026-01", revenu: 17.15 },
      { mois: "2026-02", revenu: 787.11, tiktok: true },
      { mois: "2026-03", revenu: 2664.86 },
      { mois: "2026-04", revenu: 3188.97 },
      { mois: "2026-05", revenu: 2332.23 },
      { mois: "2026-06", revenu: 2831.01 },
      { mois: "2026-07", revenu: 3114.38 },
      { mois: "2026-08", revenu: 3414.21 },
      { mois: "2026-09", revenu: 4149.6 },
      { mois: "2026-10", revenu: 6200 },
    ],
    stats: [
      { valeur: 28700, suffixe: " €", label: "encaissés depuis janvier 2026", sub: "RevenueCat, 12 mois" },
      { valeur: 6200, suffixe: " €", label: "par mois avec BellySafe", sub: "100 % organique" },
      { valeur: 0, suffixe: " €", label: "dépensés en pub", sub: "depuis le premier jour" },
      { valeur: 2, suffixe: " mois", label: "à 200 vues avant que ça marche", sub: "sur ma première app" },
    ],
  },
  /* Avis de la bêta d'octobre 2026 (formulaire Tally, 23-25 oct.). Textes = leur avis public,
     parfois raccourci sans changer le sens. image: chemin vers l'avatar Discord quand ils l'autorisent. */
  avis: [
    { prenom: "Jimmy", note: 5, image: "", texte: "Exactement ce pour quoi j'étais venu : une explication de A à Z sur comment faire du contenu organique sur TikTok pour son app. En plus, un accompagnement personnalisé pour chaque compte, avec des retours constructifs. Je recommande." },
    { prenom: "Thomas", note: 5, image: "", texte: "Ton app arrive et tu ne connais pas la prochaine étape. Le meilleur moyen, c'est d'apprendre le marketing organique pour démarrer, et ici tu es au bon endroit." },
    { prenom: "Pauline", note: 5, image: "", texte: "J'ai beaucoup appris : mieux travailler mes hooks, créer des posts plus accrocheurs, mieux mettre en avant mon app. Depuis que j'applique les conseils, le trafic vers mon app a augmenté. Les lives sont un vrai plus : Sacha analyse nos comptes et nos contenus, et il est très disponible dès qu'on a une question." },
    { prenom: "Aubin", note: 5, image: "", texte: "Si tu viens de démarrer et que tu as peu de budget, le contenu organique sur TikTok est probablement le meilleur levier pour toi. Tous les tips nécessaires à ton démarrage sont dans cette formation." },
    { prenom: "Georges", note: 5, image: "", texte: "Une formation parfaite, courte, avec des fondamentaux solides pour quelqu'un qui n'a jamais fait de marketing. Je recommande fortement." },
  ],
};
