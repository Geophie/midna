import { useAppStore, type Lang } from "@/lib/store";

type Vars = Record<string, string | number>;

/**
 * Same shape as rossmo_toolkit's gui/i18n.py (STRINGS[lang][key] + t(key, lang)
 * with fallback to Italian then to the raw key) — ported so future keys stay
 * easy to cross-reference against the desktop tool's translations. Key names
 * are reused verbatim from gui/i18n.py wherever the desktop tool has an
 * equivalent string; new keys are added for web-only concepts (map controls,
 * score threshold, layout, etc.).
 */
export const STRINGS: Record<Lang, Record<string, string>> = {
  it: {
    // Chrome (navbar)
    app_subtitle: "Mapping Interface for Detection, Narrowing and Analysis",
    map_toggle_label: "Mappa",
    tab_input: "Input",
    tab_params: "Parametri",
    tab_layers: "Layers",
    tab_output: "Output",
    tab_help: "Guida",
    theme_toggle_aria: "Cambia tema chiaro/scuro",
    theme_toggle_title: "Cambia tema",
    lang_toggle_aria_to_en: "Cambia lingua in inglese",
    lang_toggle_aria_to_it: "Cambia lingua in italiano",
    lang_toggle_title: "Cambia lingua",

    // Input tab
    input_crimes_card_title: "Dati reato",
    input_anchor_card_title: "Anchor point (opzionale)",
    input_grid_card_title: "Reticolo personalizzato (opzionale)",

    upload_csv_label: "CSV reati",
    upload_loaded: "{name} caricato ({rows} righe).",

    anchor_desc:
      "La posizione reale dell'autore, usata solo per valutare il modello (hit score, area di ricerca) — non influenza il calcolo.",
    anchor_mode_manual: "Manuale (lat/lon)",
    anchor_mode_file: "Da file",
    anchor_file_label: "File anchor (CSV o GeoJSON — stesse colonne lat/lon del CSV reati)",
    anchor_lat_label: "Latitudine anchor",
    anchor_lon_label: "Longitudine anchor",
    lat_out_of_range: "Latitudine fuori intervallo (-90, 90).",
    lon_out_of_range: "Longitudine fuori intervallo (-180, 180).",

    grid_file_desc:
      "Sostituisce il reticolo automatico. Quando presente, i campi Celle X/Y nella scheda Parametri vengono disabilitati.",
    grid_file_label: "File reticolo (GeoJSON, geometrie poligonali)",

    btn_remove: "Rimuovi",
    btn_choose_file: "Scegli file",
    no_file_selected: "Nessun file selezionato",
    gpkg_warning_csv_geojson:
      "GeoPackage (.gpkg) non è affidabile in questo prototipo (vedi Help) — usa CSV o GeoJSON.",
    gpkg_warning_geojson:
      "GeoPackage (.gpkg) non è affidabile in questo prototipo (vedi Help) — usa GeoJSON.",

    // Errors (shared across the whole app — worker/validation error codes)
    error_file_empty: "Il file è vuoto.",
    error_csv_columns: "Colonne latitudine/longitudine non trovate nell'header.",
    error_col_invalid_values: "Valori non numerici o mancanti in latitudine/longitudine.",
    error_col_not_numeric: "La colonna deve contenere valori numerici.",
    error_too_few_crimes: "Servono almeno 2 punti reato.",
    error_crimes_identical: "Tutti i punti reato coincidono: servono posizioni distinte.",
    error_no_valid_geometries: "Il file non contiene geometrie valide.",
    error_no_crs: "Il file non ha un sistema di riferimento (CRS) definito.",
    error_file_no_geometries: "Il file non contiene geometrie.",
    error_anchor_empty: "Il file dell'anchor point non contiene geometrie.",
    error_grid_not_polygon: "Il reticolo personalizzato deve contenere geometrie poligonali.",
    error_invalid_crs: "CRS non valido o non riconosciuto.",
    error_grid_cells_positive: "Il numero di celle deve essere positivo.",
    error_rossmo_params: "Parametri della formula di Rossmo non validi (f, g, k o B).",
    error_hub_dist_threshold: "La soglia outlier deve essere positiva.",

    // Parametri tab
    param_engine_label: "Motore di calcolo",
    engine_numpy: "Numpy (vettoriale, consigliato)",
    engine_loop: "Loop (riferimento, più lento)",
    engine_loop_warning: "Motore di riferimento, molto più lento su griglie grandi.",
    lat_col: "Colonna latitudine",
    lon_col: "Colonna longitudine",
    crs_input: "CRS del CSV di input (coordinate sorgente)",
    crs_output: "CRS di analisi (output)",
    param_cells_x: "Celle X",
    param_cells_y: "Celle Y",
    cells_from_custom_grid_suffix: "(da reticolo personalizzato)",
    param_f: "f (decadimento fuori buffer)",
    param_g: "g (decadimento dentro buffer)",
    param_k: "k (costante normalizzazione)",
    b_auto_label: "B automatico",
    b_manual_label: "B (manuale)",
    outlier_removal: "Rimozione outlier spaziali",
    contouring_label: "Contorni heatmap",
    outlier_threshold_label: "Soglia outlier (k in μ+k·σ)",
    normalize: "Normalizza score [0–100]",
    calc_gini: "Calcola coefficiente di Gini",

    // Layers tab
    add_layer_label: "Aggiungi layer:",
    layer_type_dem: "DEM",
    layer_type_inclusion: "Inclusione",
    layer_type_exclusion: "Esclusione",
    warning_single_dem: "È ammesso un solo layer DEM.",
    no_layers_message:
      "Nessun layer aggiunto. Il modello enhanced è opzionale: senza layer, il risultato coincide col modello baseline.",
    layer_dem_label: "DEM (elevazione)",
    layer_name_label: "Nome layer",
    dem_file_label: "File (GeoTIFF / HGT)",
    vector_mode_geojson: "GeoJSON",
    vector_mode_folder: "Shapefile — cartella",
    vector_mode_multi: "Shapefile — file multipli",
    vector_file_desc:
      "Un layer richiede un file GeoJSON, oppure uno Shapefile — ma un file .shp da solo non basta: servono anche i suoi file collegati (.shx, .dbf), e il browser non può cercarli da solo sul disco. Scegli come vuoi fornirlo:",
    vector_file_type_label: "Tipo di file",
    vector_files_loaded: "File caricati: {names}",
    shapefile_error_no_shp:
      "Nessun file .shp trovato nella selezione. Seleziona lo .shp insieme ai suoi file collegati (.shx, .dbf).",
    shapefile_error_multiple:
      "Trovati {count} shapefile diversi nella selezione — seleziona una cartella o un gruppo di file con un solo .shp.",
    shapefile_error_missing_sidecars:
      'Mancano i file collegati allo shapefile ({missing}) — selezionali insieme allo .shp, oppure usa la modalità "cartella".',
    shapefile_files_ignored: "{count} file ignorati (non fanno parte dello shapefile selezionato).",
    dem_threshold_col_label: "Soglia (min elevazione)",
    weight_col_label: "Peso",
    terrain_flatland: "Pianura",
    terrain_hillside: "Collina",
    terrain_mountain: "Montagna",
    terrain_nodata: "Nodata",
    weight_intersect: "Peso intersezione",
    weight_no_intersect: "Peso non-intersezione",

    // Output tab
    result_grid_info: "Reticolo",
    grid_cells_created: "Celle create dal reticolo: {n}",
    result_baseline: "Risultati — modello baseline",
    result_enhanced: "Risultati — modello enhanced",
    lorenz_charts_title: "Curve di Lorenz",
    lorenz_expand: "Ingrandisci",
    lorenz_collapse: "Riduci",
    lorenz_baseline_title: "Curva di Lorenz — Baseline",
    lorenz_enhanced_title: "Curva di Lorenz — Enhanced",
    lorenz_equality_line: "Uguaglianza perfetta",
    results_table_title: "Risultati",
    log_section: "Log di esecuzione",
    result_hit_score: "Hit score %",
    result_search_area: "Area di ricerca",
    result_gini: "Coefficiente di Gini",
    result_distance: "Distanza home guess",
    error_prefix: "Errore: {label}",
    no_result_yet: "Nessun risultato ancora.",
    results_summary: "{crimes} reati usati {outliersClause}— griglia di {cells} celle, B = {b}.",
    results_outliers_clause: "({removed} outlier rimossi su {total}) ",
    rows_label: "Righe",
    model_baseline_label: "Baseline",
    model_enhanced_label: "Enhanced",
    table_col_rank: "Rank",
    table_col_cell_id: "ID cella",
    table_col_score: "Score",
    table_col_lon: "Lon",
    table_col_lat: "Lat",
    stage_load: "Caricamento dati reato",
    stage_grid: "Costruzione reticolo/AOI",
    stage_rossmo: "Calcolo score Rossmo",
    stage_layers: "Applicazione layer",
    stage_stats: "Statistiche (Gini/normalizzazione)",
    stage_eval: "Valutazione anchor point",
    stage_done: "Completato",
    loading_engine: "Caricamento motore Pyodide...",
    btn_run: "Esegui analisi",
    btn_stop: "Stop",
    btn_export_csv: "Esporta CSV",
    btn_export_baseline_geojson: "Esporta baseline (GeoJSON)",
    btn_export_enhanced_geojson: "Esporta enhanced (GeoJSON)",
    run_cancelled: "Analisi interrotta dall'utente.",

    // Help tab
    help_page_title: "Guida",
    help_intro: "Tutto il calcolo avviene nel browser, tutti i dati rimangono sul tuo computer.",
    help_workflow_title: "Come iniziare",
    help_workflow_1:
      "1. Carica il file CSV dei crimini nella scheda Input, indicando le colonne di latitudine e longitudine.",
    help_workflow_2:
      "2. (Facoltativo) Carica un anchor point — da file (predefinito) o inserito manualmente — solo per confrontare il risultato con la posizione realmente nota: non è necessario per eseguire l'analisi.",
    help_workflow_3:
      "3. Configura i parametri nella scheda Parametri: motore di calcolo, rimozione outlier, dimensione griglia e costanti della formula di Rossmo (f, g, k, B).",
    help_workflow_4:
      "4. (Facoltativo) Aggiungi layer di peso nella scheda Layers — DEM, aree da includere o escludere — per raffinare la superficie di probabilità.",
    help_workflow_5: '5. Premi "Esegui analisi" e segui l\'avanzamento nella barra di stato.',
    help_workflow_6:
      "6. Consulta i risultati (hit score, area di ricerca, Gini, curva di Lorenz) nella scheda Output ed esporta il ranking in CSV o GeoJSON.",
    help_input_title: "Scheda Input",
    help_input_1:
      "Carica il file CSV dei crimini: deve contenere le colonne di latitudine e longitudine. L'anchor point è facoltativo e serve solo, per fini accademici e di ricerca, a confrontare il risultato del modello con una posizione realmente nota (benchmark): NON è necessario per eseguire l'analisi e non influenza il calcolo. Per default l'anchor si carica da file (CSV o GeoJSON, stesse colonne lat/lon del CSV reati — solo la prima geometria del file viene usata); puoi passare all'inserimento manuale con l'interruttore dedicato.",
    help_input_2:
      "Puoi anche caricare un reticolo di celle personalizzato al posto di quello generato automaticamente.",
    help_params_title: "Scheda Parametri",
    help_params_1:
      "Il motore di calcolo Numpy è più veloce ed è quello raccomandato; il motore a loop Python è la versione di riferimento, più lenta, utile per verifica. I nomi delle colonne di latitudine e longitudine devono corrispondere esattamente, incluse maiuscole e minuscole, alle intestazioni del CSV dei crimini. Il CRS di input è il sistema di riferimento delle coordinate presenti nel CSV (di norma EPSG:4326, gradi decimali), mentre il CRS di analisi è il sistema usato per tutti i calcoli di distanza. La rimozione degli outlier individua i crimini troppo lontani dagli altri (soglia HubDist = media + k×deviazione standard) e li esclude sia dal calcolo dell'area di studio (AOI) e della griglia, restringendola attorno al nucleo dei crimini, sia dal calcolo della formula di Rossmo — se B è impostato su 'Auto', anche il suo calcolo automatico si basa sui soli crimini rimasti dopo la rimozione outlier. Se carichi un reticolo personalizzato, la rimozione outlier continua ad agire sui crimini usati dalla formula di Rossmo ma non ridefinisce più l'estensione della griglia.",
    help_params_2:
      "La griglia definisce il numero di celle in cui viene suddivisa l'area (più celle = maggiore risoluzione ma calcolo più lento; disabilitata se è stato caricato un reticolo personalizzato). I parametri f, g e k della formula di Rossmo si impostano qui; B può essere calcolato automaticamente dai dati oppure inserito manualmente. Puoi anche disattivare la normalizzazione dello score [0–100] e/o il calcolo del coefficiente di Gini.",
    help_layers_title: "Scheda Layers",
    help_layers_1:
      "I layer aggiuntivi modificano la superficie di probabilità moltiplicando lo score di ogni cella per un peso. Un layer DEM (elevazione) assegna pesi diversi in base a tre fasce di altitudine (pianura 0–220 m, collina 220–350 m, montagna oltre 350 m) più un peso per le celle senza dato. I layer di inclusione/esclusione sono poligoni (es. parchi, quartieri residenziali, cimiteri): assegnano un peso alle celle che intersecano la geometria e un peso diverso a quelle che non la intersecano — usali per escludere zone improbabili (es. laghi, aree industriali) o per includere solo zone plausibili (es. aree residenziali). Ogni layer può essere disattivato temporaneamente senza rimuoverlo, tramite la casella di spunta sulla sua scheda.",
    help_layers_2:
      "Attenzione, layer DEM su griglie grandi: il calcolo dell'elevazione media per cella richiede un'operazione raster separata per ogni cella della griglia, quindi il tempo cresce linearmente col numero di celle — con il reticolo predefinito (200×200 = 40.000 celle) un layer DEM può richiedere diversi minuti nel browser.",
    help_layers_3:
      'I layer di inclusione/esclusione accettano anche Shapefile, non solo GeoJSON — ma un file .shp da solo non è mai sufficiente: il formato richiede file collegati (.shx, .dbf, idealmente .prj) nella stessa cartella, e per motivi di sicurezza un sito web non può leggere da solo il contenuto del disco dell\'utente per trovarli. Due modi per caricare uno Shapefile: 1) usa "Sfoglia cartella" per selezionare l\'intera cartella che contiene i file dello shapefile — l\'app li abbina automaticamente; 2) usa "Sfoglia file multipli" per selezionarli tutti a mano (tenendo premuto Ctrl o Maiusc nella finestra di selezione).',
    help_incl_excl_title: "Layer di inclusione ed esclusione",
    help_incl_excl_1:
      "I termini layer di inclusione e layer di esclusione descrivono il ruolo concettuale previsto di ciascuna variabile ambientale o d'uso del suolo. Non implicano necessariamente che una località debba essere del tutto mantenuta o completamente rimossa dalla superficie di prioritizzazione.",
    help_incl_excl_2:
      "I pesi dei layer possono essere calibrati in modo conservativo per rappresentare un'idoneità parziale o un vincolo parziale. Questo è particolarmente importante quando una cella della griglia interseca più categorie d'uso del suolo. Ad esempio, una cella può sovrapporsi sia a un parco sia a un'area residenziale. Applicare un'esclusione binaria rigida rimuoverebbe l'intera cella, anche se una sua parte potrebbe comunque rappresentare una plausibile residenza dell'autore del reato o un luogo della sua attività.",
    help_incl_excl_3:
      "Ai layer di esclusione può quindi essere assegnato un peso ridotto ma non nullo, che abbassa la priorità della cella interessata senza eliminarla del tutto. Analogamente, i layer di inclusione possono aumentare il punteggio di una cella senza trattare la presenza della caratteristica rilevante come prova definitiva di idoneità.",
    help_incl_excl_4:
      "Questi layer dovrebbero quindi essere interpretati come modificatori spaziali pesati piuttosto che come maschere binarie rigide, a meno che non venga esplicitamente assegnato un peso pari a zero. L'esclusione completa può essere appropriata quando è giustificata analiticamente, ad esempio quando le celle della griglia sono sufficientemente piccole e la categoria d'uso del suolo esclusa copre quasi interamente la cella. I pesi intermedi sono generalmente preferibili quando le celle contengono usi del suolo misti o quando si desidera preservare l'incertezza.",
    help_output_title: "Scheda Output",
    help_output_1:
      "Dopo l'esecuzione trovi qui i risultati del modello baseline (solo formula di Rossmo) e — se sono stati aggiunti layer — del modello enhanced (con i pesi applicati). L'hit score % indica la percentuale di celle con punteggio pari o superiore a quello della cella dell'anchor point (disponibile solo se è stato fornito un anchor): più è basso, più il modello ha classificato in alto la vera posizione. L'area di ricerca è la superficie (in km²) delle celle con punteggio pari o superiore a quello dell'anchor, indipendentemente dal CRS scelto. La distanza guess è la distanza tra la cella con lo score più alto e la vera posizione dell'anchor.",
    help_output_2:
      "Il coefficiente di Gini misura quanto lo score sia concentrato in poche celle (valori vicini a 1 = alta concentrazione); la curva di Lorenz visualizza questa concentrazione graficamente. Usa i pulsanti nella barra in alto per esportare il ranking completo in CSV (con sidecar .csvt/.prj) o in GeoJSON.",
    help_legend_title: "Legenda",
    help_legend_1:
      "La legenda divide la superficie di probabilità in 21 fasce di colore, dalla più calda (rosso, priorità massima) alla più fredda (quasi nero, priorità minima).",
    help_legend_2:
      "Ogni cella viene assegnata a una fascia in base al proprio punteggio, suddividendo l'intervallo tra il punteggio minimo e massimo della griglia in 21 parti uguali su una scala che si adatta automaticamente ai dati: se i punteggi sono poco sbilanciati (es. esponenti f=g=1,2) la scala resta quasi lineare; se sono molto sbilanciati (es. esponenti f e g più alti, tipici di formulazioni più aggressive) la scala si avvicina a una scala logaritmica, evitando che poche celle estreme schiaccino tutte le altre in un'unica fascia quasi nera. La stessa scala è condivisa da legenda, mappa e contorni (contouring): lo stesso punteggio ha sempre lo stesso colore ovunque nell'app. Il comando Contorni heatmap sulla mappa traccia linee di contorno smussate lungo i confini delle fasce, come le isolinee di una carta topografica, al posto dell'aspetto a celle squadrate, rendendo più leggibili i confini tra le fasce di priorità. È disponibile solo con la griglia generata automaticamente e il CRS di analisi impostato esattamente su EPSG:4326; viene disabilitato se carichi un reticolo personalizzato o usi un CRS di analisi diverso.",
    help_legend_3:
      "Rank è la posizione della fascia (1 = più calda, 21 = più fredda). Actual è la soglia di punteggio di quella fascia (il suo bordo superiore). Priorità % normalizza quella soglia tra la fascia più calda (100%) e quella più fredda (0%), in proporzione — varia quindi da un'analisi all'altra in base alla forma reale dei punteggi di quella run, non è una scala fissa uguale per ogni dataset.",
    help_legend_4:
      "Hit Score % è la quota cumulata di celle della griglia con punteggio pari o superiore alla soglia di quella fascia: indica quanta area bisognerebbe perlustrare per includere tutte le celle fino a quel livello di priorità. Z-Score indica quante deviazioni standard la soglia della fascia si discosta dal punteggio medio di tutta la griglia — una misura di quanto una fascia sia statisticamente eccezionale rispetto al resto della superficie.",

    // Map panel
    map_loading: "Caricamento mappa…",
    heatmap_opacity_label: "Opacità heatmap",
    score_threshold_label: "Soglia score: {value}",
    layer_toggle_crimes: "Crimini",
    layer_toggle_anchor: "Anchor point",
    layer_toggle_grid: "Griglia",
    layer_toggle_heatmap: "Heatmap",
    legend_toggle_label: "Legenda",
    legend_col_color: "Colore",
    legend_col_priority: "Priorità %",
    legend_col_rank: "Rank",
    legend_col_hit_score: "Hit Score",
    legend_col_z_score: "Z-Score",
    legend_col_actual: "Actual",
    loading_in_progress: "Caricamento in corso",
  },
  en: {
    app_subtitle: "Mapping Interface for Detection, Narrowing and Analysis",
    map_toggle_label: "Map",
    tab_input: "Input",
    tab_params: "Parameters",
    tab_layers: "Layers",
    tab_output: "Output",
    tab_help: "Help",
    theme_toggle_aria: "Switch light/dark theme",
    theme_toggle_title: "Change theme",
    lang_toggle_aria_to_en: "Switch language to English",
    lang_toggle_aria_to_it: "Switch language to Italian",
    lang_toggle_title: "Change language",

    input_crimes_card_title: "Crime data",
    input_anchor_card_title: "Anchor point (optional)",
    input_grid_card_title: "Custom grid (optional)",

    upload_csv_label: "Crimes CSV",
    upload_loaded: "{name} loaded ({rows} rows).",

    anchor_desc:
      "The offender's real location, used only to evaluate the model (hit score, search area) — it does not affect the computation.",
    anchor_mode_manual: "Manual (lat/lon)",
    anchor_mode_file: "From file",
    anchor_file_label: "Anchor file (CSV or GeoJSON — same lat/lon columns as the crimes CSV)",
    anchor_lat_label: "Anchor latitude",
    anchor_lon_label: "Anchor longitude",
    lat_out_of_range: "Latitude out of range (-90, 90).",
    lon_out_of_range: "Longitude out of range (-180, 180).",

    grid_file_desc:
      "Replaces the automatic grid. When present, the Cells X/Y fields in the Parameters tab are disabled.",
    grid_file_label: "Grid file (GeoJSON, polygon geometries)",

    btn_remove: "Remove",
    btn_choose_file: "Choose file",
    no_file_selected: "No file selected",
    gpkg_warning_csv_geojson:
      "GeoPackage (.gpkg) is not reliable in this prototype (see Help) — use CSV or GeoJSON.",
    gpkg_warning_geojson:
      "GeoPackage (.gpkg) is not reliable in this prototype (see Help) — use GeoJSON.",

    // Parametri tab
    param_engine_label: "Computation engine",
    engine_numpy: "Numpy (vectorized, recommended)",
    engine_loop: "Loop (reference, slower)",
    engine_loop_warning: "Reference engine, much slower on large grids.",
    lat_col: "Latitude column",
    lon_col: "Longitude column",
    crs_input: "Input CSV CRS (source coordinates)",
    crs_output: "Analysis CRS (output)",
    param_cells_x: "Cells X",
    param_cells_y: "Cells Y",
    cells_from_custom_grid_suffix: "(from custom grid)",
    param_f: "f (decay outside buffer)",
    param_g: "g (decay inside buffer)",
    param_k: "k (normalization constant)",
    b_auto_label: "Automatic B",
    b_manual_label: "B (manual)",
    outlier_removal: "Spatial outlier removal",
    contouring_label: "Heatmap contours",
    outlier_threshold_label: "Outlier threshold (k in μ+k·σ)",
    normalize: "Normalize scores [0–100]",
    calc_gini: "Compute Gini coefficient",

    // Layers tab
    add_layer_label: "Add layer:",
    layer_type_dem: "DEM",
    layer_type_inclusion: "Inclusion",
    layer_type_exclusion: "Exclusion",
    warning_single_dem: "Only one DEM layer is allowed.",
    no_layers_message:
      "No layers added yet. The enhanced model is optional: without layers, the result matches the baseline model.",
    layer_dem_label: "DEM (elevation)",
    layer_name_label: "Layer name",
    dem_file_label: "File (GeoTIFF / HGT)",
    vector_mode_geojson: "GeoJSON",
    vector_mode_folder: "Shapefile — folder",
    vector_mode_multi: "Shapefile — multiple files",
    vector_file_desc:
      "A layer requires a GeoJSON file, or a Shapefile — but a .shp file alone is never enough: its companion files (.shx, .dbf) are also needed, and the browser can't look for them on disk by itself. Choose how to provide it:",
    vector_file_type_label: "File type",
    vector_files_loaded: "Files loaded: {names}",
    shapefile_error_no_shp:
      "No .shp file found in the selection. Select the .shp together with its companion files (.shx, .dbf).",
    shapefile_error_multiple:
      "Found {count} different shapefiles in the selection — select a folder or a file group with a single .shp.",
    shapefile_error_missing_sidecars:
      'Missing files linked to the shapefile ({missing}) — select them together with the .shp, or use "folder" mode.',
    shapefile_files_ignored: "{count} file(s) ignored (not part of the selected shapefile).",
    dem_threshold_col_label: "Threshold (min elevation)",
    weight_col_label: "Weight",
    terrain_flatland: "Flatland",
    terrain_hillside: "Hillside",
    terrain_mountain: "Mountain",
    terrain_nodata: "NoData",
    weight_intersect: "Intersection weight",
    weight_no_intersect: "Non-intersection weight",

    // Output tab
    result_grid_info: "Grid",
    grid_cells_created: "Cells created by grid: {n}",
    result_baseline: "Results — baseline model",
    result_enhanced: "Results — enhanced model",
    lorenz_charts_title: "Lorenz curves",
    lorenz_expand: "Expand",
    lorenz_collapse: "Collapse",
    lorenz_baseline_title: "Lorenz curve — Baseline",
    lorenz_enhanced_title: "Lorenz curve — Enhanced",
    lorenz_equality_line: "Perfect equality",
    results_table_title: "Results",
    log_section: "Execution log",
    result_hit_score: "Hit score %",
    result_search_area: "Search area",
    result_gini: "Gini coefficient",
    result_distance: "Home guess distance",
    error_prefix: "Error: {label}",
    no_result_yet: "No results yet.",
    results_summary: "{crimes} crimes used {outliersClause}— grid of {cells} cells, B = {b}.",
    results_outliers_clause: "({removed} outliers removed out of {total}) ",
    rows_label: "Rows",
    model_baseline_label: "Baseline",
    model_enhanced_label: "Enhanced",
    table_col_rank: "Rank",
    table_col_cell_id: "Cell ID",
    table_col_score: "Score",
    table_col_lon: "Lon",
    table_col_lat: "Lat",
    stage_load: "Loading crime data",
    stage_grid: "Building grid/AOI",
    stage_rossmo: "Computing Rossmo score",
    stage_layers: "Applying layers",
    stage_stats: "Statistics (Gini/normalization)",
    stage_eval: "Anchor point evaluation",
    stage_done: "Completed",
    loading_engine: "Loading Pyodide engine...",
    btn_run: "Run analysis",
    btn_stop: "Stop",
    btn_export_csv: "Export CSV",
    btn_export_baseline_geojson: "Export baseline (GeoJSON)",
    btn_export_enhanced_geojson: "Export enhanced (GeoJSON)",
    run_cancelled: "Analysis stopped by user.",

    // Help tab
    help_page_title: "Help",
    help_intro: "All computation happens in the browser, all data stays on your computer.",
    help_workflow_title: "Getting started",
    help_workflow_1: "1. Load the crimes CSV file in the Input tab, specifying the latitude and longitude columns.",
    help_workflow_2:
      "2. (Optional) Load an anchor point — from a file (default) or entered manually — only to compare the result against the known real location: it is not required to run the analysis.",
    help_workflow_3:
      "3. Configure the parameters in the Parameters tab: compute engine, outlier removal, grid size and Rossmo formula constants (f, g, k, B).",
    help_workflow_4:
      "4. (Optional) Add weight layers in the Layers tab — DEM, areas to include or exclude — to refine the probability surface.",
    help_workflow_5: '5. Press "Run analysis" and follow progress in the status bar.',
    help_workflow_6:
      "6. Review the results (hit score, search area, Gini, Lorenz curve) in the Output tab and export the ranking as CSV or GeoJSON.",
    help_input_title: "Input tab",
    help_input_1:
      "Load the crimes CSV file: it must contain the latitude and longitude columns. The anchor point is optional and, for academic and research purposes, only lets you compare the model's result against a known real location (benchmark): it is NOT required to run the analysis and does not affect the computation. By default the anchor loads from a file (CSV or GeoJSON, same lat/lon columns as the crimes CSV — only the first geometry in the file is used); you can switch to manual entry with the dedicated toggle.",
    help_input_2:
      "You can also load a custom grid of cells instead of the automatically generated one.",
    help_params_title: "Parameters tab",
    help_params_1:
      "The Numpy compute engine is faster and recommended; the Python loop engine is the slower reference implementation, useful for verification. The latitude and longitude column names must exactly match the crimes CSV headers, including letter case. The input CRS is the coordinate reference system of the coordinates in the CSV (usually EPSG:4326, decimal degrees), while the analysis CRS is the system used for all distance calculations. Outlier removal identifies crimes that are too far from the others (HubDist threshold = mean + k×standard deviation) and excludes them both from the area-of-interest (AOI) and grid extent calculation, shrinking it around the core cluster of crimes, and from the Rossmo formula computation itself — when B is set to 'Auto', its automatic computation is also based only on the crimes remaining after outlier removal. If you load a custom grid, outlier removal still affects the crimes used by the Rossmo formula but no longer redefines the grid's extent.",
    help_params_2:
      "The grid defines how many cells the area is divided into (more cells = higher resolution but slower computation; disabled if a custom grid has been loaded). The f, g and k parameters of the Rossmo formula are set here; B can be computed automatically from the data or entered manually. You can also turn off score normalization [0–100] and/or the Gini coefficient computation.",
    help_layers_title: "Layers tab",
    help_layers_1:
      "Additional layers modify the probability surface by multiplying each cell's score by a weight. A DEM (elevation) layer assigns different weights based on three altitude bands (flatland 0–220 m, hillside 220–350 m, mountain above 350 m) plus a weight for cells with no data. Inclusion/exclusion layers are polygons (e.g. parks, residential neighborhoods, cemeteries): they assign one weight to cells that intersect the geometry and a different weight to those that don't — use them to exclude unlikely areas (e.g. lakes, industrial zones) or to include only plausible ones (e.g. residential areas). Each layer can be temporarily disabled without removing it, via the checkbox on its card.",
    help_layers_2:
      "Careful with DEM layers on large grids: computing the average elevation per cell requires a separate raster operation for every grid cell, so the time grows linearly with the number of cells — with the default grid (200×200 = 40,000 cells) a DEM layer can take several minutes in the browser.",
    help_layers_3:
      'Inclusion/exclusion layers also accept Shapefiles, not just GeoJSON — but a .shp file alone is never sufficient: the format requires companion files (.shx, .dbf, ideally .prj) in the same folder, and for security reasons a website cannot read the user\'s disk contents by itself to find them. Two ways to load a Shapefile: 1) use "Browse folder" to select the entire folder containing the shapefile\'s files — the app matches them automatically; 2) use "Browse multiple files" to select them all by hand (holding Ctrl or Shift in the file picker).',
    help_incl_excl_title: "Inclusion and exclusion layers",
    help_incl_excl_1:
      "The terms inclusion layer and exclusion layer describe the intended conceptual role of each environmental or land-use variable. They do not necessarily imply that a location must be fully retained or completely removed from the prioritization surface.",
    help_incl_excl_2:
      "Layer weights may be calibrated conservatively to represent partial suitability or partial constraint. This is particularly important when a grid cell intersects multiple land-use categories. For example, a cell may overlap both a park and a residential area. Applying a strict binary exclusion would remove the entire cell, even though part of it may still represent a plausible offender residence or activity location.",
    help_incl_excl_3:
      "Exclusion layers can therefore be assigned a reduced but non-zero weight, lowering the priority of the affected cell without eliminating it completely. Similarly, inclusion layers can increase a cell's score without treating the presence of the relevant feature as definitive evidence of suitability.",
    help_incl_excl_4:
      "These layers should therefore be interpreted as weighted spatial modifiers rather than strict binary masks, unless a weight of zero is explicitly assigned. Complete exclusion may be appropriate when analytically justified, for example when grid cells are sufficiently small and the excluded land-use category covers the cell almost entirely. Intermediate weights are generally preferable when cells contain mixed land uses or when uncertainty should be preserved.",
    help_output_title: "Output tab",
    help_output_1:
      "After running the analysis, you'll find here the results of the baseline model (Rossmo formula only) and — if layers were added — the enhanced model (with weights applied). Hit score % is the percentage of cells scoring at or above the anchor point's cell (only available if an anchor was provided): the lower it is, the higher the model ranked the true location. Search area is the surface (in km²) of cells scoring at or above the anchor's, regardless of the chosen CRS. Guess distance is the distance between the highest-scoring cell and the anchor's true location.",
    help_output_2:
      "The Gini coefficient measures how concentrated the score is in a few cells (values close to 1 = high concentration); the Lorenz curve plots this concentration graphically. Use the buttons in the top bar to export the full ranking as CSV (with .csvt/.prj sidecars) or GeoJSON.",
    help_legend_title: "Legend",
    help_legend_1:
      "The legend splits the probability surface into 21 color bands, from the hottest (red, highest priority) to the coldest (near-black, lowest priority).",
    help_legend_2:
      "Each cell is assigned to a band based on its own score, splitting the range between the grid's minimum and maximum score into 21 equal parts on a scale that adapts automatically to the data: when scores are only mildly skewed (e.g. f=g=1.2) the scale stays close to linear; when they're heavily skewed (e.g. higher f/g exponents, typical of steeper formulations) the scale shifts toward logarithmic, so a handful of extreme cells don't collapse everything else into a single near-black band. The same scale is shared by the legend, the map, and the contour layer: the same score always renders the same color everywhere in the app. The Heatmap contours control on the map draws smooth contour lines along the band boundaries, like isolines on a topographic map, instead of the blocky per-cell grid, making the priority-band boundaries easier to read. It is available only with the automatically generated grid and the analysis CRS set to exactly EPSG:4326; it is disabled if you load a custom grid or use a different analysis CRS.",
    help_legend_3:
      "Rank is the band's position (1 = hottest, 21 = coldest). Actual is that band's score threshold (its upper edge). Priority % normalizes that threshold between the hottest band (100%) and the coldest band (0%), proportionally — so it varies from one analysis to another based on that run's actual score shape, rather than being a fixed scale identical across every dataset.",
    help_legend_4:
      "Hit Score % is the cumulative share of grid cells scoring at or above that band's threshold: it tells you how much area you'd need to search to cover every cell up to that priority level. Z-Score tells you how many standard deviations that band's threshold sits from the mean score across the whole grid — a way to gauge how statistically exceptional a band is relative to the rest of the surface.",

    // Map panel
    map_loading: "Loading map…",
    heatmap_opacity_label: "Heatmap opacity",
    score_threshold_label: "Score threshold: {value}",
    layer_toggle_crimes: "Crimes",
    layer_toggle_anchor: "Anchor point",
    layer_toggle_grid: "Grid",
    layer_toggle_heatmap: "Heatmap",
    legend_toggle_label: "Legend",
    legend_col_color: "Color",
    legend_col_priority: "Priority %",
    legend_col_rank: "Rank",
    legend_col_hit_score: "Hit Score",
    legend_col_z_score: "Z-Score",
    legend_col_actual: "Actual",
    loading_in_progress: "Loading in progress",

    error_file_empty: "The file is empty.",
    error_csv_columns: "Latitude/longitude columns not found in the header.",
    error_col_invalid_values: "Non-numeric or missing values in latitude/longitude.",
    error_col_not_numeric: "The column must contain numeric values.",
    error_too_few_crimes: "At least 2 crime points are required.",
    error_crimes_identical: "All crime points coincide: distinct positions are required.",
    error_no_valid_geometries: "The file contains no valid geometries.",
    error_no_crs: "The file has no coordinate reference system (CRS) defined.",
    error_file_no_geometries: "The file contains no geometries.",
    error_anchor_empty: "The anchor point file contains no geometries.",
    error_grid_not_polygon: "The custom grid must contain polygon geometries.",
    error_invalid_crs: "Invalid or unrecognized CRS.",
    error_grid_cells_positive: "The number of cells must be positive.",
    error_rossmo_params: "Invalid Rossmo formula parameters (f, g, k or B).",
    error_hub_dist_threshold: "The outlier threshold must be positive.",
  },
};

export function t(key: string, lang: Lang, vars?: Vars): string {
  let str = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export function useT() {
  const lang = useAppStore((s) => s.lang);
  return (key: string, vars?: Vars) => t(key, lang, vars);
}
