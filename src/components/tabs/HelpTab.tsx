"use client";

import type { ReactNode } from "react";
import { IoLogoGithub } from "react-icons/io5";
import { Card } from "@/components/ui/Card";
import { guideIt } from "@/lib/guideIt";
import { guideEn } from "@/lib/guideEn";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  [35, ["scheda Input"]], [37, ["anchor point noto"]], [41, ["scheda Parametri"]], [44, ["scheda Layers"]],
  [47, ["Esegui analisi"]], [49, ["scheda Output"]], [60, ["CRS di input"]], [62, ["EPSG:4326 — WGS 84"]],
  [74, ["facoltativo"]], [84, ["Importante:"]], [98, ["NumPy"]], [100, ["Python loop"]],
  [106, ["CRS di input"]], [107, ["CRS di analisi"]], [111, ["CRS proiettato appropriato alla regione di studio e con unità metriche"]], [126, ["HubDist"]],
  [130, ["HubDist > μ + kₒᵤₜ × σ"]], [133, ["μ"]], [134, ["σ"]], [135, ["kₒᵤₜ"]],
  [136, ["2σ"]], [141, ["non implica che il punto"]], [142, ["debba essere rimosso"]], [156, ["La rimozione degli outlier non deve quindi essere interpretata come una procedura"]],
  [157, ["che migliora automaticamente l’accuratezza di Rossmo"]], [167, ["Scenario A — tutti gli eventi"]], [169, ["Scenario B — outlier rimossi"]], [172, ["parameter/data sensitivity"]],
  [182, ["B = Auto"]], [184, ["reticolo personalizzato"]], [197, ["scelta analitica"]], [207, ["Criminal Geographic Targeting (CGT)"]],
  [210, ["distance decay"]], [213, ["buffer zone"]], [217, ["f", "g", "B", "K"]], [223, ["f"]],
  [229, ["g"]], [234, ["f = 1.2"]], [235, ["g = 1.2"]], [243, ["Per un’analisi standard, f = g = 1.2 costituisce quindi il punto di partenza"]],
  [244, ["raccomandato; per analisi di ricerca, è preferibile verificare la stabilità del risultato"]], [245, ["rispetto a configurazioni alternative."]], [251, ["B"]], [252, ["B = Auto"]],
  [254, ["B = ½ × mean nearest-neighbour distance"]], [271, ["K"]], [280, ["0–100"]], [284, ["non che esista una probabilità dell’80% che l’anchor si trovi in"]],
  [285, ["quella cella"]], [293, ["concentrazione della distribuzione dei CGT score"]], [298, ["Un Gini elevato non significa automaticamente che il geoprofilo sia più accurato"]], [300, ["concentrazione"]],
  [313, ["Enhanced Score = Baseline CGT Score × spatial weight(s)"]], [316, ["accumularsi"]], [322, ["spatial modifiers"]], [337, ["0 ≤ elevazione < 250 m"]],
  [338, ["250 ≤ elevazione < 350 m"]], [339, ["≥350 m"]], [342, ["classificazioni geomorfologiche universali"]], [356, ["inclusion layer", "exclusion layer"]],
  [377, ["pesi"]], [378, ["intermedi"]], [379, ["0"]], [395, ["Sfoglia cartella"]],
  [397, ["Sfoglia file multipli"]], [405, ["Baseline"]], [409, ["Enhanced"]], [425, ["Hit Score %"]],
  [429, ["Hit Score %"]], [432, ["Search Area"]], [444, ["Search Area"]], [448, ["Search Area"]],
  [455, ["Guess Distance"]], [459, ["indicatore descrittivo"]], [460, ["complementare"]], [473, ["non"]],
  [474, ["costituisce da sola evidenza di maggiore accuratezza"]], [489, ["CSV"]], [491, ["GeoJSON"]], [499, ["21 fasce di priorità"]],
  [503, ["ranking relativo della superficie"]], [514, ["visualizzazione della superficie"]], [522, ["Rank"]], [523, ["Rank"]],
  [524, ["1 = fascia più calda / priorità maggiore"]], [525, ["21 = fascia più fredda / priorità minore"]], [532, ["Actual"]], [539, ["Priority %"]],
  [540, ["Priority %"]], [541, ["100% = fascia più prioritaria"]], [543, ["0% = fascia meno prioritaria"]], [547, ["Priority % non è una probabilità di localizzazione dell’anchor"]],
  [552, ["Hit Score %"]], [553, ["Hit Score %"]], [563, ["Z-Score"]], [564, ["Z-Score"]],
  [570, ["Non deve essere interpretato come test statistico, livello di significatività o"]], [571, ["probabilità."]], [578, ["Contorni heatmap"]], [579, ["Contorni heatmap"]],
  [589, ["non costituisce una"]], [590, ["raccomandazione metodologica a utilizzare EPSG:4326 come CRS di analisi"]], [596, ["prioritizzare aree"]], [608, ["dataset utilizzato; CRS; AOI; grid specification; trattamento degli outlier; f; g; B; K;"]],
  [609, ["layer utilizzati; pesi; impostazioni di normalizzazione; versione di MIDNA."]], [617, ["Criminal Geographic"]], [618, ["Targeting"]],
]);

const englishSectionTitles = new Set([
  "Purpose and limitations", "Getting started", "Input tab", "Parameters tab",
  "Spatial outliers — HubDist", "Grid", "Rossmo formula parameters",
  "B — Buffer Zone", "K — CGT scale constant", "Score normalisation",
  "Gini coefficient", "Layers tab", "Output tab", "Responsible interpretation",
  "Methodological basis", "References",
]);

const englishLabels = new Set([
  "Crime locations", "Which locations to use?", "Anchor point", "Custom grid",
  "Computation engine", "Input CRS and analysis CRS", "Important: an outlier is not necessarily an error",
  "Recommended procedure", "Effect on the analysis", "f — external distance decay",
  "g — behaviour inside the buffer zone", "Default f = 1.2 and g = 1.2",
  "Interpreting layers", "DEM layer", "Performance", "Inclusion and exclusion layers",
  "Why use intermediate weights?", "Shapefile", "Hit Score %", "Search Area",
  "Guess Distance", "Comparing Baseline and Enhanced", "Export", "Heatmap legend",
  "Adaptive scale", "Rank", "Actual", "Priority %", "Hit Score % in the legend", "Z-Score",
  "Heatmap contours",
]);

const englishSeparatedHeadings = new Set([
  "Getting started", "Input tab", "Parameters tab", "Layers tab", "Output tab",
  "Heatmap legend", "Responsible interpretation", "Methodological basis",
]);

const englishHighlights = [
  "Criminal Geographic Targeting (CGT)", "spatial-prioritisation tool for searching for anchor points",
  "not a probability of guilt", "known anchor point", "Input tab", "known anchor", "Parameters tab",
  "Layers tab", "Run analysis", "Output tab", "EPSG:4326 — WGS 84", "NumPy", "Python loop",
  "HubDist > μ + kₒᵤₜ × σ", "HubDist", "μ", "σ", "kₒᵤₜ", "2σ", "not necessarily an error",
  "should therefore not be interpreted as a procedure", "Scenario A — all events", "Scenario B — outliers removed",
  "parameter/data sensitivity", "B = Auto", "custom grid", "analytical choice",
  "f = 1.2", "g = 1.2", "B = ½ × mean nearest-neighbour distance", "0–100",
  "not that there is an 80% probability", "does not automatically mean", "Enhanced Score = Baseline CGT Score × spatial weight(s)",
  "does not represent a 40% probability", "spatial modifiers", "0 ≤ elevation < 250 m", "250 ≤ elevation < 350 m", "≥350 m",
  "should not be interpreted as universal geomorphological classifications", "Baseline", "Enhanced",
  "Hit Score %", "Search Area", "Guess Distance", "complementary descriptive indicator", "CSV", "GeoJSON",
  "21 priority bands", "relative ranking", "Rank does not represent a probability",
  "Priority % is not a probability of anchor localisation",
  "should not be interpreted as a statistical test, a significance level,",
  "or a probability.",
  "purely graphical feature", "prioritise areas",
  "dataset used; CRS; AOI; grid specification; outlier treatment; f; g; B; K;",
  "layers used; weights; normalisation settings; MIDNA version.",
].sort((a, b) => b.length - a.length);

const englishHighlightExpression = new RegExp(`(${englishHighlights.map(escapeRegExp).join("|")})`, "g");

function highlightEnglish(line: string) {
  return line.split(englishHighlightExpression).map((part, index) => englishHighlights.includes(part) ? <strong key={index}>{part}</strong> : part);
}

function RawGuide({
  text,
  sectionTitles,
  labels,
  separatedHeadings,
  renderLine,
  footer,
}: {
  text: string;
  sectionTitles: Set<string>;
  labels: Set<string>;
  separatedHeadings: Set<string>;
  renderLine: (line: string, index: number) => ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="gap-0 text-sm leading-relaxed text-foreground">
      {text.split("\n").map((line, index, lines) => {
        if (index === 0) return <h1 key={index} className="text-[22px] font-bold leading-tight text-accent">{line}</h1>;
        if (line === "Mapping Interface for Detection, Narrowing and Analysis") return <p key={index} className="mt-2 font-bold leading-tight text-accent">{line}</p>;
        if (sectionTitles.has(line)) return <h2 key={index} className={`text-[18px] font-bold leading-tight ${separatedHeadings.has(line) ? "mt-6 border-t border-border pt-6" : "mt-6"}`}>{line}</h2>;
        if (labels.has(line)) return <h3 key={index} className={`text-base font-bold leading-tight ${separatedHeadings.has(line) ? "mt-6 border-t border-border pt-6" : "mt-4"}`}>{line}</h3>;
        if (!line) return lines[index - 1] ? <div key={index} className="h-3" /> : null;
        return <div key={index} className="whitespace-pre-wrap">{renderLine(line, index)}</div>;
      })}
      {footer}
    </Card>
  );
}

function GuideGithubCta() {
  const t = useT();
  return (
    <div className="mt-6 border-t border-border pt-6 text-sm">
      <p className="text-foreground-muted">{t("github_star_cta")}</p>
      <a
        href="https://github.com/Geophie/midna"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-background"
      >
        <IoLogoGithub size={18} aria-hidden="true" />
        {t("github_star_button")}
      </a>
    </div>
  );
}

function ItalianGuide() {
  return (
    <RawGuide
      text={guideIt}
      sectionTitles={italianSectionTitles}
      labels={italianLabels}
      separatedHeadings={italianSeparatedHeadings}
      footer={<GuideGithubCta />}
      renderLine={(line, index) => {
        const highlights = italianHighlights.get(index);
        if (!highlights) return line;
        const expression = new RegExp(`(${highlights.map(escapeRegExp).join("|")})`, "g");
        return line.split(expression).map((part, partIndex) => highlights.includes(part) ? <strong key={partIndex}>{part}</strong> : part);
      }}
    />
  );
}

function EnglishGuide() {
  return (
    <RawGuide
      text={guideEn}
      sectionTitles={englishSectionTitles}
      labels={englishLabels}
      separatedHeadings={englishSeparatedHeadings}
      footer={<GuideGithubCta />}
      renderLine={(line) => highlightEnglish(line)}
    />
  );
}

export function HelpTab() {
  const lang = useAppStore((state) => state.lang);
  return lang === "it" ? <ItalianGuide /> : <EnglishGuide />;
}
