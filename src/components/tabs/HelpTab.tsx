"use client";

import { Card } from "@/components/ui/Card";
import { guideIt } from "@/lib/guideIt";
import { useAppStore } from "@/lib/store";

type Section = { title: string; body: string[]; steps?: string[] };
type Guide = { title: string; subtitle: string; intro: string[]; sections: Section[] };

const italianSectionTitles = new Set([
  "Scopo e limiti", "Come iniziare", "Scheda Input", "Scheda Parametri",
  "Outlier spaziali — HubDist", "Griglia", "Parametri della formula di Rossmo",
  "B — Buffer Zone", "K — costante di scala CGT", "Normalizzazione dello score",
  "Coefficiente di Gini", "Scheda Layers", "Scheda Output", "Interpretazione responsabile",
  "Base metodologica", "Bibliografia",
]);

const italianLabels = new Set([
  "Crime locations", "Quali location utilizzare?", "Anchor point", "Reticolo personalizzato",
  "Motore di calcolo", "CRS di input e CRS di analisi", "Importante: un outlier non è necessariamente un errore",
  "Procedura raccomandata", "Effetto sull’analisi", "f — distance decay esterno",
  "g — comportamento interno alla buffer zone", "Default f = 1.2 e g = 1.2",
  "Interpretazione dei layer", "Layer DEM", "Prestazioni", "Layer di inclusione ed esclusione",
  "Perché utilizzare pesi intermedi?", "Shapefile", "Hit Score %", "Search Area",
  "Guess Distance", "Confrontare Baseline ed Enhanced", "Esportazione", "Legenda della heatmap",
  "Scala adattiva", "Rank", "Actual", "Priority %", "Hit Score % nella legenda", "Z-Score",
  "Contorni heatmap",
]);

const italianSeparatedHeadings = new Set([
  "Come iniziare", "Scheda Input", "Scheda Parametri", "Scheda Layers", "Scheda Output",
  "Legenda della heatmap", "Interpretazione responsabile", "Base metodologica",
]);

const italianHighlights = new Map<number, string[]>([
  [4, ["Criminal Geographic Targeting (CGT)"]], [5, ["modificare la superficie risultante mediante layer ambientali e di"]], [6, ["uso del suolo"]], [7, ["piattaforma modulare ed estensibile"]],
  [13, ["strumento di prioritizzazione spaziale per la ricerca di anchor point"]], [14, ["(come la residenza) di criminali seriale"]], [18, ["non rappresenta una probabilità di colpevolezza"]], [27, ["anchor point noto"]],
  [35, ["scheda Input"]], [37, ["anchor point noto"]], [41, ["scheda Parametri"]], [44, ["scheda Layers"]], [47, ["Esegui analisi"]], [49, ["scheda Output"]],
  [60, ["CRS di input"]], [62, ["EPSG:4326 — WGS 84"]], [74, ["facoltativo"]], [84, ["Importante:"]],
  [98, ["NumPy"]], [100, ["Python loop"]], [106, ["CRS di input"]], [107, ["CRS di analisi"]], [111, ["CRS proiettato appropriato alla regione di studio e con unità metriche"]],
  [121, ["HubDist"]], [125, ["HubDist > μ + kₒᵤₜ × σ"]], [128, ["μ"]], [129, ["σ"]], [130, ["kₒᵤₜ"]], [131, ["2σ"]],
  [136, ["non implica che il punto"]], [137, ["debba essere rimosso"]], [151, ["La rimozione degli outlier non deve quindi essere interpretata come una procedura"]], [152, ["che migliora automaticamente l’accuratezza di Rossmo"]],
  [162, ["Scenario A — tutti gli eventi"]], [164, ["Scenario B — outlier rimossi"]], [167, ["parameter/data sensitivity"]], [177, ["B = Auto"]], [179, ["reticolo personalizzato"]], [192, ["scelta analitica"]],
  [202, ["Criminal Geographic Targeting (CGT)"]], [205, ["distance decay"]], [208, ["buffer zone"]], [212, ["f", "g", "B", "K"]], [215, ["f"]], [221, ["g"]], [226, ["f = 1.2"]], [227, ["g = 1.2"]],
  [235, ["Per un’analisi standard, f = g = 1.2 costituisce quindi il punto di partenza"]], [236, ["raccomandato; per analisi di ricerca, è preferibile verificare la stabilità del risultato"]], [237, ["rispetto a configurazioni alternative."]],
  [243, ["B"]], [244, ["B = Auto"]], [246, ["B = ½ × mean nearest-neighbour distance"]], [261, ["K"]], [270, ["0–100"]], [274, ["non che esista una probabilità dell’80% che l’anchor si trovi in"]], [275, ["quella cella"]],
  [283, ["concentrazione della distribuzione dei CGT score"]], [288, ["Un Gini elevato non significa automaticamente che il geoprofilo sia più accurato"]], [290, ["concentrazione"]],
  [303, ["Enhanced Score = Baseline CGT Score × spatial weight(s)"]], [306, ["accumularsi"]], [312, ["spatial modifiers"]], [327, ["0–220 m"]], [328, ["220–350 m"]], [329, [">350 m"]], [332, ["non devono essere interpretate come classificazioni geomorfologiche"]], [333, ["universali"]],
  [347, ["inclusion layer", "exclusion layer"]], [365, ["pesi"]], [366, ["intermedi"]], [367, ["0"]], [383, ["Sfoglia cartella"]], [385, ["Sfoglia file multipli"]],
  [393, ["Baseline"]], [396, ["Enhanced"]], [408, ["Hit Score %"]], [412, ["Hit Score %"]], [415, ["Search Area"]], [421, ["Search Area"]], [426, ["Search Area"]], [432, ["Guess Distance"]], [437, ["indicatore descrittivo"]], [438, ["complementare"]],
  [451, ["non"]], [452, ["costituisce da sola evidenza di maggiore accuratezza"]], [467, ["CSV"]], [469, ["GeoJSON"]], [477, ["21 fasce di priorità"]], [481, ["ranking relativo della superficie"]], [492, ["visualizzazione della superficie"]],
  [500, ["Rank"]], [501, ["Rank"]], [502, ["1 = fascia più calda / priorità maggiore"]], [503, ["21 = fascia più fredda / priorità minore"]], [509, ["Actual"]], [517, ["Priority %"]], [518, ["Priority %"]], [519, ["100% = fascia più prioritaria"]], [521, ["0% = fascia meno prioritaria"]], [525, ["Priority % non è una probabilità di localizzazione dell’anchor"]],
  [530, ["Hit Score %"]], [531, ["Hit Score %"]], [541, ["Z-Score"]], [542, ["Z-Score"]], [548, ["Non deve essere interpretato come test statistico, livello di significatività o"]], [549, ["probabilità."]], [556, ["Contorni heatmap"]], [557, ["Contorni heatmap"]], [567, ["non costituisce una"]], [568, ["raccomandazione metodologica a utilizzare EPSG:4326 come CRS di analisi"]],
  [574, ["prioritizzare aree"]], [586, ["dataset utilizzato; CRS; AOI; grid specification; trattamento degli outlier; f; g; B; K;"]], [587, ["layer utilizzati; pesi; impostazioni di normalizzazione; versione di MIDNA."]], [595, ["Criminal Geographic"]], [596, ["Targeting"]],
]);

const englishHighlights = [
  "Criminal Geographic Targeting (CGT)", "modify the resulting surface with environmental and land-use layers", "gradual integration",
  "spatial-prioritisation tool for searching for anchor points (such as a residence) of serial offenders", "not a probability of guilt", "known anchor point",
  "Input tab", "known anchor", "Parameters", "Layers", "Run analysis", "Output",
  "input CRS", "EPSG:4326 — WGS 84", "NumPy", "Python loop", "analysis CRS", "appropriate projected CRS in metric units",
  "HubDist", "HubDist > μ + kₒᵤₜ × σ", "μ", "σ", "kₒᵤₜ", "2σ", "not necessarily an error", "does not automatically improve accuracy", "Scenario A (all events)", "Scenario B (outliers removed)", "parameter/data sensitivity", "automatic B", "custom grid", "analytical choice",
  "Criminal Geographic Targeting framework", "distance decay", "buffer zone", "f = 1.2 and g = 1.2", "B = Auto", "B = ½ × mean nearest-neighbour distance", "multiplicative", "0–100", "does not make scores probabilities", "CGT-score concentration", "not necessarily a more accurate one",
  "Enhanced Score = Baseline CGT Score × spatial weight(s)", "multiply", "spatial modifiers", "0–220 m", "220–350 m", ">350 m", "are not universal", "Inclusion and exclusion", "Intermediate weights", "Zero truly excludes", "Shapefile", "Select the full folder", "multiple files",
  "Baseline", "Enhanced", "Hit Score %", "Search Area", "Guess Distance", "complementary, not a complete summary", "not a complete summary", "not a 40% probability", "CSV", "GeoJSON",
  "21 bands", "relative ranking, not probability", "visual only", "Rank", "1 hottest, 21 coldest", "Actual", "Priority %", "100%–0%", "none is a probability", "Z-Score", "descriptive, not a test, significance level, or probability", "Heatmap contours", "rendering constraint", "prioritises areas", "dataset, CRS, AOI, grid, outlier treatment, f, g, B, K, layers, weights, normalisation, and MIDNA version",
].sort((a, b) => b.length - a.length);

const englishHighlightExpression = new RegExp(`(${englishHighlights.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");

function highlightEnglish(text: string) {
  return text.split(englishHighlightExpression).map((part, index) => englishHighlights.includes(part) ? <strong key={index}>{part}</strong> : part);
}

function ItalianGuide() {
  return (
    <Card className="gap-0 text-sm leading-relaxed text-foreground">
      {guideIt.split("\n").map((line, index, lines) => {
        if (index === 0) return <h1 key={index} className="text-[22px] font-bold leading-tight text-accent">{line}</h1>;
        if (line === "Mapping Interface for Detection, Narrowing and Analysis") return <p key={index} className="mt-2 font-bold leading-tight text-accent">{line}</p>;
        if (italianSectionTitles.has(line)) return <h2 key={index} className={`text-[18px] font-bold leading-tight ${italianSeparatedHeadings.has(line) ? "mt-6 border-t border-border pt-6" : "mt-6"}`}>{line}</h2>;
        if (italianLabels.has(line)) return <h3 key={index} className={`text-base font-bold leading-tight ${italianSeparatedHeadings.has(line) ? "mt-6 border-t border-border pt-6" : "mt-4"}`}>{line}</h3>;
        if (!line) return lines[index - 1] ? <div key={index} className="h-3" /> : null;
        const highlights = italianHighlights.get(index);
        if (!highlights) return <div key={index} className="whitespace-pre-wrap">{line}</div>;
        const expression = new RegExp(`(${highlights.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
        return <div key={index} className="whitespace-pre-wrap">{line.split(expression).map((part, partIndex) => highlights.includes(part) ? <strong key={partIndex}>{part}</strong> : part)}</div>;
      })}
    </Card>
  );
}

const guides: Record<"it" | "en", Guide> = {
  it: {
    title: "MIDNA — Guida metodologica e operativa",
    subtitle: "Mapping Interface for Detection, Narrowing and Analysis",
    intro: [
      "MIDNA (Mapping Interface for Detection, Narrowing and Analysis) è uno strumento di geographic profiling che implementa una versione grid-based del Criminal Geographic Targeting (CGT) di Rossmo (Rossmo, 2000, 2025). Può modificare facoltativamente la superficie risultante mediante layer ambientali e di uso del suolo, secondo l’approccio di Russo et al. (2026).",
      "La piattaforma è pensata per integrare progressivamente ulteriori metodi di geographic profiling, funzioni di analisi spaziale e strumenti analitici. Tutti i calcoli avvengono localmente nel browser: i file caricati non sono inviati a un server durante l’analisi.",
    ],
    sections: [
      { title: "Scopo e limiti", body: [
        "MIDNA è uno strumento di prioritizzazione spaziale per cercare anchor point (per esempio una residenza) di criminali seriali, non un sistema per identificare un individuo. Dalla distribuzione dei crimini assegna alle celle dell’area di studio un punteggio relativo: le celle più alte sono più coerenti con il pattern spaziale osservato.",
        "Un’area ad alta priorità non è una probabilità di colpevolezza; un’area a bassa priorità non esclude un luogo o una persona. Il geoprofilo va interpretato con tutte le altre informazioni investigative. Il modello presuppone una serie sufficientemente coerente e uno o più anchor point relativamente stabili. Serie molto brevi, errori di linkage, comportamento commuter, cambi di residenza o activity space, target backcloth disomogeneo e crime locations non indipendenti possono ridurre stabilità e interpretabilità (Rossmo, 2000).",
        "L’anchor point noto, quando disponibile, serve esclusivamente alla valutazione retrospettiva: non entra nel calcolo della superficie e non è necessario per generare un geoprofilo.",
      ] },
      { title: "Come iniziare", body: [], steps: [
        "Nella scheda Input carica il CSV delle crime locations e indica le colonne di latitudine e longitudine.",
        "Facoltativamente carica un anchor point noto da file o inseriscilo manualmente: serve solo per valutare il risultato e non modifica la superficie.",
        "Nella scheda Parametri configura motore di calcolo, CRS, trattamento degli outlier, risoluzione della griglia e parametri CGT.",
        "Facoltativamente aggiungi DEM o layer poligonali di inclusione/esclusione nella scheda Layers, per applicare pesi spaziali alla superficie baseline.",
        "Premi Esegui analisi e monitora l’avanzamento nella barra di stato.",
        "Nella scheda Output esamina la superficie e, se è disponibile un anchor noto, le metriche di valutazione. Il ranking completo è esportabile in CSV o GeoJSON.",
      ] },
      { title: "Scheda Input", body: [
        "Il CSV deve contenere almeno due colonne con le coordinate delle crime locations. Le coordinate devono essere coerenti con il CRS di input. Per latitudine e longitudine in gradi decimali, il CRS più comune è EPSG:4326 — WGS 84.",
        "La qualità del geoprofilo dipende dalla qualità del linkage e dalla rilevanza spaziale dei punti (Rossmo, 2000). MIDNA non verifica se le location appartengano allo stesso offender o siano investigativeamente equivalenti: questa valutazione rimane responsabilità dell’analista.",
        "L’anchor è facoltativo e può essere caricato da CSV o GeoJSON oppure inserito manualmente. Se un file contiene più geometrie, viene usata solo la prima valida. Serve per Hit Score %, Search Area e Guess Distance, non per la superficie baseline o enhanced; non è quindi richiesto per un caso non risolto.",
        "Puoi caricare un reticolo personalizzato invece della griglia regolare automatica: MIDNA usa allora la geometria fornita come unità di calcolo.",
      ] },
      { title: "Scheda Parametri", body: [
        "NumPy è il motore raccomandato: usa operazioni vettorializzate e riduce sensibilmente il tempo di calcolo, soprattutto con griglie grandi. Python loop è l’implementazione di riferimento, più lenta, usata in Russo et al. (2026) per verificare la coerenza del risultato.",
        "Il CRS di input descrive le coordinate dei file; il CRS di analisi è usato per operazioni spaziali e distanze. Per dati in latitudine/longitudine è comune EPSG:4326 come input. Per analisi locali o regionali con distanze planari è generalmente preferibile un CRS proiettato, appropriato all’area e con unità metriche. La scelta non è solo grafica e va mantenuta costante nei confronti tra analisi.",
        "HubDist identifica facoltativamente location periferiche. Per ogni punto viene calcolata la distanza dal mean center; è outlier quando HubDist > μ + kₒᵤₜ × σ, dove μ è la media delle HubDist, σ la deviazione standard e kₒᵤₜ il moltiplicatore impostato. Il valore 2σ segue Russo et al. (2026) e un criterio statistico convenzionale (Ebdon, 1985).",
        "Un outlier non è necessariamente un errore: può rappresentare linkage o geocoding errati, evento non indipendente, comportamento eccezionale, viaggio lungo, cambio di activity space, anchor secondario o informazione reale. La rimozione non migliora automaticamente l’accuratezza: può concentrare il profilo sul core spatial pattern, ma anche eliminare informazione e peggiorare la localizzazione dell’anchor. Quando plausibile, confronta Scenario A (tutti gli eventi) e Scenario B (outlier rimossi); differenze sostanziali indicano parameter/data sensitivity.",
        "Con griglia automatica, i punti rimossi sono esclusi da AOI, costruzione della griglia, formula di Rossmo e B automatico. Con reticolo personalizzato, non partecipano a CGT e B automatico ma non ne cambiano l’estensione.",
        "Una griglia più fine dà più dettaglio ma costa più tempo; una più grossolana è più rapida ma può nascondere variazioni locali. La risoluzione è una scelta analitica: mantieni AOI, CRS e griglia costanti nel confronto tra scenari. La griglia automatica è disabilitata con un reticolo personalizzato.",
      ] },
      { title: "Formula di Rossmo, normalizzazione e Gini", body: [
        "Il CGT combina distance decay — la compatibilità con l’anchor diminuisce con la distanza dalle crime locations — e buffer zone, che de-prioritizza l’area immediatamente vicina ai crime sites. f controlla il decadimento esterno e g la forma della funzione interna alla buffer zone: valori più elevati concentrano generalmente la superficie. MIDNA usa f = 1.2 e g = 1.2, dalla formulazione di Rossmo (1995), come punto di partenza raccomandato. Per ricerca, esplora alternative come sensitivity analysis e riportale con trasparenza.",
        "B è il raggio della buffer zone. Con B = Auto, MIDNA usa metà della mean nearest-neighbour distance: B = ½ × mean nearest-neighbour distance; con outlier rimossi, usa solo i punti mantenuti. Un B manuale necessita una giustificazione e va documentato. K è una costante moltiplicativa: scala i valori ma non cambia l’ordinamento relativo.",
        "La normalizzazione 0–100 facilita visualizzazione e confronto interno alla singola superficie, non trasforma lo score in probabilità. Il Gini misura la concentrazione dei CGT score: valori elevati indicano una superficie più concentrata, non necessariamente più accurata. La curva di Lorenz la visualizza.",
      ] },
      { title: "Scheda Layers", body: [
        "I layer realizzano l’estensione ambientale del CGT di Russo et al. (2026). Non sostituiscono Rossmo: il baseline viene calcolato prima e poi modificato con pesi spaziali. Enhanced Score = Baseline CGT Score × spatial weight(s). I pesi che interessano la stessa cella si combinano moltiplicativamente: 0,8 e 0,5 danno 0,4, non una probabilità del 40%.",
        "I layer sono spatial modifiers fondati su informazioni ambientali, territoriali o di land use pertinenti all’ipotesi di anchor. I pesi non sono coefficienti universali: vanno giustificati teoricamente o empiricamente nello scenario analitico.",
        "Il DEM assegna pesi dall’elevazione media della cella: pianura 0–220 m, collina 220–350 m, montagna >350 m e celle senza dato. Le soglie provengono dal proof-of-method di Russo et al. (2026), non sono universali e vanno rivalutate in base a topografia, distribuzione residenziale e ipotesi investigativa. Il costo cresce con il numero di celle: una griglia 200 × 200 può rendere il DEM sensibilmente più lento dei layer vettoriali.",
        "Inclusion ed exclusion descrivono un ruolo concettuale, non una scelta necessariamente binaria. Un layer di esclusione può ridurre senza azzerare lo score; uno di inclusione può aumentarlo senza essere prova definitiva. Con land use misto sono preferibili pesi intermedi. Uno zero esclude davvero la cella dalla superficie enhanced e va usato solo quando l’incompatibilità è giustificata.",
        "Per uno Shapefile non basta il .shp: servono almeno .shp, .shx e .dbf, più .prj quando disponibile. Seleziona la cartella completa oppure i file multipli. Ogni layer può essere disabilitato temporaneamente per confrontare scenari alternativi.",
      ] },
      { title: "Scheda Output", body: [
        "MIDNA restituisce sempre Baseline, basato sul solo CGT, e restituisce Enhanced quando applichi uno o più spatial layer. Senza anchor sono comunque disponibili superficie e ranking, ma non le metriche che richiedono ground truth.",
        "Hit Score % è la quota cumulativa di celle con score pari o superiore alla cella dell’anchor noto: più è basso, più la posizione nota è in alto nel ranking. Con celle regolari di uguale area equivale anche alla quota proporzionale di area da cercare; con reticoli personalizzati a celle diverse usa Search Area.",
        "Search Area è l’area in km² delle celle con score almeno pari a quello dell’anchor; più è bassa, maggiore è l’efficienza retrospettiva. Guess Distance è la distanza tra il punto rappresentativo della cella con score massimo e l’anchor: è complementare, non una sintesi completa. Valuta insieme Hit Score %, Search Area, Guess Distance, Gini, stabilità rispetto a parametri e preprocessing e plausibilità teorica dei layer.",
        "Il ranking si esporta dalla barra superiore in CSV, con eventuali sidecar .csvt e .prj, oppure GeoJSON, per analisi GIS esterne e documentazione riproducibile.",
      ] },
      { title: "Legenda, contorni e interpretazione responsabile", body: [
        "La superficie usa 21 fasce dalla più calda e prioritaria alla più fredda. Il colore rappresenta ranking relativo, non probabilità. La scala cromatica si adatta ai CGT score della singola analisi: è quasi lineare con distribuzioni uniformi e diventa progressivamente log-like quando pochi valori dominano. È una trasformazione solo visiva: non cambia score né ranking. Legenda, heatmap e contorni condividono la classificazione.",
        "Rank indica la posizione della fascia (1 più calda, 21 più fredda), Actual la sua soglia CGT e Priority % la normalizzazione relativa della soglia fra 100% e 0% nella singola run: nessuno è una probabilità. Hit Score % nella legenda è la quota cumulativa di celle alla soglia o oltre. Z-Score indica la distanza della soglia dalla media in deviazioni standard: è descrittivo, non un test, significatività o probabilità.",
        "Contorni heatmap sostituisce le celle con linee smussate simili a isolinee e non modifica score, ranking o metriche. È disponibile solo con griglia automatica e CRS di analisi esattamente EPSG:4326; la limitazione riguarda il rendering, non è una raccomandazione metodologica sul CRS.",
        "MIDNA prioritizza aree, non attribuisce responsabilità individuale. Non determina chi ha commesso un reato, se un indirizzo appartiene all’offender, se una persona sia escludibile per un’area a bassa priorità o quale scenario sia la “vera” distribuzione. Documenta gli effetti di outlier, B, f, g, CRS, AOI, risoluzione e pesi; per ricerca registra dataset, CRS, AOI, griglia, outlier, f, g, B, K, layer, pesi, normalizzazione e versione di MIDNA.",
      ] },
      { title: "Base metodologica e bibliografia", body: ["La baseline si basa sul Criminal Geographic Targeting di Rossmo. L’integrazione moltiplicativa di informazioni ambientali e land use segue Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026), “Enhancing Rossmo’s criminal geographic targeting model through environmental and land-use spatial layers: a case study of the Atlanta homicides (1979–1981)”, Crime Science, 15, Article 18. MIDNA è un’implementazione indipendente e non una versione del software commerciale RIGEL.", "Ebdon, D. (1985). Statistics in Geography (2nd ed.). Blackwell. Paulsen, D. J. (2006). Human versus machine: A comparison of the accuracy of geographic profiling methods. Journal of Investigative Psychology and Offender Profiling, 3(2), 77–89. https://doi.org/10.1002/jip.46. Rossmo, D. K. (1995). Geographic Profiling: Target Patterns of Serial Murderers [Doctoral dissertation, Simon Fraser University]. Rossmo, D. K. (2000). Geographic Profiling. CRC Press. Rossmo, D. K. (2025). Geographic Profiling (2nd ed.). Routledge. Russo et al. (2026). https://doi.org/10.1186/s40163-026-00278-w."] },
    ],
  },
  en: {
    title: "MIDNA — Methodological and operational guide",
    subtitle: "Mapping Interface for Detection, Narrowing and Analysis",
    intro: ["MIDNA (Mapping Interface for Detection, Narrowing and Analysis) is a geographic-profiling tool implementing a grid-based version of Rossmo’s Criminal Geographic Targeting (CGT) model (Rossmo, 2000, 2025). It can optionally modify the resulting surface with environmental and land-use layers, following Russo et al. (2026).", "The platform is designed for the gradual integration of further geographic-profiling methods, spatial-analysis functions, and analytical tools. All computation takes place locally in the browser: files uploaded by the user are not sent to a server as part of the analysis."],
    sections: [
      { title: "Purpose and limitations", body: ["MIDNA is a spatial-prioritisation tool for searching for anchor points (such as a residence) of serial offenders, not a system for identifying an individual. It gives study-area cells a relative score from the crime distribution: higher-scoring cells are more consistent with the observed spatial pattern.", "A high-priority area is not a probability of guilt, and a low-priority area does not exclude a location or person. A geographic profile must be interpreted with all other investigative information. The model generally assumes a coherent event series and one or more relatively stable anchor points. Very short series, linkage errors, commuter behaviour, changes in residence or activity space, an uneven target backcloth, and non-independent crime locations can reduce stability or interpretability (Rossmo, 2000).", "Where available, a known anchor point is used solely for retrospective evaluation. It is not part of surface calculation and is not needed to generate a geographic profile."] },
      { title: "Getting started", body: [], steps: ["In the Input tab, upload the crime-locations CSV and specify latitude and longitude columns.", "Optionally upload a known anchor from a file or enter it manually; it evaluates the result only and does not alter the surface.", "In Parameters, set the engine, CRS, optional outlier treatment, grid resolution, and CGT parameters.", "Optionally add a DEM or polygon inclusion/exclusion layers in Layers to apply spatial weights to the baseline surface.", "Select Run analysis and monitor the status bar.", "In Output, examine the surface and, where a known anchor is available, evaluation metrics. Export the complete ranking as CSV or GeoJSON."] },
      { title: "Input tab", body: ["The CSV must contain at least two columns with crime-location coordinates. Coordinates must match the input CRS; for decimal-degree latitude and longitude, EPSG:4326 — WGS 84 is most common.", "Geographic-profile quality depends on linkage quality and the spatial relevance of included points (Rossmo, 2000). MIDNA does not determine whether locations belong to the same offender or are investigatively equivalent: that judgement remains the analyst’s responsibility.", "An anchor is optional and can be loaded from CSV or GeoJSON, or entered manually. If a file has several geometries, only its first valid geometry is used. It supports Hit Score %, Search Area, and Guess Distance, not baseline or enhanced surface creation, so it is not required for an unsolved case.", "You may upload a custom grid instead of the automatic regular grid. MIDNA will use the supplied geometry as its calculation units."] },
      { title: "Parameters tab", body: ["NumPy is the recommended engine: vectorised operations substantially reduce calculation time, especially on large grids. Python loop is the slower reference implementation used in Russo et al. (2026), useful for checking consistency.", "The input CRS describes file coordinates; the analysis CRS is used for spatial operations and distances. EPSG:4326 is common for latitude/longitude input. For local or regional work with planar distances, an appropriate projected CRS in metric units is generally preferable. CRS choice is not merely visual and should remain fixed in comparisons.", "HubDist optionally identifies peripheral locations. Each point’s distance from the series mean centre is calculated; it is an outlier when HubDist > μ + kₒᵤₜ × σ, where μ is mean HubDist, σ its standard deviation, and kₒᵤₜ the selected multiplier. The 2σ value follows Russo et al. (2026) and a conventional statistical criterion (Ebdon, 1985).", "An outlier is not necessarily an error: it can reflect bad linkage/geocoding, a non-independent event, exceptional behaviour, a long journey, activity-space change, a secondary anchor, or real information. Removal does not automatically improve accuracy: it may focus the profile on a core pattern but may also remove information and worsen localisation. Where plausible, compare Scenario A (all events) and Scenario B (outliers removed); substantial differences indicate parameter/data sensitivity.", "With an automatic grid, removed points are excluded from AOI, grid construction, the Rossmo formula, and automatic B. With a custom grid they do not enter CGT or automatic B but do not change its extent. A finer grid gives more detail but costs more time; a coarser grid is faster but can hide local variation. Keep AOI, CRS, and grid constant when comparing scenarios. Automatic grid controls are disabled with a custom grid."] },
      { title: "Rossmo formula, normalisation, and Gini", body: ["CGT combines distance decay — anchor compatibility diminishes with distance from crime locations — and a buffer zone that de-prioritises the area immediately around crime sites. f controls outside decay and g the curve inside the buffer zone; higher values generally concentrate the surface. MIDNA uses f = 1.2 and g = 1.2, from Rossmo (1995), as the recommended starting point. For research, explore alternatives as sensitivity analysis and report them transparently.", "B is the buffer-zone radius. With B = Auto, MIDNA uses half the mean nearest-neighbour distance: B = ½ × mean nearest-neighbour distance; with outliers removed, it uses retained locations only. A manual B requires justification and should be documented. K is multiplicative: it scales values without changing their relative order.", "Normalisation to 0–100 supports visualisation and within-surface comparison; it does not make scores probabilities. Gini measures CGT-score concentration: high values mean a more concentrated surface, not necessarily a more accurate one. The Lorenz curve visualises it."] },
      { title: "Layers tab", body: ["Layers implement the environmental CGT extension in Russo et al. (2026). They do not replace Rossmo: the baseline is calculated first and then modified by spatial weights. Enhanced Score = Baseline CGT Score × spatial weight(s). Weights affecting one cell multiply: 0.8 and 0.5 produce 0.4, not a 40% probability.", "Layers are spatial modifiers based on environmental, territorial, or land-use information relevant to the anchor hypothesis. Their weights are not universal coefficients and must be theoretically or empirically justified in the analytical scenario.", "The DEM weights cells by mean elevation: lowland 0–220 m, hillside 220–350 m, mountain >350 m, and no-data cells. Thresholds come from the Russo et al. (2026) proof of method, are not universal, and should be reassessed for local topography, residential distribution, and the investigative hypothesis. Raster work grows with cell count: on a 200 × 200 grid, a DEM can take substantially longer than vector layers.", "Inclusion and exclusion are conceptual roles, not necessarily binary choices. An exclusion layer can reduce rather than zero a score; inclusion can raise it without being definitive evidence. Intermediate weights are preferable for mixed land use. Zero truly excludes a cell from the enhanced surface and should be used only when incompatibility is justified.", "A Shapefile needs more than .shp: at least .shp, .shx, and .dbf, plus .prj where available. Select the full folder or multiple files. Each layer can be temporarily disabled to compare alternative scenarios."] },
      { title: "Output tab", body: ["MIDNA always returns Baseline, based on CGT alone, and returns Enhanced when one or more spatial layers are applied. Without an anchor, the surface and ranking are still available, but metrics requiring ground truth are not.", "Hit Score % is the cumulative share of cells scoring at least as high as the known anchor’s cell: lower is better ranked. In a regular grid of equal-area cells it is also the proportional search area; use Search Area with unequal custom-grid cells.", "Search Area is the km² total of cells scoring at least as high as the anchor; lower is more retrospectively efficient. Guess Distance is the distance from the top-scoring cell’s representative point to the anchor. It is complementary, not a complete summary. Consider Hit Score %, Search Area, Guess Distance, Gini, stability under parameter/preprocessing changes, and theoretical layer plausibility together.", "Export the ranking from the top bar as CSV, with possible .csvt and .prj sidecars, or GeoJSON for external GIS analysis and reproducible documentation."] },
      { title: "Legend, contours, and responsible interpretation", body: ["The surface uses 21 bands, from hottest/highest priority to coldest. Colour is relative ranking, not probability. The scale adapts to scores from each analysis: near-linear for uniform distributions and progressively log-like when a few values dominate. It is visual only and does not change scores or ranking. Legend, heatmap, and contours share the classification.", "Rank is the band position (1 hottest, 21 coldest), Actual its CGT threshold, and Priority % the relative 100%–0% threshold normalisation in that run: none is a probability. Legend Hit Score % is the cumulative share of cells at or above the band threshold. Z-Score is the threshold’s distance from the mean in standard deviations: descriptive, not a test, significance level, or probability.", "Heatmap contours replace cells with smooth contour-like lines and do not alter scores, ranking, or metrics. They are available only with an automatic grid and analysis CRS exactly EPSG:4326; this is a rendering constraint, not a methodological CRS recommendation.", "MIDNA prioritises areas; it does not assign individual responsibility. It does not determine who committed an offence, whether an address belongs to an offender, whether someone can be excluded for low priority, or which scenario is the “true” distribution. Document effects from outliers, B, f, g, CRS, AOI, resolution, and weights. For research record dataset, CRS, AOI, grid, outlier treatment, f, g, B, K, layers, weights, normalisation, and MIDNA version."] },
      { title: "Methodological basis and references", body: ["The baseline follows Rossmo’s Criminal Geographic Targeting framework. Multiplicative integration of environmental and land-use information follows Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026), “Enhancing Rossmo’s criminal geographic targeting model through environmental and land-use spatial layers: a case study of the Atlanta homicides (1979–1981)”, Crime Science, 15, Article 18. MIDNA is an independent implementation, not a version of commercial RIGEL software.", "Ebdon, D. (1985). Statistics in Geography (2nd ed.). Blackwell. Paulsen, D. J. (2006). Human versus machine: A comparison of the accuracy of geographic profiling methods. Journal of Investigative Psychology and Offender Profiling, 3(2), 77–89. https://doi.org/10.1002/jip.46. Rossmo, D. K. (1995). Geographic Profiling: Target Patterns of Serial Murderers [Doctoral dissertation, Simon Fraser University]. Rossmo, D. K. (2000). Geographic Profiling. CRC Press. Rossmo, D. K. (2025). Geographic Profiling (2nd ed.). Routledge. Russo et al. (2026). https://doi.org/10.1186/s40163-026-00278-w."] },
    ],
  },
};

export function HelpTab() {
  const lang = useAppStore((state) => state.lang);
  if (lang === "it") {
    return <ItalianGuide />;
  }
  const guide = guides[lang];
  return (
    <Card className="gap-0 text-sm leading-relaxed text-foreground">
      <header className="mb-5">
        <h2 className="text-[22px] font-bold leading-tight text-accent">{guide.title}</h2>
        <p className="mt-2 font-bold leading-tight text-accent">{guide.subtitle}</p>
        <div className="mt-4 space-y-3">{guide.intro.map((text) => <p key={text}>{highlightEnglish(text)}</p>)}</div>
      </header>
      {guide.sections.map((section, index) => (
        <section key={section.title} className={`space-y-3 ${index ? "mt-6 border-t border-border pt-6" : "pt-1"}`}>
          <h3 className="text-[18px] font-bold leading-tight">{section.title}</h3>
          <div className="space-y-3">{section.body.map((text) => <p key={text}>{highlightEnglish(text)}</p>)}</div>
          {section.steps && <ol className="list-decimal space-y-3 pl-8">{section.steps.map((text) => <li key={text} className="pl-2">{highlightEnglish(text)}</li>)}</ol>}
        </section>
      ))}
    </Card>
  );
}
