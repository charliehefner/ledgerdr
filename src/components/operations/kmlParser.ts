import JSZip from "jszip";

export interface ParsedPlacemark {
  name: string;
  geojson: GeoJSON.Geometry;
}

export async function parseKMLFile(file: File): Promise<ParsedPlacemark[]> {
  let kmlText: string;

  if (file.name.toLowerCase().endsWith(".kmz")) {
    const zip = await JSZip.loadAsync(file);
    const kmlFile = Object.keys(zip.files).find((n) =>
      n.toLowerCase().endsWith(".kml")
    );
    if (!kmlFile) throw new Error("No KML file found inside KMZ archive");
    kmlText = await zip.files[kmlFile].async("string");
  } else {
    kmlText = await file.text();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, "application/xml");

  const placemarks = doc.querySelectorAll("Placemark");
  const results: ParsedPlacemark[] = [];

  placemarks.forEach((pm) => {
    const nameEl = pm.querySelector("name");
    const name = nameEl?.textContent?.trim() || "";
    if (!name) return;

    const polygon = pm.querySelector("Polygon");
    const multiGeometry = pm.querySelector("MultiGeometry");

    if (multiGeometry) {
      const polygons = multiGeometry.querySelectorAll("Polygon");
      const coordinates: number[][][][] = [];
      polygons.forEach((p) => {
        const rings = extractPolygonRings(p);
        if (rings) coordinates.push(rings);
      });
      if (coordinates.length > 0) {
        results.push({
          name,
          geojson: { type: "MultiPolygon", coordinates },
        });
      }
    } else if (polygon) {
      const rings = extractPolygonRings(polygon);
      if (rings) {
        results.push({
          name,
          geojson: { type: "MultiPolygon", coordinates: [rings] },
        });
      }
    }
  });

  return results;
}

function extractPolygonRings(polygon: Element): number[][][] | null {
  const rings: number[][][] = [];

  const outerBoundary = polygon.querySelector("outerBoundaryIs coordinates");
  if (!outerBoundary?.textContent) return null;

  rings.push(parseCoordinateString(outerBoundary.textContent));

  polygon.querySelectorAll("innerBoundaryIs coordinates").forEach((inner) => {
    if (inner.textContent) {
      rings.push(parseCoordinateString(inner.textContent));
    }
  });

  return rings;
}

function parseCoordinateString(coordStr: string): number[][] {
  return coordStr
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [lng, lat] = tuple.split(",").map(Number);
      return [lng, lat];
    })
    .filter((c) => !isNaN(c[0]) && !isNaN(c[1]));
}
