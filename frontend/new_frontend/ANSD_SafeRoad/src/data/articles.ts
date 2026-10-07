import newsAccidentUrl from '@/assets/images/news-accident-dakar.png'
import newsAgglomerationUrl from '@/assets/images/news-agglomeration.png'
import newsBoitiersUrl from '@/assets/images/news-boitiers-iot.png'
import newsConseilsFetesUrl from '@/assets/images/news-conseils-fetes.png'
import newsModeleIaUrl from '@/assets/images/news-modele-ia.png'

export const CATEGORIES = ['Sécurité routière', 'Technologie', 'IoT', 'IA', 'Partenariat', 'Conseils'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Article {
  id: string
  /** Absente pour un seul article — fiche §5 : « à combler avant mise en ligne ». */
  image?: string
  category: Category
  date: string
  readTime: string
  title: string
  excerpt: string
  /**
   * Tableau de paragraphes plutôt que bloc HTML — fiche §4 : l'espacement est
   * garanti par la mise en page, et la forme reste transposable telle quelle
   * vers une API (fiche §8).
   */
  paragraphs: string[]
}

export const ARTICLES: Article[] = [
  {
    id: 'saferoad-anaser',
    image: newsAccidentUrl,
    category: 'Partenariat',
    date: '2 septembre 2026',
    readTime: '3 min de lecture',
    title: "SafeRoad et l'ANASER explorent une coopération sur les données routières",
    excerpt:
      "Des échanges techniques sont en cours pour évaluer comment les mesures issues des boîtiers pourraient compléter les statistiques nationales d'accidentologie.",
    paragraphs: [
      "Une première série d'échanges techniques a eu lieu entre l'équipe SafeRoad et des représentants de l'Agence nationale de la sécurité routière (ANASER), pour explorer comment les données remontées par les boîtiers embarqués pourraient venir compléter les statistiques nationales d'accidentologie.",
      "Ces discussions portent pour l'instant sur le cadrage technique : quels champs partager, sous quel format, et selon quelle fréquence de mise à jour. Aucun accord n'est signé à ce stade, et la démarche reste exploratoire des deux côtés.",
      "Si elle aboutit, cette coopération permettrait à l'ANASER de disposer d'un signal complémentaire aux constats officiels, sans s'y substituer. SafeRoad publiera une mise à jour dès qu'une étape formelle sera franchie.",
    ],
  },
  {
    id: 'conseils-fetes',
    image: newsConseilsFetesUrl,
    category: 'Conseils',
    date: '24 août 2026',
    readTime: '4 min de lecture',
    title: '5 conseils pour voyager en toute sécurité pendant les fêtes',
    excerpt:
      "Les départs groupés concentrent le trafic sur quelques axes. Voici ce que les données SafeRoad suggèrent de préparer avant de prendre la route.",
    paragraphs: [
      "Les périodes de fêtes concentrent une part importante des départs sur un nombre restreint d'axes nationaux, sur une fenêtre de quelques jours seulement. Cette concentration se traduit, dans les données SafeRoad, par une hausse ponctuelle des incidents sur les tronçons les plus empruntés.",
      "Avant de prendre la route, il est utile de vérifier l'état des zones signalées sur l'itinéraire prévu, d'anticiper l'horaire de départ pour éviter les pics de trafic, et de prévoir des pauses régulières sur les longs trajets. Un départ décalé de deux à trois heures suffit souvent à éviter les créneaux les plus chargés.",
      "Ces recommandations restent générales : elles ne remplacent pas les consignes de sécurité routière officielles, disponibles auprès de l'ANASER, mais s'appuient sur des tendances observées sur le réseau suivi par la plateforme.",
    ],
  },
  {
    id: 'boitiers-autonomie',
    image: newsBoitiersUrl,
    category: 'IoT',
    date: '11 août 2026',
    readTime: '3 min de lecture',
    title: 'Nouvelle génération de boîtiers : autonomie doublée',
    excerpt:
      'La révision matérielle réduit la consommation du module de transmission et permet le déploiement sur des axes moins équipés en énergie.',
    paragraphs: [
      "La nouvelle révision matérielle des boîtiers embarqués réduit sensiblement la consommation du module de transmission, principal poste de dépense énergétique de l'appareil. En conditions réelles, l'autonomie mesurée double par rapport à la génération précédente.",
      "Ce gain ouvre la possibilité d'installer des boîtiers sur des axes moins bien desservis en infrastructure électrique, où une recharge fréquente n'était pas envisageable. Les zones rurales et les axes secondaires deviennent ainsi plus accessibles à la couverture du réseau.",
      "Le déploiement de cette nouvelle génération se fait progressivement, en remplaçant les boîtiers existants au fil de leur cycle de maintenance plutôt qu'en une seule campagne, pour limiter les interruptions de collecte.",
    ],
  },
  {
    id: 'modele-ia-incident-zone',
    image: newsModeleIaUrl,
    category: 'IA',
    date: '29 juillet 2026',
    readTime: '5 min de lecture',
    title: "Comment le modèle distingue un incident d'une zone à risque",
    excerpt:
      "Un freinage brusque isolé n'a rien d'anormal. C'est la répétition d'un même schéma au même endroit qui fait émerger un point noir.",
    paragraphs: [
      "Le modèle d'analyse utilisé par SafeRoad ne cherche pas à qualifier un événement isolé. Un freinage brusque, une accélération marquée ou un écart de trajectoire, pris seul, entre dans la variabilité normale de la conduite et ne déclenche aucune alerte.",
      "C'est la répétition d'un même type d'événement, au même endroit, sur une fenêtre de temps donnée, qui fait apparaître un signal. Le modèle regroupe ces occurrences par proximité géographique et par nature, puis évalue si leur fréquence dépasse ce qui serait attendu sur un tronçon comparable.",
      "Ce signal reste une proposition, pas une décision. Il alimente le tableau de bord des administrateurs régionaux, à qui revient la validation d'une zone à risque — une étape humaine, volontairement séparée du calcul automatique.",
    ],
  },
  {
    id: 'campagne-agglomeration',
    image: newsAgglomerationUrl,
    category: 'Sécurité routière',
    date: '15 juillet 2026',
    readTime: '3 min de lecture',
    title: "Campagne de sensibilisation sur les entrées d'agglomération",
    excerpt:
      "Les transitions entre route ouverte et zone habitée concentrent une part importante des anomalies détectées sur le réseau national.",
    paragraphs: [
      "Les données collectées sur le réseau national font apparaître une concentration d'anomalies de conduite aux abords des entrées d'agglomération — le point précis où une route ouverte laisse place à une zone habitée, avec ses traversées piétonnes et ses intersections.",
      "Une campagne de sensibilisation a été menée sur plusieurs de ces axes, en lien avec les autorités locales, pour rappeler l'importance de la réduction de vitesse à l'approche de ces transitions, souvent moins marquées que ne le suggère la signalisation existante.",
      "Les premiers relevés après la campagne montrent une baisse des vitesses moyennes enregistrées sur les tronçons concernés. SafeRoad continuera de suivre ces axes pour évaluer si cette évolution se maintient dans la durée.",
    ],
  },
  {
    id: 'carte-maj-continue',
    category: 'Technologie',
    date: '2 juillet 2026',
    readTime: '2 min de lecture',
    title: 'La carte SafeRoad passe à la mise à jour continue',
    excerpt:
      "La couche zones à risque est désormais recalculée en continu au lieu d'une consolidation quotidienne.",
    paragraphs: [
      "Jusqu'ici, la couche des zones à risque affichée sur la carte publique était recalculée une fois par jour, en fin de nuit, à partir des données consolidées de la veille. Ce fonctionnement introduisait un décalage pouvant aller jusqu'à 24 heures entre un événement et sa prise en compte visuelle.",
      "La carte fonctionne désormais en recalcul continu : chaque nouvelle donnée validée est intégrée à la couche affichée dès son traitement, sans attendre une consolidation groupée. L'affichage reste soumis aux mêmes règles de validation qu'auparavant — seule la fréquence de mise à jour change.",
      "Cette évolution technique est invisible pour l'utilisateur au premier regard, mais elle rapproche la carte de ce que le projet vise à terme : une représentation aussi proche que possible de l'état réel du réseau, à tout moment de la journée.",
    ],
  },
]
