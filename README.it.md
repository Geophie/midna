<p align="center">
  <img src="public/midna-logo.png" alt="Logo MIDNA" width="120">
</p>

<h1 align="center">MIDNA</h1>

<p align="center"><strong>M</strong>apping <strong>I</strong>nterface for <strong>D</strong>etection, <strong>N</strong>arrowing and <strong>A</strong>nalysis</p>

🇬🇧 [English version](README.md)

Applicazione web per il *Criminal Geographic Targeting* (CGT) basato sul modello di Rossmo, con livelli spaziali ambientali e di uso del suolo opzionali.

MIDNA genera una superficie di priorità geografica a partire dalle localizzazioni dei crimini, evidenziando le aree in cui è più probabile si trovi il punto di ancoraggio dell'autore. Il modello CGT di base può essere arricchito con informazioni spaziali quali altimetria, zone di inclusione e zone di esclusione.

L'intera analisi viene eseguita nel browser tramite [Pyodide](https://pyodide.org/): i dati caricati restano sul dispositivo dell'utente e non vengono inviati a un backend applicativo.

## Usa MIDNA

**Applicazione web:** [Apri MIDNA](https://midnamap.vercel.app/)

L'applicazione è pensata per l'uso diretto online; non sono richiesti un'installazione locale né un ambiente Python.

> L'URL pubblico sarà aggiunto dopo il deploy.

L'applicazione include una **Guida** integrata (tab Guida) con la documentazione metodologica e operativa completa: scopo e limiti, procedura passo-passo, definizione dei parametri, interpretazione dei layer, metriche di output, legenda e note sull'interpretazione responsabile, bibliografia. Questo README riassume il workflow; la Guida in-app è il riferimento completo.

## Funzionalità

1. Caricamento delle localizzazioni dei crimini da CSV.
2. Definizione dell'area di interesse (AOI) e generazione automatica, o caricamento, della griglia di analisi.
3. Rimozione opzionale degli outlier spaziali.
4. Calcolo del punteggio CGT di Rossmo sulla griglia.
5. Integrazione opzionale di DEM, livelli di inclusione e di esclusione.
6. Normalizzazione, classificazione e confronto del modello base con quello arricchito.
7. Metriche analitiche: coefficiente di Gini, curva di Lorenz, hit score, area di ricerca.
8. Visualizzazione su mappa interattiva ed esportazione in CSV o GeoJSON.

L'interfaccia include tema chiaro/scuro, italiano e inglese, log di esecuzione, indicatore di avanzamento e annullamento dell'analisi.

La tab **Guida** documenta scopo e limiti, procedura d'uso, riferimento per ogni scheda, formula di Rossmo e coefficiente di Gini, legenda della heatmap e interpretazione responsabile, bibliografia.

## Dati e parametri

I dati obbligatori sono le localizzazioni dei crimini in formato CSV; la griglia personalizzata è facoltativa. Se non viene fornita, l'applicazione la genera dall'area di analisi.

I parametri configurabili includono CRS di input e analisi, risoluzione della griglia, parametri di Rossmo `f`, `g`, `k`, zona buffer `B`, outlier e motore di calcolo. Sono disponibili un'implementazione NumPy vettorizzata e una di riferimento basata su cicli.

I livelli opzionali comprendono dati altimetrici/DEM, aree di inclusione (per esempio zone residenziali) e di esclusione (per esempio parchi o cimiteri), trasformati in pesi spaziali e combinati con la superficie CGT.

## Riproducibilità

Lo studio pubblicato ha usato:

```text
f = 4
g = 8
```

I valori predefiniti dell'applicazione sono invece `f = 1.2` e `g = 1.2`, come adottati dall'implementazione open source [`rgeoprofile`](https://rdrr.io/cran/rgeoprofile/man/cgt_profile.html). Entrambe le impostazioni sono modificabili nell'interfaccia.

## Privacy e CRS

L'analisi viene elaborata localmente nel browser. Possono comunque essere effettuate normali richieste di rete per caricare l'applicazione, le librerie o le tessere cartografiche.

Il CRS influenza direttamente le distanze del modello. Il valore predefinito, `EPSG:4326`, usa gradi angolari; per analisi rigorose è consigliabile scegliere un CRS proiettato adatto all'area geografica, ad esempio una zona UTM appropriata. Cambiando CRS possono cambiare graduatoria delle celle, unità e interpretazione del buffer `B`.

## Architettura

L'interfaccia è costruita con [Next.js](https://nextjs.org/), React, Zustand e Leaflet. I moduli di analisi geospaziale Python, in `public/py/core`, vengono eseguiti da Pyodide in un Web Worker; la comunicazione con React usa [Comlink](https://github.com/GoogleChromeLabs/comlink). Le principali librerie geospaziali sono NumPy, GeoPandas, Rasterio, Shapely e PyProj.

## Sviluppo

Questa sezione riguarda solo chi vuole contribuire al codice sorgente: per usare MIDNA non serve installare nulla, si usa l'applicazione web.

Requisiti: Node.js e npm.

```bash
git clone https://github.com/Geophie/midna.git
cd midna
npm install
npm run dev
```

Il server locale è disponibile su `http://localhost:3000`. Il comando `predev` prepara automaticamente gli asset Pyodide. Per una build di produzione:

```bash
npm run build
```

Gli asset generati in `public/pyodide/` sono esclusi dal controllo versione e possono essere rigenerati manualmente con:

```bash
npm run prepare:assets
```

## Test

```bash
npm run test
npm run test:e2e
npm run test:golden
```

I comandi eseguono rispettivamente i test unitari Vitest, i test end-to-end Playwright e il confronto tra il motore NumPy ottimizzato e l'implementazione di riferimento.

## Articolo collegato

> Russo, S.M., Bottini, G., Quattrociocchi, D., Leitner, M. (2026).  
> **Enhancing Rossmo's criminal geographic targeting model through environmental and land-use spatial layers: a case study of the Atlanta homicides (1979–1981).**  
> *Crime Science*, 15, Article 18.  
> https://doi.org/10.1186/s40163-026-00278-w

## Contributori

| Contributore | Ruolo | Contributo |
| --- | --- | --- |
| **Sofia Maria Russo** ([@Geophie](https://github.com/Geophie)) | Responsabile del progetto / Ricerca | Concetto originale, metodologia e autrice dello studio scientifico |
| **Giacomo Butera** ([@WhtNoiz](https://github.com/WhtNoiz)) | Sviluppatore | Applicazione React/Next.js, pipeline Pyodide nel browser, visualizzazione ed esportazione |

## Citazione

Per lavori accademici, citare lo studio associato:

```bibtex
@article{russo2026rossmo,
  author  = {Russo, S. M. and Bottini, G. and Quattrociocchi, D. and Leitner, M.},
  title   = {Enhancing Rossmo's criminal geographic targeting model through environmental and land-use spatial layers: a case study of the Atlanta homicides (1979--1981)},
  journal = {Crime Science},
  volume  = {15},
  article = {18},
  year    = {2026},
  doi     = {10.1186/s40163-026-00278-w}
}
```

Indicare inoltre il repository e, quando rilevante per la riproducibilità, la release o il commit usato.

## Licenza

Il repository è distribuito con licenza [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/). Sono richiesti attribuzione e condivisione allo stesso modo; non è consentito l'uso commerciale. Consulta [`LICENSE`](LICENSE) per i termini completi.
