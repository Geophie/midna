import type { Lang } from "@/lib/store";

export interface AtlantaNoticeContent {
  title: string;
  paragraphs: string[];
  classesIntro: string;
  classes: { label: string; value: string }[];
  resultsTitle: string;
  results: { label: string; value: string }[];
  baselineIntro: string;
  baseline: { label: string; value: string }[];
  versionOfRecord: string;
}

export const ATLANTA_NOTICE: Record<Lang, AtlantaNoticeContent> = {
  en: {
    title: "Notice regarding the published Atlanta results",
    paragraphs: [
      "A post-publication reproducibility review identified an error in the legacy preprocessing workflow used for the environmental enhancement reported in the Atlanta case study.",
      "The issue affected the DEM integration step: the legacy workflow relied on positional CSV handling and incorrectly used Latitude instead of the intended DEM_weight. A north–south row-order mismatch was also identified in the legacy DEM-processing files.",
      "Consequently, the final enhanced results were slightly altered: latitude effectively acted as a constant in the calculation, while the DEM did not enter the calculation as intended.",
      "The corresponding author has formally reported the error to the journal, and the correction process is currently underway.",
      "The corrected analysis was performed as a fresh reanalysis in MIDNA rather than by repairing or reusing the legacy positional-CSV workflow.",
      "MIDNA does not rely on the same row-based DEM-processing logic. Instead, it processes the DEM directly within the geospatial pipeline, computes the mean elevation for each grid cell, and then assigns the corresponding DEM weight.",
    ],
    classesIntro: "The corrected rerun used the intended elevation classes:",
    classes: [
      { label: "0 ≤ elevation < 250 m", value: "w = 0.4" },
      { label: "250 ≤ elevation < 350 m", value: "w = 0.8" },
      { label: "elevation ≥ 350 m", value: "w = 0" },
    ],
    resultsTitle: "Corrected enhanced-model results",
    results: [
      { label: "Anchor raw score", value: "5,390,946.242" },
      { label: "Cells searched before reaching the anchor", value: "1,023 / 40,000" },
      { label: "Hit Score Percentage (HSP)", value: "2.56%" },
      { label: "Search area", value: "33.53 km²" },
      { label: "Restricted area", value: "1,276.7 km²" },
      { label: "Ground-truth to home-guess distance", value: "6.86 km" },
      { label: "Gini coefficient", value: "90.61%" },
    ],
    baselineIntro: "The baseline CGT results remain unchanged apart from rounding precision:",
    baseline: [
      { label: "HSP", value: "6.59%" },
      { label: "Cells searched before reaching the anchor", value: "2,638 / 40,000" },
    ],
    versionOfRecord:
      "Until the journal formally updates the Version of Record, users attempting to reproduce the Atlanta analysis should use the corrected MIDNA results reported above rather than the enhanced-model values currently shown in the published article.",
  },
  it: {
    title: "Avviso relativo ai risultati pubblicati per il caso studio di Atlanta",
    paragraphs: [
      "Una revisione di riproducibilità condotta successivamente alla pubblicazione ha individuato un errore nella precedente procedura di pre-elaborazione utilizzata per l’integrazione ambientale nel caso di studio di Atlanta.",
      "Il problema riguardava la fase di integrazione del modello digitale di elevazione (DEM). La procedura precedente si basava su una gestione posizionale dei file CSV e utilizzava erroneamente il campo Latitude al posto del valore previsto DEM_weight. È stata inoltre individuata un’incongruenza nell’ordinamento nord–sud delle righe nei file utilizzati per l’elaborazione del DEM.",
      "Di conseguenza, i risultati finali del modello enhanced risultavano leggermente alterati: la latitudine finiva per agire come un fattore costante nel calcolo, mentre il DEM non contribuiva al modello nel modo previsto.",
      "L’autrice corrispondente ha formalmente segnalato l’errore alla rivista e la procedura di correzione è attualmente in corso.",
      "L’analisi corretta è stata eseguita ex novo in MIDNA, anziché correggere o riutilizzare la precedente procedura basata sull’associazione posizionale dei dati CSV.",
      "MIDNA non utilizza la stessa logica di elaborazione del DEM basata sull’ordine delle righe. Il DEM viene invece elaborato direttamente all’interno della pipeline geospaziale: per ciascuna cella della griglia viene calcolata l’elevazione media e, sulla base di tale valore, viene quindi assegnato il corrispondente peso DEM.",
    ],
    classesIntro: "La nuova analisi ha utilizzato le classi altimetriche previste:",
    classes: [
      { label: "0 ≤ elevazione < 250 m", value: "w = 0,4" },
      { label: "250 ≤ elevazione < 350 m", value: "w = 0,8" },
      { label: "elevazione ≥ 350 m", value: "w = 0" },
    ],
    resultsTitle: "Risultati corretti del modello enhanced",
    results: [
      { label: "Raw score dell’anchor", value: "5.390.946,242" },
      { label: "Celle esaminate prima di raggiungere l’anchor", value: "1.023 / 40.000" },
      { label: "Hit Score Percentage (HSP)", value: "2,56%" },
      { label: "Area di ricerca", value: "33,53 km²" },
      { label: "Area ristretta", value: "1.276,7 km²" },
      { label: "Distanza tra ground truth e home guess", value: "6,86 km" },
      { label: "Coefficiente di Gini", value: "90,61%" },
    ],
    baselineIntro:
      "I risultati del modello CGT baseline rimangono invariati, fatta eccezione per differenze dovute alla precisione dell’arrotondamento:",
    baseline: [
      { label: "HSP", value: "6,59%" },
      { label: "Celle esaminate prima di raggiungere l’anchor", value: "2.638 / 40.000" },
    ],
    versionOfRecord:
      "Fino a quando la rivista non aggiornerà formalmente la Version of Record, gli utenti che intendono riprodurre l’analisi di Atlanta dovrebbero fare riferimento ai risultati corretti ottenuti con MIDNA e riportati sopra, anziché ai valori del modello enhanced attualmente presenti nell’articolo pubblicato.",
  },
};
