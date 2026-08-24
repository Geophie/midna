export const guideIt = String.raw`MIDNA — Guida metodologica e operativa
Mapping Interface for Detection, Narrowing and Analysis

MIDNA è uno strumento di geographic profiling che implementa una versione grid-based
del Criminal Geographic Targeting (CGT) di Rossmo (Rossmo, 2000, 2025) e consente,
opzionalmente, di modificare la superficie risultante mediante layer ambientali e di
uso del suolo, secondo l’approccio proposto da Russo et al. (2026). MIDNA è concepita
come una piattaforma modulare ed estensibile, destinata alla progressiva integrazione
di ulteriori metodi di geographic profiling, funzioni di analisi spaziale e strumenti analitici.
Tutti i calcoli vengono eseguiti localmente nel browser. I file caricati dall’utente non
vengono inviati a un server come parte dell’analisi.

Scopo e limiti
MIDNA è uno strumento di prioritizzazione spaziale per la ricerca di anchor point
(come la residenza) di criminali seriale, non un sistema per identificare un individuo. Il
modello, a partire dalla distribuzione dei crimini, assegna alle celle della superficie di
studio un punteggio relativo che indica quali aree risultano maggiormente coerenti con il
pattern spaziale osservato.
Una cella ad alta priorità non rappresenta una probabilità di colpevolezza, e una località
a bassa priorità non consente di escludere un individuo o un luogo dall’indagine. Il
geoprofilo deve essere interpretato insieme alle altre informazioni investigative disponibili.
Il modello assume, in termini generali, che gli eventi analizzati appartengano a una serie
sufficientemente coerente e che esista uno o più anchor point relativamente stabili che
contribuiscano a strutturare il pattern spaziale. Serie molto brevi, eventi erroneamente
collegati, forte comportamento commuter, cambiamenti di residenza o activity space,
target backcloth fortemente disomogenei e crime locations non indipendenti possono
ridurre la stabilità o l’interpretabilità del risultato (Rossmo, 2000).
L’anchor point noto, quando disponibile, viene utilizzato esclusivamente per valutare
retrospettivamente la performance del modello. Non entra nel calcolo della superficie e
non è necessario per generare un geoprofilo.




Come iniziare
   1. Nella scheda Input, carica un file CSV contenente le crime locations e specifica le
      colonne di latitudine e longitudine.
   2. Facoltativamente, carica un anchor point noto, da file oppure manualmente.
      L’anchor serve esclusivamente per la valutazione del risultato e non modifica la
      superficie generata.

   3. Nella scheda Parametri, configura il motore di calcolo, il CRS, l’eventuale
      trattamento degli outlier, la risoluzione della griglia e i parametri della formula CGT.

   4. Facoltativamente, nella scheda Layers, aggiungi DEM o layer poligonali di
      inclusione/esclusione per modificare la superficie baseline mediante pesi spaziali.

   5. Premi Esegui analisi e monitora l’avanzamento attraverso la barra di stato.

   6. Nella scheda Output, esamina la superficie generata e, quando è disponibile un
      anchor noto, le metriche di valutazione. Il ranking completo può essere esportato in
      CSV o GeoJSON.




Scheda Input
Crime locations
Il file CSV deve contenere almeno due colonne corrispondenti alle coordinate delle crime
locations.
Le coordinate devono essere coerenti con il CRS di input specificato nella scheda
Parametri. Per dati espressi come latitudine e longitudine in gradi decimali, il CRS più
comune è EPSG:4326 — WGS 84.

Quali location utilizzare?
La qualità del geoprofilo dipende dalla qualità del linkage e dalla rilevanza spaziale dei
punti inseriti (Rossmo, 2000). Eventi appartenenti a meccanismi diversi, location non
indipendenti o punti che non rappresentano effettivamente le locations pertinenti alla
serie possono produrre pattern fuorvianti.
MIDNA non verifica automaticamente se le crime locations appartengano allo stesso
offender o se siano investigativeamente equivalenti: questa valutazione rimane
responsabilità dell’analista.

Anchor point
L’anchor point è facoltativo.
Può essere:

   •   caricato da CSV o GeoJSON;
   •   inserito manualmente tramite coordinate.
Quando viene caricato un file contenente più geometrie, viene utilizzata esclusivamente la
prima geometria valida.
L’anchor noto viene utilizzato per calcolare misure retrospettive quali Hit Score %, Search
Area e Guess Distance. Non viene utilizzato per generare la superficie CGT baseline o
enhanced.
Importante: non è quindi necessario conoscere l’anchor point per utilizzare MIDNA su un
caso non risolto.

Reticolo personalizzato
È possibile caricare un reticolo personalizzato invece di utilizzare la griglia regolare
generata automaticamente.
In questo caso MIDNA utilizza la geometria fornita dall’utente come unità di calcolo.




Scheda Parametri
Motore di calcolo
MIDNA mette a disposizione due implementazioni della stessa procedura:
NumPy è il motore raccomandato. Utilizza operazioni vettorializzate e riduce
significativamente il tempo di calcolo, soprattutto su griglie di grandi dimensioni.
Python loop è l’implementazione originale utilizzata in Russo et al. (2026) di riferimento
più lenta, utile per verificare la coerenza del risultato.



CRS di input e CRS di analisi
Il CRS di input descrive il sistema di coordinate presente nei file caricati.
Il CRS di analisi è invece il sistema utilizzato durante le operazioni spaziali e i calcoli di
distanza.
Per dati inizialmente in latitudine/longitudine è comune utilizzare EPSG:4326 come CRS di
input. Per analisi locali o regionali basate su distanze planari è generalmente preferibile un
CRS proiettato appropriato alla regione di studio e con unità metriche, così che le
distanze abbiano un significato fisico diretto.
La scelta del CRS non è quindi puramente grafica: può influenzare i calcoli di distanza e
deve essere mantenuta costante quando si confrontano più analisi.




Outlier spaziali — HubDist
MIDNA consente di identificare e, opzionalmente, rimuovere crime locations spazialmente
periferiche attraverso HubDist.
Per ogni crime location viene calcolata la distanza dal mean center della serie. Una
location viene classificata come outlier quando:

HubDist > μ + kₒᵤₜ × σ
dove:

   •    μ è la media delle HubDist;
   •    σ è la loro deviazione standard;
   •    kₒᵤₜ è il moltiplicatore della deviazione standard impostato dall’utente.
Il valore 2σ corrisponde alla regola utilizzata nell’implementazione presentata da Russo et
al. (2026), sulla base di un criterio statistico convenzionale per l’identificazione di valori
estremi (Ebdon, 1985).

Importante: un outlier non è necessariamente un errore
La classificazione statistica di una crime location come outlier non implica che il punto
debba essere rimosso.
Una location periferica può rappresentare:

   •    un errore di linkage o geocoding;
   •    un evento non indipendente;
   •    un comportamento eccezionale;
   •    un viaggio più lungo del normale;
   •    un cambiamento nell’activity space;
   •    un anchor point secondario;
   •    oppure una componente reale e informativa del comportamento spaziale
        dell’offender.
La letteratura sul geographic profiling riconosce che punti anomali possono esercitare
un’influenza sproporzionata sulla superficie, ma anche che l’anomalia può essere
comportamentalmente significativa (Rossmo, 2000).
La rimozione degli outlier non deve quindi essere interpretata come una procedura
che migliora automaticamente l’accuratezza di Rossmo.
In alcune distribuzioni, uno o pochi punti estremamente periferici possono ampliare
fortemente l’AOI, modificare le nearest-neighbour distances e alterare la geometria
complessiva della superficie. In tali casi la loro esclusione può produrre un geoprofilo più
concentrato e maggiormente rappresentativo del core spatial pattern. In altre serie,
tuttavia, la rimozione può eliminare informazione reale e peggiorare la localizzazione
dell’anchor.

Procedura raccomandata
Quando la rimozione degli outlier è analiticamente plausibile, eseguire preferibilmente:
Scenario A — tutti gli eventi
e
Scenario B — outlier rimossi
e verificare se la principale area prioritaria rimane stabile.
Se il risultato cambia sostanzialmente, la differenza deve essere interpretata come
parameter/data sensitivity, non come prova che uno dei due scenari sia
necessariamente corretto. La rimozione dipende pertanto dallo specifico contesto del
caso e processo decisionale dell’analista.

Effetto sull’analisi
Con una griglia generata automaticamente, i punti rimossi vengono esclusi:

    •   dal calcolo dell’AOI;
    •   dalla costruzione della griglia;
    •   dal calcolo della formula di Rossmo;
    •   dal calcolo automatico di B, quando B = Auto.
Di conseguenza, l’AOI viene ridefinita sul set di crime locations mantenute.
Quando viene utilizzato un reticolo personalizzato, la geometria della griglia rimane
invariata: gli outlier eventualmente rimossi non partecipano alla formula CGT e al calcolo
automatico di B, ma non modificano l’estensione del reticolo fornito dall’utente.




Griglia
La griglia suddivide l’area di studio in celle sulle quali viene calcolato il CGT score.
Una griglia più fine produce una rappresentazione spaziale più dettagliata, ma aumenta il
costo computazionale.
Una griglia più grossolana riduce il tempo di calcolo ma può nascondere variazioni locali
della superficie.
La risoluzione deve quindi essere considerata una scelta analitica, non soltanto grafica.
Nei confronti tra modelli o scenari è importante mantenere costanti AOI, CRS e struttura
della griglia.
La configurazione della griglia automatica viene disabilitata quando viene fornito un
reticolo personalizzato.




Parametri della formula di Rossmo
MIDNA implementa la struttura del Criminal Geographic Targeting (CGT) proposta da
Rossmo.
Il modello combina:
   1. un effetto di distance decay, per cui la compatibilità con un anchor tende a
      diminuire all’aumentare della distanza dalle crime locations;

   2. una buffer zone, che riduce la priorità immediatamente in prossimità dei crime
      sites, rappresentando l’ipotesi che un offender possa evitare di agire troppo vicino
      al proprio anchor point per ridurre il rischio di riconoscimento.

I principali parametri sono f, g, B e K.

f — distance decay esterno
f controlla la velocità con cui il contributo di una crime location diminuisce oltre la buffer
zone.
Valori più elevati producono generalmente un decadimento più rapido e una superficie
maggiormente concentrata attorno alle crime locations.

g — comportamento interno alla buffer zone
g controlla la forma della funzione all’interno della buffer zone e quindi l’intensità con cui
vengono de-prioritizzate le aree immediatamente prossime ai crime sites.

Default f = 1.2 e g = 1.2
MIDNA utilizza come default:
f = 1.2
g = 1.2
Questa scelta deriva dalla formulazione originaria di Rossmo (1995).
Tuttavia, il confronto empirico tra metodi di geographic profiling mostra che la
performance può dipendere dalla specificazione dei parametri e dalle caratteristiche della
serie; per questo valori alternativi possono essere esplorati quando l’obiettivo è condurre
una sensitivity analysis, purché siano riportati in modo trasparente (Paulsen, 2006; Russo
et al., 2026).

Per un’analisi standard, f = g = 1.2 costituisce quindi il punto di partenza
raccomandato; per analisi di ricerca, è preferibile verificare la stabilità del risultato
rispetto a configurazioni alternative.




B — Buffer Zone
B rappresenta il raggio della buffer zone.
Quando B = Auto, MIDNA lo calcola a partire dalla struttura spaziale delle crime locations
utilizzando metà della mean nearest-neighbour distance:
B = ½ × mean nearest-neighbour distance
coerentemente con l’operazionalizzazione della formula CGT descritta da Rossmo e
utilizzata in Russo et al. (2026).
Se è attiva la rimozione degli outlier, il valore automatico viene calcolato esclusivamente
sulle crime locations mantenute.
B può anche essere inserito manualmente quando esiste una giustificazione metodologica
per utilizzare un buffer specifico.
Un valore di B diverso può modificare sensibilmente la posizione e l’estensione delle zone
ad alta priorità. Per questo B dovrebbe essere considerato un parametro da documentare
sempre nei risultati.




K — costante di scala CGT
K è una costante moltiplicativa della formula originale di Rossmo.
Il suo ruolo è principalmente quello di scalare numericamente i valori prodotti dalla
funzione; quando viene applicato uniformemente a tutte le celle, non modifica
l’ordinamento relativo della superficie.




Normalizzazione dello score
MIDNA può normalizzare i CGT score su una scala 0–100 per facilitarne la visualizzazione e
il confronto interno alla singola superficie.
La normalizzazione non deve essere interpretata come una conversione in probabilità.
Un valore pari a 80 significa che la cella ha un punteggio elevato relativamente alla
superficie generata, non che esista una probabilità dell’80% che l’anchor si trovi in
quella cella.
Per confronti quantitativi tra analisi diverse è consigliabile mantenere costanti le
impostazioni di normalizzazione.




Coefficiente di Gini
Il coefficiente di Gini descrive la concentrazione della distribuzione dei CGT score sulla
griglia.
Valori più elevati indicano che una quota maggiore del punteggio complessivo è
concentrata in una porzione relativamente piccola delle celle.
Valori più bassi indicano una superficie più uniforme o diffusa.
Un Gini elevato non significa automaticamente che il geoprofilo sia più accurato.
Un modello può produrre una superficie estremamente concentrata nel posto sbagliato. Il
Gini misura quindi concentrazione, non correttezza della localizzazione.
La relativa curva di Lorenz consente di visualizzare graficamente la distribuzione della
concentrazione.




Scheda Layers
La scheda Layers implementa l’estensione ambientale del CGT descritta da Russo et
al. (2026).
I layer aggiuntivi non sostituiscono la superficie di Rossmo. La superficie baseline viene
calcolata normalmente e successivamente modificata applicando pesi spaziali alle celle.
In termini generali:
Enhanced Score = Baseline CGT Score × spatial weight(s)
Quando più layer interessano la stessa cella, i rispettivi pesi si combinano
moltiplicativamente.
Di conseguenza, gli effetti dei layer possono accumularsi. Per esempio, due pesi pari a 0.8
e 0.5 producono un moltiplicatore complessivo pari a 0.4.
Questo valore non rappresenta una probabilità del 40%: indica soltanto che il CGT score
baseline della cella viene ridotto al 40% del suo valore precedente.

Interpretazione dei layer
I layer devono essere considerati spatial modifiers della superficie CGT.
Essi rappresentano informazioni ambientali, territoriali o di land use che l’analista
considera pertinenti alla specifica ipotesi di anchor point.
I relativi pesi non costituiscono coefficienti universali validati per qualsiasi città, offender o
offence type. Devono essere giustificati teoricamente o empiricamente e interpretati come
parte dello scenario analitico.




Layer DEM
Il layer DEM utilizza l’elevazione media di ogni cella per assegnare un peso in funzione
della classe altimetrica.
La classificazione predefinita distingue:

   •   pianura: 0–220 m;
   •   collina: 220–350 m;
   •   montagna: >350 m;
   •   celle senza dato.
Queste soglie derivano dall’operazionalizzazione utilizzata nel proof-of-method di Russo et
al. (2026) e non devono essere interpretate come classificazioni geomorfologiche
universali.
In una nuova area geografica, le soglie e i pesi dovrebbero essere rivalutati rispetto alla
topografia, alla distribuzione residenziale e all’ipotesi investigativa specifica.
Prestazioni
Per ogni cella della griglia deve essere calcolata l’informazione raster necessaria alla
classificazione.
Il costo computazionale cresce quindi con il numero di celle. Con una griglia 200 × 200,
corrispondente a 40.000 celle, un DEM può richiedere un tempo sensibilmente maggiore
rispetto a layer esclusivamente vettoriali.




Layer di inclusione ed esclusione
Le denominazioni inclusion layer ed exclusion layer descrivono il ruolo concettuale
assegnato alla variabile e non implicano necessariamente una decisione binaria.
Un exclusion layer può ridurre il CGT score nelle aree considerate meno compatibili con
l’anchor hypothesis senza eliminarle completamente.
Analogamente, un inclusion layer può aumentare il punteggio delle celle ritenute più
plausibili senza trattare la presenza della caratteristica come prova definitiva.

Perché utilizzare pesi intermedi?
Una singola cella può contenere più land uses.
Per esempio, una cella può intersecare contemporaneamente:

   •   una zona residenziale;
   •   un parco;
   •   una strada;
   •   un’area commerciale.
Assegnare automaticamente valore zero perché una piccola porzione della cella interseca
una categoria di esclusione potrebbe eliminare anche una porzione spazialmente
plausibile.
Per questo, quando esiste incertezza o mixed land use, sono generalmente preferibili pesi
intermedi.
Un peso pari a 0 produce invece una vera esclusione dalla superficie enhanced e dovrebbe
essere utilizzato soltanto quando l’incompatibilità con l’anchor hypothesis è
analiticamente giustificabile.

Shapefile
I layer poligonali possono essere caricati anche in formato Shapefile.
Un file .shp da solo non contiene tutte le informazioni necessarie. Devono essere
disponibili almeno i file associati:
.shp
.shx
.dbf

e, quando disponibile, anche:
.prj

Per caricare correttamente uno Shapefile:
   1. utilizzare Sfoglia cartella e selezionare la cartella contenente tutti i componenti;
      oppure
   2. utilizzare Sfoglia file multipli e selezionare manualmente i file associati.
Ogni layer può essere temporaneamente disabilitato senza rimuoverlo, consentendo di
confrontare rapidamente scenari alternativi.




Scheda Output
MIDNA restituisce sempre il risultato del modello Baseline, costituito esclusivamente
dalla formula CGT.
Quando vengono applicati uno o più spatial layers, viene inoltre restituito il modello
Enhanced.
Il confronto tra Baseline ed Enhanced permette di valutare come le informazioni
contestuali abbiano modificato la prioritizzazione spaziale.
Quando non viene fornito un anchor point, MIDNA genera comunque la superficie e il
ranking, ma le metriche che richiedono ground truth non sono disponibili.




Hit Score %
Quando è disponibile un anchor noto, MIDNA identifica la cella che lo contiene e
determina il relativo CGT score.
L’Hit Score % indica la percentuale cumulativa di celle con un punteggio pari o superiore a
quello della cella contenente l’anchor.
Valori più bassi indicano che la posizione realmente nota è stata collocata più in alto nel
ranking.
Con una griglia regolare composta da celle della stessa area, l’Hit Score % può essere
interpretato anche come quota proporzionale dell’area di ricerca.
Con reticoli personalizzati contenenti celle di area diversa, questa equivalenza non è
garantita: in tali casi utilizzare la Search Area per interpretare l’effettivo spazio da
esaminare.




Search Area
La Search Area rappresenta l’area complessiva, espressa in km², delle celle aventi CGT
score pari o superiore a quello della cella contenente l’anchor.
Essa traduce il ranking in una misura direttamente interpretabile in termini di superficie
prioritaria da esaminare.
Più bassa è la Search Area necessaria a raggiungere l’anchor noto, maggiore è l’efficienza
retrospettiva del profilo.




Guess Distance
La Guess Distance misura la distanza tra:

   •   il punto rappresentativo della cella con il CGT score massimo;
   •   l’anchor point noto.
È una misura intuitiva ma deve essere interpretata come indicatore descrittivo
complementare, non come sintesi completa della qualità del geoprofilo.
Un geographic profile è infatti una superficie di prioritizzazione e non una semplice
previsione puntuale. Due modelli possono avere una Guess Distance simile ma differire
considerevolmente nella quantità di area che sarebbe necessario esaminare prima di
raggiungere l’anchor.
Per questo MIDNA attribuisce particolare rilevanza a Hit Score % e Search Area.




Confrontare Baseline ed Enhanced
Una riduzione di Hit Score o Search Area nel modello Enhanced indica che i layer hanno
collocato l’anchor noto in una porzione relativamente più prioritaria della superficie.
Tuttavia, una maggiore concentrazione del profilo — inclusa una crescita del Gini — non
costituisce da sola evidenza di maggiore accuratezza.
Quando MIDNA viene utilizzato per ricerca o validazione, il confronto dovrebbe
considerare congiuntamente:

   •   Hit Score %;
   •   Search Area;
   •   Guess Distance;
   •   Gini;
   •   stabilità rispetto a parametri e preprocessing;
   •   plausibilità teorica dei layer utilizzati.



Esportazione
Il ranking completo può essere esportato dalla barra superiore in:
CSV, con eventuali file sidecar .csvt e .prj;
oppure
GeoJSON.
L’esportazione consente di analizzare i risultati in software GIS esterni e di documentare in
modo riproducibile i parametri e le superfici generate.




Legenda della heatmap
La superficie viene rappresentata attraverso 21 fasce di priorità, dalla fascia più calda alla
più fredda.
Le tonalità calde rappresentano le celle maggiormente prioritarie; le tonalità
progressivamente più scure rappresentano livelli inferiori di priorità.
Il colore è una rappresentazione del ranking relativo della superficie, non della
probabilità che un particolare individuo si trovi in una determinata area.

Scala adattiva
MIDNA costruisce la scala cromatica sulla distribuzione dei CGT score della singola analisi.
Quando la distribuzione è relativamente uniforme, come può avvenire con esponenti di
distance decay moderati, la trasformazione rimane prossima a una scala lineare.
Quando pochi valori sono molto più elevati del resto della distribuzione, la scala viene
progressivamente compressa in modo simile a una trasformazione logaritmica. Questo
evita che poche celle estreme occupino le prime fasce e che la quasi totalità della
superficie venga rappresentata con un unico colore molto scuro.
La trasformazione riguarda la visualizzazione della superficie: non modifica i CGT score
originali né il loro ordinamento.
Legenda, heatmap e contorni utilizzano la stessa classificazione, così che un determinato
livello di score sia rappresentato coerentemente in tutte le visualizzazioni.




Rank
Rank indica la posizione ordinale della fascia cromatica:
1 = fascia più calda / priorità maggiore
21 = fascia più fredda / priorità minore
Rank non rappresenta una probabilità.




Actual
Actual mostra la soglia di CGT score associata alla fascia, espressa nella scala numerica
utilizzata dalla specifica analisi.
Il valore è utile per collegare la rappresentazione cromatica ai CGT score effettivi.




Priority %
Priority % normalizza la soglia della fascia tra:
100% = fascia più prioritaria
e
0% = fascia meno prioritaria
Il valore è relativo alla distribuzione della singola run.
Pertanto, una Priority del 90% in due analisi differenti non implica necessariamente lo
stesso CGT score o la stessa evidenza spaziale.
Priority % non è una probabilità di localizzazione dell’anchor.




Hit Score % nella legenda
Per ogni fascia, Hit Score % indica la quota cumulativa di celle aventi un punteggio pari o
superiore alla soglia della fascia.
Può essere letto come:
    “quanta parte della griglia è compresa tra la massima priorità e questo livello?”
Con celle di uguale area, il valore rappresenta anche la quota proporzionale della
superficie coperta.




Z-Score
Lo Z-Score esprime di quante deviazioni standard la soglia della fascia si trovi sopra o
sotto il CGT score medio della griglia.
È un indicatore descrittivo della posizione relativa della fascia nella distribuzione dei
punteggi.
Uno Z-Score elevato indica che quella fascia appartiene alla parte più estrema della
distribuzione.
Non deve essere interpretato come test statistico, livello di significatività o
probabilità.
Poiché le superfici CGT possono essere fortemente asimmetriche, lo Z-Score è
principalmente utile come descrittore della concentrazione relativa.




Contorni heatmap
Il comando Contorni heatmap sostituisce la visualizzazione a celle con linee smussate
che seguono i confini delle fasce di priorità, analogamente alle isolinee di una carta
topografica.
I contorni sono una funzione esclusivamente grafica: non modificano CGT score, ranking o
metriche.
Sono disponibili soltanto quando:
   •   viene utilizzata la griglia generata automaticamente;
   •   il CRS di analisi è impostato esattamente su EPSG:4326.
La funzione viene disabilitata con un reticolo personalizzato o con un CRS di analisi
differente.
Questa limitazione riguarda il rendering dei contorni e non costituisce una
raccomandazione metodologica a utilizzare EPSG:4326 come CRS di analisi.




Interpretazione responsabile
MIDNA deve essere utilizzato per prioritizzare aree, non per attribuire responsabilità
individuale.
Il modello non determina:

   •   chi abbia commesso un reato;
   •   se un determinato indirizzo appartenga all’offender;
   •   se una persona debba essere esclusa perché si trova in un’area a bassa priorità;
   •   se un singolo scenario parametrico rappresenti la “vera” distribuzione spaziale.
Quando il risultato cambia sostanzialmente modificando outlier, B, f, g, CRS, AOI,
resolution o layer weights, questa instabilità costituisce un’informazione
metodologicamente rilevante e dovrebbe essere documentata.
Per applicazioni di ricerca, è raccomandato registrare almeno:
dataset utilizzato; CRS; AOI; grid specification; trattamento degli outlier; f; g; B; K;
layer utilizzati; pesi; impostazioni di normalizzazione; versione di MIDNA.
Queste informazioni consentono di riprodurre l’analisi e distinguere gli effetti del modello
da quelli delle scelte analitiche.




Base metodologica
L’implementazione baseline di MIDNA si basa sul framework Criminal Geographic
Targeting di Rossmo.
L’integrazione moltiplicativa di informazioni ambientali e land-use nella superficie CGT
segue il proof-of-method descritto in:
Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026). Enhancing Rossmo’s
criminal geographic targeting model through environmental and land-use spatial layers: a
case study of the Atlanta homicides (1979–1981). Crime Science, 15, Article 18.
MIDNA rappresenta un’implementazione indipendente del metodo e non deve essere
inteso come una versione del software commerciale RIGEL.




Bibliografia
Ebdon, D. (1985). Statistics in Geography (2nd ed.). Blackwell.
Paulsen, D. J. (2006). Human versus machine: A comparison of the accuracy of geographic
profiling methods. Journal of Investigative Psychology and Offender Profiling, 3(2), 77–89.
https://doi.org/10.1002/jip.46
Rossmo, D. K. (1995). Geographic Profiling: Target Patterns of Serial Murderers [Doctoral
dissertation, Simon Fraser University].
Rossmo, D. K. (2000). Geographic Profiling. CRC Press.
Rossmo, D.K. (2025). Geographic Profiling (2nd ed.). Routledge
Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026). Enhancing Rossmo’s
criminal geographic targeting model through environmental and land-use spatial layers: a
case study of the Atlanta homicides (1979–1981). Crime Science, 15, Article 18.
https://doi.org/10.1186/s40163-026-00278-w
Per ulteriori approfondimenti metodologici, dettagli di validazione e riferimenti aggiuntivi,
si veda Russo et al. (2026).

`;
