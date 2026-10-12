// Textes officiels intégrés à la fonction : aucun compte ni clé nécessaire.
// Source : Code du travail, loi n° 92/007 du 14 août 1992 (copie NATLEX fournie) et
// CCN Commerce 2024 (lue sur image). Seuls les articles relus figurent ici.
// Pour un autre article, l'IA doit le dire : elle n'a pas à l'inventer.

export type Texte = { ref: string; mots: string[]; texte: string };

export const TEXTES: Texte[] = [
  { ref: "Code du travail, art. 23", mots: ["contrat de travail", "contrat", "definition"],
    texte: "Le contrat de travail est une convention par laquelle un travailleur s'engage à mettre son activité professionnelle sous l'autorité et la direction d'un employeur, en contrepartie d'une rémunération. Les contrats de travail sont passés librement." },
  { ref: "Code du travail, art. 25", mots: ["cdd", "cdi", "duree determinee", "duree indeterminee", "renouvellement"],
    texte: "Le CDD ne peut être conclu pour une durée supérieure à deux ans et peut être renouvelé pour la même durée. Le CDD d'un travailleur camerounais ne peut être renouvelé plus d'une fois avec la même entreprise ; ensuite, si la relation de travail se poursuit, le contrat devient à durée indéterminée." },
  { ref: "Code du travail, art. 27", mots: ["ecrit", "cdd", "contrat ecrit"],
    texte: "Tout contrat de travail stipulant une durée déterminée supérieure à trois mois doit être constaté par écrit." },
  { ref: "Code du travail, art. 30", mots: ["amende", "mise a pied", "sanction", "disciplinaire"],
    texte: "Il est interdit à l'employeur d'infliger des amendes. La mise à pied ne peut excéder huit jours ouvrables ; elle doit être notifiée par écrit avec ses motifs et communiquée à l'inspecteur du travail dans les quarante-huit heures. Sinon, elle est nulle." },
  { ref: "Code du travail, art. 34", mots: ["resiliation", "licenciement", "preavis", "rupture", "notification"],
    texte: "Le contrat à durée indéterminée peut être résilié par la volonté de l'une des parties. La résiliation est subordonnée à un préavis et doit être notifiée par écrit à l'autre partie, avec indication du motif. Les conditions et la durée du préavis sont fixées par arrêté du ministre du Travail, compte tenu de l'ancienneté et de la classification." },
  { ref: "Code du travail, art. 35", mots: ["preavis", "liberte", "recherche d'emploi"],
    texte: "Pendant le préavis, le travailleur bénéficie, pour chercher un autre emploi, d'un jour de liberté par semaine, payé à plein salaire." },
  { ref: "Code du travail, art. 37", mots: ["indemnite de licenciement", "licenciement", "anciennete"],
    texte: "En cas de rupture d'un CDI du fait de l'employeur, hors faute lourde, le travailleur ayant accompli une durée de service continue d'au moins deux ans a droit à une indemnité de licenciement distincte de celle du préavis. Ses modalités de calcul sont fixées par arrêté." },
  { ref: "Code du travail, art. 39", mots: ["dommages", "interets", "abusif", "licenciement abusif"],
    texte: "Toute rupture abusive peut donner lieu à des dommages-intérêts. Leur montant, sans excéder un mois de salaire par année d'ancienneté, ne peut être inférieur à trois mois de salaire. Le salaire de référence est le salaire moyen mensuel brut des douze derniers mois. Il appartient à l'employeur de prouver le motif légitime." },
  { ref: "Code du travail, art. 44", mots: ["certificat de travail", "certificat"],
    texte: "À la fin du contrat, l'employeur délivre un certificat de travail indiquant exclusivement la date d'entrée, celle de sortie, la nature et les dates des emplois successivement occupés." },
  { ref: "Code du travail, art. 68", mots: ["salaire", "paie", "paiement", "acompte", "delai", "fin de contrat", "solde"],
    texte: "Le salaire est payé à intervalles réguliers ne pouvant excéder un mois. Sur demande, le travailleur peut recevoir au bout de quinze jours un acompte portant sur la moitié de sa rémunération de base. Les paiements mensuels doivent être effectués au plus tard huit jours après la fin du mois de travail. En cas de rupture, le salaire et les indemnités doivent être payés dès la cessation de service." },
  { ref: "Code du travail, art. 74", mots: ["prescription", "prescrit", "salaire"],
    texte: "L'action en paiement du salaire se prescrit par trois ans. Les indemnités liées à la rupture du contrat sont assimilées au salaire pour cette prescription." },
  { ref: "Code du travail, art. 80", mots: ["duree du travail", "heures supplementaires", "heure supplementaire", "40 heures"],
    texte: "La durée du travail ne peut excéder quarante heures par semaine dans les établissements non agricoles. Les décrets, pris après avis de la Commission nationale consultative du travail, fixent les dérogations et les modalités de rémunération et de majoration des heures supplémentaires. Le taux de majoration n'est pas dans le texte consulté : il doit être confirmé dans le décret applicable." },
  { ref: "Code du travail, art. 84", mots: ["maternite", "conge de maternite", "accouchement", "grossesse", "enceinte"],
    texte: "Toute femme enceinte a droit à un congé de maternité de quatorze semaines, qui commence quatre semaines avant la date présumée de l'accouchement. Il peut être prolongé de six semaines en cas de maladie dûment constatée, résultant de la grossesse ou des couches. Pendant ce congé, l'employeur ne peut rompre le contrat pour ce motif. L'indemnité journalière est à la charge de la Caisse nationale de prévoyance sociale et égale au salaire effectivement perçu au moment de la suspension du contrat. Le montant exact dépend des plafonds et de la base de calcul CNPS, non reproduits dans le texte consulté." },
  { ref: "Code du travail, art. 85", mots: ["allaitement", "allaiter", "maternite"],
    texte: "Pendant une période de quinze mois à compter de la naissance de l'enfant, la mère a droit à des repos pour allaitement, d'une heure par journée de travail au maximum." },
  { ref: "Code du travail, art. 89", mots: ["conge", "conges", "conge paye", "conges payes", "jours de conge"],
    texte: "Sauf dispositions plus favorables de la convention collective ou du contrat, le travailleur acquiert le droit au congé payé à raison d'un jour et demi ouvrable par mois de service effectif. Certaines périodes (accident du travail, maladie professionnelle, congé de maternité, chômage technique) sont assimilées à du service effectif." },
  { ref: "Code du travail, art. 92", mots: ["conge", "conges", "droit au conge"],
    texte: "Le droit de jouissance au congé est acquis après une durée de service égale à un an. Le droit au congé se prescrit par trois ans à compter de la cessation du travail." },
  { ref: "Code du travail, art. 124", mots: ["delegue", "delegues", "heures de delegation"],
    texte: "Le chef d'établissement laisse aux délégués du personnel le temps nécessaire à l'exercice de leurs fonctions, dans la limite de quinze heures par mois, sauf circonstances exceptionnelles ou convention contraire. Ce temps est payé comme temps de travail." },
  { ref: "CCN Commerce 2024, art. 63 (congés, lu sur image)", mots: ["conge", "conges", "conge paye", "commerce", "convention"],
    texte: "Congés payés : deux jours ouvrables par mois de service effectif, sauf clauses plus favorables. Majoration selon l'ancienneté : 24 jours (0 à 5 ans), 27 (5 à 10 ans), 30 (10 à 15 ans), 33 (15 à 19 ans), 36 (19 à 23 ans), 39 (23 à 27 ans). Allocation de congé : un douzième de la rémunération totale de la période de référence." },
  { ref: "CCN Commerce 2024, art. 42 (préavis, lu sur image)", mots: ["preavis", "commerce", "convention", "liberte"],
    texte: "Pendant le préavis : deux jours de liberté par semaine, payés à plein salaire. Les durées de préavis sont fixées par la réglementation ; des délais plus longs peuvent être prévus par contrat individuel." },
  { ref: "CCN Commerce 2024, art. 45 (indemnité de licenciement, lu sur image)", mots: ["indemnite de licenciement", "commerce", "convention", "licenciement"],
    texte: "Indemnité de licenciement : due à partir d'un an de service. Taux appliqué au salaire mensuel moyen des douze derniers mois, par année de présence : 30 % (1 à 5 ans), 35 % (5 à 10 ans), 45 % (10 à 15 ans), 50 % (15 à 20 ans), 55 % (au-delà de 20 ans). Le mode d'application (taux de la tranche pour toutes les années, ou par tranche) n'est pas tranché par le texte : à faire confirmer par un juriste." },
  { ref: "CCN Commerce 2024, art. 51 (heures supplémentaires, lu sur image)", mots: ["heures supplementaires", "heure supplementaire", "majoration", "commerce", "ferie", "nuit"],
    texte: "Heures supplémentaires effectuées les jours de repos hebdomadaire ou jours fériés : majoration de 50 % (jour et jours fériés) et de 100 % (nuit). Les heures faites les jours ouvrables sont rémunérées selon la réglementation ou des modalités plus favorables." },
];

// Normalise un texte (minuscules, sans accents) pour la comparaison
export function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, " ");
}

// Choisit les textes les plus pertinents pour la question (au plus 5)
export function textesPour(question: string): Texte[] {
  const q = " " + normaliser(question) + " ";
  return TEXTES
    .map((t) => ({ t, score: t.mots.reduce((n, m) => n + (q.includes(normaliser(m)) ? normaliser(m).length : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.t);
}
