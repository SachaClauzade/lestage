/* ============================================================
   Les données du site. C'est le seul fichier à remplir à la main.
   ============================================================ */
const SITE_DATA = {

  /* Tes posts TikTok qui ont marché, du plus vu au moins vu.
     "vues" vient de la grille du profil @bellysafe.app le 26 octobre 2026,
     "hook" est le texte de la première image, "image" la miniature
     (assets/tt/). Un lien /video/ s'ouvre dans la page, un lien /photo/
     (carrousel) s'ouvre sur TikTok. */
  videos: [
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7619038462536174870", vues: 711500, hook: "Barbecue chez des amis samedi. Mon mari sort les merguez. Tout le monde me regarde.", format: "Carrousel", image: "assets/tt/7619038462536174870.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/video/7654580434969333024", vues: 570200, hook: "POV : tu vérifies si tu peux boire du jus de pomme étant enceinte", format: "POV · vidéo", image: "assets/tt/7654580434969333024.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7615013470680993046", vues: 509500, hook: "« Maman s'il te plaît, mange ces aliments… »", format: "Carrousel", image: "assets/tt/7615013470680993046.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7622718501152836867", vues: 400900, hook: "Mon copain a préparé un pique-nique surprise pour me faire plaisir. Il avait tout prévu. Sauf que.", format: "Carrousel", image: "assets/tt/7622718501152836867.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7619218451801885974", vues: 382500, hook: "Apéro du dimanche chez mes parents. Mon père sort le plateau de charcuterie. Et il me regarde avec ses grands yeux…", format: "Carrousel", image: "assets/tt/7619218451801885974.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7650557576874151200", vues: 283000, hook: "Samedi midi, barbecue. Mon mari sort les saucisses, et là tout le monde se tourne vers moi.", format: "Carrousel · variante", image: "assets/tt/7650557576874151200.jpg" },
    { url: "https://www.tiktok.com/@bellysafe.app/photo/7623021100275993858", vues: 198700, hook: "Enceinte de 6 mois. Ce soir j'ai pleuré. Pas à cause du bébé. À cause d'un sandwich.", format: "Carrousel", image: "assets/tt/7623021100275993858.jpg" },
  ],

  /* Ta courbe RevenueCat : l'export "Revenue" en euros, un point par mois,
     dans l'ordre. "tiktok: true" marque le mois des premiers posts TikTok,
     affiché sur la courbe. Les "stats" sont les 4 tuiles au-dessus. */
  revenue: {
    series: [
      { mois: "2025-10", revenu: 0 },
      { mois: "2025-11", revenu: 0 },
      { mois: "2025-12", revenu: 0 },
      { mois: "2026-01", revenu: 17.15, tiktok: true },
      { mois: "2026-02", revenu: 787.11 },
      { mois: "2026-03", revenu: 2664.86 },
      { mois: "2026-04", revenu: 3188.97 },
      { mois: "2026-05", revenu: 2332.23 },
      { mois: "2026-06", revenu: 2831.01 },
      { mois: "2026-07", revenu: 3114.38 },
      { mois: "2026-08", revenu: 3414.21 },
      { mois: "2026-09", revenu: 4149.6 },
      { mois: "2026-10", revenu: 5744.25 },
    ],
    stats: [
      { valeur: 28244, suffixe: " €", label: "encaissés depuis janvier 2026", sub: "export RevenueCat, 12 mois" },
      { valeur: 5744, suffixe: " €", label: "en octobre 2026", sub: "le meilleur mois, et il n'est pas fini" },
      { valeur: 0, suffixe: " €", label: "dépensés en pub", sub: "depuis le premier jour" },
      { valeur: 2, suffixe: " mois", label: "à 200 vues avant que ça marche", sub: "sur ma première app" },
    ],
  },
};
