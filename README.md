<p align="center">
  <img src="public/midna-logo.png" alt="MIDNA logo" width="120">
</p>

<h1 align="center">MIDNA</h1>

<p align="center"><strong>M</strong>apping <strong>I</strong>nterface for <strong>D</strong>etection, <strong>N</strong>arrowing and <strong>A</strong>nalysis</p>

[Versione italiana](README.it.md)

A browser-based application for Criminal Geographic Targeting (CGT) using Rossmo's model, with optional environmental and land-use spatial layers.

MIDNA generates a geographic prioritization surface from a set of crime locations, helping identify areas in which an offender's anchor point may be more likely to be located. The baseline CGT model can be enhanced using additional spatial information such as elevation, inclusion zones, and exclusion zones.

The complete analysis pipeline runs directly in the browser through [Pyodide](https://pyodide.org/). Uploaded crime and spatial data are processed locally in the user's browser and are not sent to an application backend.

## Use MIDNA

**Web application:** [Open MIDNA](https://YOUR-VERCEL-URL)

MIDNA is designed to be used directly through the hosted web application. No installation or local Python environment is required.

> The public application URL will be added after deployment.

The application includes a built-in **Guide** (Help tab) with the full methodological and operational documentation — purpose and limitations, step-by-step usage, parameter definitions, layer interpretation, output metrics, legend, responsible-interpretation notes, and references. This README summarizes the workflow; the in-app Guide is the authoritative reference.

---

## What it does

MIDNA provides an interactive workflow for geographic profiling:

1. Upload crime locations from a CSV file.
2. Define the area of interest (AOI).
3. Generate an analysis grid automatically or provide a custom grid.
4. Optionally identify and remove statistical spatial outliers.
5. Compute Rossmo's Criminal Geographic Targeting score across the analysis area.
6. Optionally enhance the baseline model with environmental and land-use layers:
   - Digital Elevation Model (DEM)
   - inclusion layers, such as residential areas
   - exclusion layers, such as parks or cemeteries
7. Normalize and rank the resulting grid cells.
8. Calculate analytical metrics including:
   - Gini coefficient
   - Lorenz curve
   - hit score percentage
   - search area
9. Compare baseline and enhanced models against a known anchor point when available.
10. Visualize the results through an interactive map.
11. Export analysis results as CSV or GeoJSON.

---

## Using the application

The interface guides the user through the complete analysis workflow.

### Input

Upload the data required for the analysis.

The application accepts:

- crime locations in CSV format
- an optional custom analysis grid

If no custom grid is provided, MIDNA can generate one automatically from the analysis area.

### Parameters

Configure the geographic profiling model and analysis settings, including:

- analysis CRS
- grid resolution
- Rossmo parameters `f`, `g`, and `k`
- buffer-zone parameter `B`
- automatic or manual buffer-zone configuration
- spatial outlier removal
- outlier threshold
- computation engine

Two computation engines are available:

- vectorized NumPy implementation
- reference loop implementation

### Layers

Optional spatial layers can be added to enhance the baseline CGT surface.

Supported categories include:

- elevation / DEM data
- inclusion layers
- exclusion layers

These layers are transformed into spatial weights and combined with the underlying geographic profiling surface.

### Output

The results section allows users to inspect and compare the resulting geographic profiles.

Available outputs include:

- baseline geographic profile
- enhanced geographic profile
- interactive heatmap
- contour visualization
- map legend
- ranked grid cells
- Gini coefficient
- Lorenz curve
- hit score percentage
- search-area metrics
- CSV export
- GeoJSON export

### Help

The Guide tab documents: purpose and limitations, getting started, per-tab reference (Input, Parameters, Layers, Output), the Rossmo formula and Gini coefficient, heatmap legend and responsible interpretation, and the methodological references.

---

## Interface features

MIDNA also includes:

- interactive Leaflet map
- responsive web interface
- light and dark themes
- English and Italian language support
- live execution log
- analysis progress reporting
- cancellation of running analyses
- baseline/enhanced model comparison

---

## Related paper

MIDNA implements and extends the methodology described in:

> Russo, S.M., Bottini, G., Quattrociocchi, D., Leitner, M. (2026).  
> **Enhancing Rossmo's criminal geographic targeting model through environmental and land-use spatial layers: a case study of the Atlanta homicides (1979–1981).**  
> *Crime Science*, 15, Article 18.  
> https://doi.org/10.1186/s40163-026-00278-w

The application provides an interactive implementation of the published methodology while also allowing users to explore different model parameters and spatial assumptions.

---

## Parameter settings and reproducibility

The published study used the following parameter values for Rossmo's Criminal Geographic Targeting model:

```text
f = 4
g = 8
```

After publication, an additional source was identified documenting:

```text
f = 1.2
g = 1.2
```

as the default values adopted by the open-source [`rgeoprofile`](https://rdrr.io/cran/rgeoprofile/man/cgt_profile.html) implementation, where they are described as values recommended by Rossmo (1995).

Because this source was identified only after publication, these values were **not used in the original study**.

Sensitivity testing conducted during development nevertheless indicated that the principal findings of the published analysis remain consistent when `f = 1.2` and `g = 1.2` are used.

When spatial outliers are retained, using `f = 1.2` and `g = 1.2` substantially improves the performance of the baseline model without environmental layers. However, this does not eliminate the contribution of environmental and land-use information.

For the Atlanta homicide case, the enhanced model continues to outperform the corresponding baseline in terms of anchor-point prioritization and search area, although the magnitude of the improvement is reduced. Under these settings, the strongest effect of the enhanced model is observed in the overall concentration of the resulting geographic surface.

Both parameters can be modified directly in the application.

The application's default values are:

```text
f = 1.2
g = 1.2
```

To reproduce the parameter configuration used in the published study, use:

```text
f = 4
g = 8
```

---

## Privacy and client-side processing

MIDNA performs the geographic analysis directly inside the user's browser.

Crime-location datasets and spatial layers uploaded through the interface are processed locally and are not sent to an application backend for analysis.

Python execution is provided through Pyodide, while computationally intensive operations are executed inside a dedicated Web Worker so that the main interface remains responsive.

The browser may still perform ordinary network requests required to load the application, map tiles, libraries, or other external resources. These requests are separate from the local processing of uploaded analysis datasets.

---

## CRS and distance considerations

The selected Coordinate Reference System (CRS) affects the distance calculations used by Rossmo's model.

The current default CRS is:

```text
EPSG:4326
```

EPSG:4326 represents coordinates using angular units rather than metric distances.

When a projected CRS such as an appropriate UTM zone is used, distance calculations instead operate in metric units.

This distinction is analytically important because Rossmo's model depends on distance. Manhattan distance calculated using projected metric coordinates is not equivalent to Manhattan distance calculated directly from latitude and longitude.

Consequently:

- changing the CRS may change grid-cell rankings
- the unit and interpretation of the buffer-zone parameter `B` changes
- rigorous analyses should use a CRS appropriate to the geographic area being studied

CRS selection should therefore be considered part of the analytical methodology rather than merely a visualization setting.

---

## Technical architecture

MIDNA is designed as a predominantly client-side web application.

### Web interface

The interface is built using:

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Leaflet](https://leafletjs.com/)
- [React Leaflet](https://react-leaflet.js.org/)

### Geospatial computation

The geographic profiling and geoprocessing modules are implemented in Python and executed directly in the browser using:

- [Pyodide](https://pyodide.org/)
- WebAssembly
- Web Workers
- [Comlink](https://github.com/GoogleChromeLabs/comlink)

The Python environment uses numerical and geospatial libraries including:

- NumPy
- GeoPandas
- Rasterio
- Shapely
- PyProj

The core Python modules are located under:

```text
public/py/core
```

The Pyodide environment runs inside:

```text
src/workers/pyodide.worker.ts
```

Communication between the React application and the worker is handled through Comlink.

This architecture allows computationally intensive geographic analysis to run outside the main UI thread without requiring a dedicated Python computation backend.

---

## Testing

The project includes several levels of automated testing.

### Unit tests

```bash
npm run test
```

Runs the Vitest test suite.

### End-to-end tests

```bash
npm run test:e2e
```

Runs the Playwright end-to-end test suite.

### Computational equivalence

```bash
npm run test:golden
```

Checks the consistency of the optimized NumPy engine against the reference loop implementation.

This provides an additional safeguard that performance optimizations do not unintentionally alter the analytical results.

---

## Development

The hosted web application is the intended way to use MIDNA.

The following instructions are only necessary for contributors who want to run or modify the source code locally.

### Requirements

- Node.js
- npm

Clone the repository:

```bash
git clone https://github.com/OWNER/REPOSITORY.git
cd REPOSITORY
```

Install dependencies:

```bash
npm install
```

Start the development environment:

```bash
npm run dev
```

The local development server is available at:

```text
http://localhost:3000
```

The required Pyodide runtime and Python wheel assets are prepared automatically through the project's `predev` lifecycle hook.

### Production build

```bash
npm run build
```

The corresponding `prebuild` hook automatically prepares the Pyodide assets required by the production bundle.

### Pyodide assets

Generated runtime assets are stored under:

```text
public/pyodide/
```

and are excluded from version control.

They can be regenerated manually with:

```bash
npm run prepare:assets
```

Asset preparation is handled by:

```text
scripts/prepare-pyodide-assets.mjs
```

---

## Deployment

The public version of MIDNA is deployed on [Vercel](https://vercel.com/).

The application does not require a dedicated Python analysis server: the geographic profiling pipeline is executed on the client through Pyodide.

---

## Contributors

| Contributor | Role | Contributions |
| --- | --- | --- |
| **Sofia Maria Russo** ([@Geophie](https://github.com/Geophie)) | Project Lead / Research | Original concept, research methodology, and authorship of the underlying scientific study |
| **Giacomo Butera** ([@WhtNoiz](https://github.com/WhtNoiz)) | Developer | Web application development, including the React/Next.js frontend, Pyodide/Web Worker integration, client-side geoprocessing pipeline, interactive visualization, and data export |

---

## Citation

If MIDNA is used in academic work, please cite the underlying research:

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

When referencing the software itself, please also specify the repository and, where reproducibility is relevant, the release or commit used.

---

## License

This repository is currently distributed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Under this license:

- attribution is required
- commercial use is not permitted
- derivative works must be distributed under the same license

See [`LICENSE`](LICENSE) for the complete license terms.
