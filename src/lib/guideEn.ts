export const guideEn = String.raw`MIDNA — Methodological and operational guide
Mapping Interface for Detection, Narrowing and Analysis

MIDNA is a geographic-profiling tool that implements a grid-based version of
Rossmo's Criminal Geographic Targeting (CGT) model (Rossmo, 2000, 2025), and
optionally allows the resulting surface to be modified using environmental
and land-use layers, following the approach proposed by Russo et al. (2026).
MIDNA is designed as a modular, extensible platform intended for the
progressive integration of further geographic-profiling methods,
spatial-analysis functions, and analytical tools. All computations are
performed locally in the browser. Files uploaded by the user are not sent to
a server as part of the analysis.

Purpose and limitations
MIDNA is a spatial-prioritisation tool for searching for anchor points (such
as a residence) of serial offenders, not a system for identifying an
individual. Starting from the distribution of crimes, the model assigns
each cell of the study surface a relative score indicating which areas are
most consistent with the observed spatial pattern.
A high-priority cell does not represent a probability of guilt, and a
low-priority location does not allow an individual or a place to be excluded
from the investigation. The geographic profile must be interpreted together
with all other available investigative information.
In general terms, the model assumes that the analysed events belong to a
sufficiently coherent series and that one or more relatively stable anchor
points exist that help structure the spatial pattern. Very short series,
incorrectly linked events, strong commuter behaviour, changes of residence
or activity space, strongly uneven target backcloths, and non-independent
crime locations can reduce the stability or interpretability of the result
(Rossmo, 2000).
A known anchor point, when available, is used exclusively to retrospectively
evaluate the model's performance. It is not part of the surface calculation
and is not required to generate a geographic profile.




Getting started
   1. In the Input tab, upload a CSV file containing the crime locations
      and specify the latitude and longitude columns.
   2. Optionally, upload a known anchor point, from a file or entered
      manually. The anchor is used only to evaluate the result and does
      not modify the generated surface.

   3. In the Parameters tab, configure the computation engine, the CRS,
      any outlier treatment, the grid resolution, and the CGT formula
      parameters.

   4. Optionally, in the Layers tab, add a DEM or polygon inclusion/
      exclusion layers to modify the baseline surface through spatial
      weights.

   5. Select Run analysis and monitor progress through the status bar.

   6. In the Output tab, examine the generated surface and, when a known
      anchor is available, the evaluation metrics. The complete ranking
      can be exported as CSV or GeoJSON.




Input tab
Crime locations
The CSV file must contain at least two columns corresponding to the
coordinates of the crime locations.
The coordinates must be consistent with the input CRS specified in the
Parameters tab. For data expressed as latitude and longitude in decimal
degrees, the most common CRS is EPSG:4326 — WGS 84.

Which locations to use?
The quality of the geographic profile depends on the quality of the linkage
and the spatial relevance of the points entered (Rossmo, 2000). Events
belonging to different mechanisms, non-independent locations, or points
that do not actually represent locations relevant to the series can produce
misleading patterns.
MIDNA does not automatically verify whether the crime locations belong to
the same offender or are investigatively equivalent: this assessment
remains the analyst's responsibility.

Anchor point
The anchor point is optional.
It can be:

   •   loaded from a CSV or GeoJSON file;
   •   entered manually using coordinates.
When a file containing multiple geometries is loaded, only the first valid
geometry is used.
The known anchor is used to calculate retrospective measures such as Hit
Score %, Search Area, and Guess Distance. It is not used to generate the
baseline or enhanced CGT surface.
Important: it is therefore not necessary to know the anchor point in order
to use MIDNA on an unsolved case.

Custom grid
A custom grid can be uploaded instead of using the automatically generated
regular grid.
In this case MIDNA uses the geometry provided by the user as the
calculation unit.




Parameters tab
Computation engine
MIDNA offers two implementations of the same procedure:
NumPy is the recommended engine. It uses vectorised operations and
significantly reduces computation time, especially on large grids.
Python loop is the original implementation used in Russo et al. (2026), a
slower reference implementation useful for checking the consistency of the
result.



Input CRS and analysis CRS
The input CRS describes the coordinate system present in the uploaded
files.
The analysis CRS is instead the system used during spatial operations and
distance calculations.
For data originally in latitude/longitude, EPSG:4326 is commonly used as
the input CRS. For local or regional analyses based on planar distances, an
appropriate projected CRS for the study region, with metric units, is
generally preferable, so that distances have a direct physical meaning.
CRS choice is therefore not purely a display setting: it can influence
distance calculations and should be kept constant when comparing multiple
analyses.




Spatial outliers — HubDist
MIDNA allows spatially peripheral crime locations to be identified and,
optionally, removed using HubDist.
For each crime location, the distance from the series' mean centre is
calculated. A location is classified as an outlier when:

HubDist > μ + kₒᵤₜ × σ
where:

   •    μ is the mean of the HubDist values;
   •    σ is their standard deviation;
   •    kₒᵤₜ is the standard-deviation multiplier set by the user.
The value 2σ corresponds to the rule used in the implementation presented
by Russo et al. (2026), based on a conventional statistical criterion for
identifying extreme values (Ebdon, 1985).

Important: an outlier is not necessarily an error
Statistically classifying a crime location as an outlier does not imply
that the point should be removed.
A peripheral location can represent:

   •    a linkage or geocoding error;
   •    a non-independent event;
   •    exceptional behaviour;
   •    a longer-than-usual trip;
   •    a change in activity space;
   •    a secondary anchor point;
   •    or a real and informative component of the offender's spatial
        behaviour.
The geographic-profiling literature recognises that anomalous points can
exert a disproportionate influence on the surface, but also that the
anomaly can be behaviourally meaningful (Rossmo, 2000).
Removing outliers should therefore not be interpreted as a procedure
that automatically improves the accuracy of Rossmo's model.
In some distributions, one or a few extremely peripheral points can
substantially enlarge the AOI, change the nearest-neighbour distances, and
alter the overall geometry of the surface. In such cases their exclusion
can produce a more concentrated geographic profile that better represents
the core spatial pattern. In other series, however, removal can eliminate
real information and worsen anchor localisation.

Recommended procedure
When removing outliers is analytically plausible, it is preferable to run:
Scenario A — all events
and
Scenario B — outliers removed
and check whether the main priority area remains stable.
If the result changes substantially, the difference should be interpreted
as parameter/data sensitivity, not as proof that one of the two scenarios
is necessarily correct. Removal therefore depends on the specific case
context and the analyst's decision-making process.

Effect on the analysis
With an automatically generated grid, removed points are excluded:

    •   from the AOI calculation;
    •   from the grid construction;
    •   from the calculation of the Rossmo formula;
    •   from the automatic calculation of B, when B = Auto.
As a result, the AOI is redefined based on the retained set of crime
locations.
When a custom grid is used, the grid geometry remains unchanged: any
removed outliers do not take part in the CGT formula or in the automatic
calculation of B, but they do not modify the extent of the grid provided by
the user.




Grid
The grid divides the study area into cells on which the CGT score is
calculated.
A finer grid produces a more detailed spatial representation but increases
computational cost.
A coarser grid reduces computation time but can hide local variations in
the surface.
Resolution should therefore be considered an analytical choice, not merely
a display setting.
When comparing models or scenarios, it is important to keep the AOI, CRS,
and grid structure constant.
Automatic grid configuration is disabled when a custom grid is provided.




Rossmo formula parameters
MIDNA implements the Criminal Geographic Targeting (CGT) structure proposed
by Rossmo.
The model combines:
   1. a distance-decay effect, whereby compatibility with an anchor tends
      to decrease as the distance from the crime locations increases;

   2. a buffer zone, which reduces priority immediately around the crime
      sites, representing the hypothesis that an offender may avoid
      acting too close to their own anchor point to reduce the risk of
      recognition.

The main parameters are f, g, B and K.

f — external distance decay
f controls the speed at which the contribution of a crime location
decreases beyond the buffer zone.
Higher values generally produce faster decay and a surface more
concentrated around the crime locations.

g — behaviour inside the buffer zone
g controls the shape of the function inside the buffer zone, and therefore
the intensity with which areas immediately close to the crime sites are
de-prioritised.

Default f = 1.2 and g = 1.2
MIDNA uses as default:
f = 1.2
g = 1.2
This choice derives from Rossmo's original formulation (1995).
However, empirical comparison of geographic-profiling methods shows that
performance can depend on parameter specification and the characteristics
of the series; for this reason, alternative values can be explored when the
goal is to conduct a sensitivity analysis, provided they are reported
transparently (Paulsen, 2006; Russo et al., 2026).

For a standard analysis, f = g = 1.2 is therefore the recommended starting
point; for research analyses, it is preferable to check the stability of
the result against alternative configurations.




B — Buffer Zone
B represents the radius of the buffer zone.
When B = Auto, MIDNA calculates it from the spatial structure of the crime
locations using half the mean nearest-neighbour distance:
B = ½ × mean nearest-neighbour distance
consistent with the operationalisation of the CGT formula described by
Rossmo and used in Russo et al. (2026).
If outlier removal is active, the automatic value is calculated exclusively
on the retained crime locations.
B can also be entered manually when there is a methodological
justification for using a specific buffer.
A different value of B can substantially change the position and extent of
the high-priority zones. For this reason, B should always be considered a
parameter to be documented in the results.




K — CGT scale constant
K is a multiplicative constant in Rossmo's original formula.
Its main role is to numerically scale the values produced by the function;
when applied uniformly to all cells, it does not change the relative
ordering of the surface.




Score normalisation
MIDNA can normalise CGT scores onto a 0–100 scale to facilitate
visualisation and comparison within a single surface.
Normalisation should not be interpreted as a conversion into probability.
A value of 80 means that the cell has a high score relative to the
generated surface, not that there is an 80% probability that the anchor is
located in that cell.
For quantitative comparisons between different analyses, it is advisable to
keep the normalisation settings constant.




Gini coefficient
The Gini coefficient describes the concentration of the distribution of CGT
scores across the grid.
Higher values indicate that a larger share of the total score is
concentrated in a relatively small portion of the cells.
Lower values indicate a more uniform or diffuse surface.
A high Gini value does not automatically mean that the geographic profile
is more accurate.
A model can produce an extremely concentrated surface in the wrong place.
The Gini coefficient therefore measures concentration, not the correctness
of the localisation.
The corresponding Lorenz curve allows the distribution of concentration to
be visualised graphically.




Layers tab
The Layers tab implements the environmental extension of CGT described by
Russo et al. (2026).
Additional layers do not replace the Rossmo surface. The baseline surface
is calculated normally and subsequently modified by applying spatial
weights to the cells.
In general terms:
Enhanced Score = Baseline CGT Score × spatial weight(s)
When multiple layers affect the same cell, their respective weights combine
multiplicatively.
As a result, layer effects can accumulate. For example, two weights of 0.8
and 0.5 produce an overall multiplier of 0.4.
This value does not represent a 40% probability: it only indicates that the
cell's baseline CGT score is reduced to 40% of its previous value.

Interpreting layers
Layers should be considered spatial modifiers of the CGT surface.
They represent environmental, territorial, or land-use information that
the analyst considers relevant to the specific anchor-point hypothesis.
Their weights are not universal coefficients validated for any city,
offender, or offence type. They must be justified theoretically or
empirically and interpreted as part of the analytical scenario.




DEM layer
The DEM layer uses the mean elevation of each cell to assign a weight based
on the elevation class.
The default classification distinguishes:

   •   lowland: 0–220 m;
   •   hillside: 220–350 m;
   •   mountain: >350 m;
   •   cells without data.
These thresholds derive from the operationalisation used in the Russo et
al. (2026) proof of method and should not be interpreted as universal
geomorphological classifications.
In a new geographic area, thresholds and weights should be reassessed
against local topography, residential distribution, and the specific
investigative hypothesis.
Performance
For each grid cell, the raster information required for classification
must be computed.
Computational cost therefore grows with the number of cells. With a
200 × 200 grid, corresponding to 40,000 cells, a DEM can take significantly
longer than purely vector layers.




Inclusion and exclusion layers
The terms inclusion layer and exclusion layer describe the conceptual role
assigned to the variable and do not necessarily imply a binary decision.
An exclusion layer can reduce the CGT score in areas considered less
compatible with the anchor hypothesis without eliminating them completely.
Similarly, an inclusion layer can increase the score of cells considered
more plausible without treating the presence of the feature as definitive
evidence.

Why use intermediate weights?
A single cell can contain multiple land uses.
For example, a cell may simultaneously intersect:

   •   a residential area;
   •   a park;
   •   a road;
   •   a commercial area.
Automatically assigning a value of zero because a small portion of the cell
intersects an exclusion category could also eliminate a spatially
plausible portion.
For this reason, when there is uncertainty or mixed land use, intermediate
weights are generally preferable.
A weight of 0 produces instead a true exclusion from the enhanced surface
and should be used only when incompatibility with the anchor hypothesis is
analytically justifiable.

Shapefile
Polygon layers can also be uploaded in Shapefile format.
A .shp file alone does not contain all the required information. At least
the associated files must be available:
.shp
.shx
.dbf

and, when available, also:
.prj

To correctly upload a Shapefile:
   1. use Browse folder and select the folder containing all the
      components; or
   2. use Browse multiple files and manually select the associated
      files.
Each layer can be temporarily disabled without removing it, allowing
alternative scenarios to be compared quickly.




Output tab
MIDNA always returns the Baseline model result, consisting exclusively of
the CGT formula.
When one or more spatial layers are applied, the Enhanced model is also
returned.
Comparing Baseline and Enhanced makes it possible to assess how contextual
information has changed the spatial prioritisation.
When no anchor point is provided, MIDNA still generates the surface and
ranking, but metrics that require ground truth are not available.




Hit Score %
When a known anchor is available, MIDNA identifies the cell containing it
and determines its CGT score.
Hit Score % indicates the cumulative percentage of cells with a score equal
to or higher than that of the cell containing the anchor.
Lower values indicate that the actually known location was placed higher
in the ranking.
With a regular grid made up of equal-area cells, Hit Score % can also be
interpreted as the proportional share of the search area.
With custom grids containing cells of different areas, this equivalence is
not guaranteed: in such cases use Search Area to interpret the actual
space to be examined.




Search Area
Search Area represents the total area, expressed in km², of the cells with
a CGT score equal to or higher than that of the cell containing the
anchor.
It translates the ranking into a measure that is directly interpretable in
terms of the priority surface to be examined.
The lower the Search Area required to reach the known anchor, the higher
the retrospective efficiency of the profile.




Guess Distance
Guess Distance measures the distance between:

   •   the representative point of the cell with the maximum CGT score;
   •   the known anchor point.
It is an intuitive measure but should be interpreted as a complementary
descriptive indicator, not as a complete summary of geographic-profile
quality.
A geographic profile is in fact a prioritisation surface, not a simple
point prediction. Two models can have a similar Guess Distance but differ
considerably in the amount of area that would need to be examined before
reaching the anchor.
For this reason MIDNA gives particular importance to Hit Score % and
Search Area.




Comparing Baseline and Enhanced
A reduction in Hit Score or Search Area in the Enhanced model indicates
that the layers placed the known anchor in a relatively higher-priority
portion of the surface.
However, greater concentration of the profile — including an increase in
the Gini coefficient — does not by itself constitute evidence of greater
accuracy.
When MIDNA is used for research or validation, the comparison should
jointly consider:

   •   Hit Score %;
   •   Search Area;
   •   Guess Distance;
   •   Gini;
   •   stability with respect to parameters and preprocessing;
   •   theoretical plausibility of the layers used.



Export
The complete ranking can be exported from the top bar as:
CSV, with optional .csvt and .prj sidecar files;
or
GeoJSON.
Export allows the results to be analysed in external GIS software and
enables reproducible documentation of the parameters and surfaces
generated.




Heatmap legend
The surface is represented through 21 priority bands, from the hottest
band to the coldest.
Warm tones represent the highest-priority cells; progressively darker
tones represent lower priority levels.
Colour is a representation of the surface's relative ranking, not of the
probability that a particular individual is located in a given area.

Adaptive scale
MIDNA builds the colour scale based on the distribution of CGT scores for
the single analysis.
When the distribution is relatively uniform, as can happen with moderate
distance-decay exponents, the transformation remains close to a linear
scale.
When a few values are much higher than the rest of the distribution, the
scale is progressively compressed in a way similar to a logarithmic
transformation. This prevents a few extreme cells from occupying the top
bands and almost the entire surface from being represented with a single
very dark colour.
The transformation concerns the visualisation of the surface: it does not
modify the original CGT scores or their ordering.
The legend, heatmap, and contours use the same classification, so that a
given score level is represented consistently across all visualisations.




Rank
Rank indicates the ordinal position of the colour band:
1 = hottest band / highest priority
21 = coldest band / lowest priority
Rank does not represent a probability.




Actual
Actual shows the CGT score threshold associated with the band, expressed
on the numeric scale used by the specific analysis.
This value is useful for linking the colour representation to the actual
CGT scores.




Priority %
Priority % normalises the band threshold between:
100% = highest-priority band
and
0% = lowest-priority band
The value is relative to the distribution of the single run.
Therefore, a Priority of 90% in two different analyses does not
necessarily imply the same CGT score or the same spatial evidence.
Priority % is not a probability of anchor localisation.




Hit Score % in the legend
For each band, Hit Score % indicates the cumulative share of cells with a
score equal to or higher than the band's threshold.
It can be read as:
    "how much of the grid falls between the highest priority and this
    level?"
With equal-area cells, the value also represents the proportional share of
the surface covered.




Z-Score
The Z-Score expresses how many standard deviations the band's threshold
lies above or below the grid's mean CGT score.
It is a descriptive indicator of the band's relative position within the
score distribution.
A high Z-Score indicates that the band belongs to the most extreme part of
the distribution.
It should not be interpreted as a statistical test, a significance level,
or a probability.
Because CGT surfaces can be strongly asymmetric, the Z-Score is mainly
useful as a descriptor of relative concentration.




Heatmap contours
The Heatmap contours option replaces the cell-based visualisation with
smoothed lines that follow the boundaries of the priority bands, similar
to the contour lines on a topographic map.
Contours are a purely graphical feature: they do not modify CGT scores,
ranking, or metrics.
Available only when:
   •   the automatically generated grid is used;
   •   the analysis CRS is set exactly to EPSG:4326.
The feature is disabled with a custom grid or with a different analysis
CRS.
This limitation concerns contour rendering and does not constitute a
methodological recommendation to use EPSG:4326 as the analysis CRS.




Responsible interpretation
MIDNA must be used to prioritise areas, not to attribute individual
responsibility.
The model does not determine:

   •   who committed an offence;
   •   whether a given address belongs to the offender;
   •   whether a person should be excluded because they are located in a
       low-priority area;
   •   whether a single parametric scenario represents the "true" spatial
       distribution.
When the result changes substantially by modifying outliers, B, f, g, CRS,
AOI, resolution or layer weights, this instability constitutes
methodologically relevant information and should be documented.
For research applications, it is recommended to record at least:
dataset used; CRS; AOI; grid specification; outlier treatment; f; g; B; K;
layers used; weights; normalisation settings; MIDNA version.
This information allows the analysis to be reproduced and helps distinguish
the effects of the model from those of analytical choices.




Methodological basis
MIDNA's baseline implementation is based on the Criminal Geographic
Targeting framework proposed by Rossmo.
The multiplicative integration of environmental and land-use information
into the CGT surface follows the proof of method described in:
Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026). Enhancing
Rossmo's criminal geographic targeting model through environmental and
land-use spatial layers: a case study of the Atlanta homicides (1979–1981).
Crime Science, 15, Article 18.
MIDNA is an independent implementation of the method and should not be
understood as a version of the commercial RIGEL software.




References
Ebdon, D. (1985). Statistics in Geography (2nd ed.). Blackwell.
Paulsen, D. J. (2006). Human versus machine: A comparison of the accuracy of
geographic profiling methods. Journal of Investigative Psychology and
Offender Profiling, 3(2), 77–89. https://doi.org/10.1002/jip.46
Rossmo, D. K. (1995). Geographic Profiling: Target Patterns of Serial
Murderers [Doctoral dissertation, Simon Fraser University].
Rossmo, D. K. (2000). Geographic Profiling. CRC Press.
Rossmo, D. K. (2025). Geographic Profiling (2nd ed.). Routledge
Russo, S. M., Bottini, G., Quattrociocchi, D., & Leitner, M. (2026). Enhancing
Rossmo's criminal geographic targeting model through environmental and
land-use spatial layers: a case study of the Atlanta homicides (1979–1981).
Crime Science, 15, Article 18. https://doi.org/10.1186/s40163-026-00278-w
For further methodological background, validation details, and additional
references, see Russo et al. (2026).

`;
