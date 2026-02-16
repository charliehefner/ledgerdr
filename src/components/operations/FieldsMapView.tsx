import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Map as MapIcon } from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapAgingControls } from "./MapAgingControls";
import { TrackHistoryControls } from "./TrackHistoryControls";
import { TrackLegend } from "./TrackLegend";
import { LivePositionsControl, type LivePosition } from "./LivePositionsControl";
import { FieldHistoryPanel } from "./FieldHistoryPanel";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY2hhcmxlc2hlZm5lcmpvcmQiLCJhIjoiY21saWx4YjJyMDRtZDNmb3B5dzZwenBxZiJ9.k8mtyT5Xip_xmjOv0sN8WQ";

const FARM_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
  "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
];

const IMPLEMENT_COLORS = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#bfef45", "#469990", "#9A6324",
];

const UNMATCHED_COLOR = "#999999";

const AGING_GREEN = "#22c55e";
const AGING_YELLOW = "#eab308";
const AGING_RED = "#ef4444";
const AGING_GREY = "#d1d5db";

interface FieldWithBoundary {
  id: string;
  name: string;
  hectares: number | null;
  farm_id: string;
  farm_name: string;
  boundary: any;
}

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
}

interface OperationRecord {
  operation_date: string;
  implement_id: string | null;
  start_hours: number | null;
  end_hours: number | null;
  hectares_done: number | null;
  operation_type_id: string;
  implements: { name: string } | null;
  operation_types: { name: string } | null;
}

interface TrackData {
  tracks: TrackPoint[] | TrackPoint[][];
  operations: OperationRecord[];
}

interface LegendItem {
  name: string;
  color: string;
}

function getAgingColor(daysSince: number | null, tGreen: number, tRed: number) {
  if (daysSince === null) return AGING_GREY;
  if (daysSince <= tGreen) return AGING_GREEN;
  if (daysSince <= tRed) return AGING_YELLOW;
  return AGING_RED;
}

/** Flatten GPSGate tracks (may be array of arrays or flat array) */
function flattenTrackPoints(tracks: TrackPoint[] | TrackPoint[][]): TrackPoint[] {
  if (!tracks || !Array.isArray(tracks)) return [];
  if (tracks.length === 0) return [];
  // If first element has lat, it's a flat array
  if ((tracks[0] as TrackPoint).lat !== undefined) return tracks as TrackPoint[];
  // Otherwise it's array of arrays
  return (tracks as TrackPoint[][]).flat();
}

/** Build colored segments by matching GPS points to operations by date */
function buildColoredSegments(
  points: TrackPoint[],
  operations: OperationRecord[]
): { segments: { points: [number, number][]; implementName: string; color: string; opName: string; date: string; hectares: number | null }[]; legend: LegendItem[] } {
  if (points.length === 0) return { segments: [], legend: [] };

  // Build implement color map
  const implementNames = new Set<string>();
  operations.forEach((op) => {
    if (op.implements?.name) implementNames.add(op.implements.name);
  });
  const implementColorMap = new Map<string, string>();
  const legendItems: LegendItem[] = [];
  let colorIdx = 0;
  implementNames.forEach((name) => {
    const color = IMPLEMENT_COLORS[colorIdx % IMPLEMENT_COLORS.length];
    implementColorMap.set(name, color);
    legendItems.push({ name, color });
    colorIdx++;
  });

  // Build date->operation map (first implement per date wins for simplicity)
  const dateOpMap = new Map<string, OperationRecord>();
  operations.forEach((op) => {
    const dateKey = op.operation_date.split("T")[0];
    if (!dateOpMap.has(dateKey)) {
      dateOpMap.set(dateKey, op);
    }
  });

  // Group points by date and match to implements
  const segments: { points: [number, number][]; implementName: string; color: string; opName: string; date: string; hectares: number | null }[] = [];
  let currentSegmentPoints: [number, number][] = [];
  let currentImplName = "";
  let currentColor = UNMATCHED_COLOR;
  let currentOpName = "";
  let currentDate = "";
  let currentHectares: number | null = null;

  const flushSegment = () => {
    if (currentSegmentPoints.length >= 2) {
      segments.push({
        points: [...currentSegmentPoints],
        implementName: currentImplName,
        color: currentColor,
        opName: currentOpName,
        date: currentDate,
        hectares: currentHectares,
      });
    }
    currentSegmentPoints = [];
  };

  points.forEach((pt) => {
    const pointDate = pt.timestamp?.split("T")[0] ?? "";
    const op = dateOpMap.get(pointDate);
    const implName = op?.implements?.name ?? "";
    const color = implName ? (implementColorMap.get(implName) ?? UNMATCHED_COLOR) : UNMATCHED_COLOR;

    if (implName !== currentImplName) {
      // Add last point of previous segment as first point of new for continuity
      const lastPt = currentSegmentPoints[currentSegmentPoints.length - 1];
      flushSegment();
      currentImplName = implName;
      currentColor = color;
      currentOpName = op?.operation_types?.name ?? "";
      currentDate = pointDate;
      currentHectares = op?.hectares_done ?? null;
      if (lastPt) currentSegmentPoints.push(lastPt);
    }

    currentSegmentPoints.push([pt.lng, pt.lat]);
  });
  flushSegment();

  // Add unmatched to legend if present
  if (segments.some((s) => s.color === UNMATCHED_COLOR)) {
    legendItems.push({ name: "Sin implemento", color: UNMATCHED_COLOR });
  }

  return { segments, legend: legendItems };
}

interface FieldsMapViewProps {
  expanded?: boolean;
  onExpandToggle?: () => void;
}

export function FieldsMapView({ expanded, onExpandToggle }: FieldsMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [style, setStyle] = useState<"satellite" | "streets">("satellite");

  // Aging state
  const [agingOperationTypeId, setAgingOperationTypeId] = useState<string | null>(null);
  const [thresholdGreen, setThresholdGreen] = useState(30);
  const [thresholdRed, setThresholdRed] = useState(90);

  // Track history state
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [trackLegend, setTrackLegend] = useState<LegendItem[]>([]);
  const [livePositions, setLivePositions] = useState<LivePosition[] | null>(null);
  const liveMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedField, setSelectedField] = useState<{
    id: string;
    name: string;
    farmName: string;
    hectares: number | null;
  } | null>(null);
  const { data: fields, isLoading } = useQuery({
    queryKey: ["fields-with-boundaries"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_fields_with_boundaries");
      if (error) throw error;
      return (data ?? []) as FieldWithBoundary[];
    },
  });

  // Fetch latest operation date per field for selected type
  const { data: agingOps } = useQuery({
    queryKey: ["aging-operations", agingOperationTypeId],
    enabled: !!agingOperationTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select("field_id, operation_date")
        .eq("operation_type_id", agingOperationTypeId!)
        .order("operation_date", { ascending: false });
      if (error) throw error;
      return data as { field_id: string; operation_date: string }[];
    },
  });

  // Build aging map
  const agingMap = useMemo(() => {
    if (!agingOperationTypeId || !agingOps) return null;
    const map = new Map<string, { daysSince: number; lastDate: string }>();
    const today = new Date();
    for (const op of agingOps) {
      if (!map.has(op.field_id)) {
        const parts = op.operation_date.split(/[T ]/)[0].split("-");
        const opDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        map.set(op.field_id, {
          daysSince: differenceInDays(today, opDate),
          lastDate: op.operation_date,
        });
      }
    }
    return map;
  }, [agingOperationTypeId, agingOps]);

  const { data: selectedOpType } = useQuery({
    queryKey: ["op-type-name", agingOperationTypeId],
    enabled: !!agingOperationTypeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("operation_types")
        .select("name")
        .eq("id", agingOperationTypeId!)
        .single();
      return data?.name ?? "";
    },
  });

  const fieldsWithBoundary = fields?.filter((f) => f.boundary) || [];

  // Load GPS tracks
  const handleLoadTracks = useCallback(
    async (tractorId: string, dateFrom: string, dateTo: string) => {
      // Deactivate aging mode when loading tracks
      setAgingOperationTypeId(null);
      setTrackLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        // Add time bounds so GPSGate gets full ISO datetimes
        const isoFrom = `${dateFrom}T00:00:00Z`;
        const isoTo = `${dateTo}T23:59:59Z`;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/gpsgate-proxy?action=tracks&tractorId=${tractorId}&dateFrom=${encodeURIComponent(isoFrom)}&dateTo=${encodeURIComponent(isoTo)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Error ${res.status}`);
        }

        const result: TrackData = await res.json();
        setTrackData(result);

        const flatPoints = flattenTrackPoints(result.tracks);
        if (flatPoints.length === 0) {
          toast.info("No se encontraron puntos GPS en el rango seleccionado");
          setTrackData(null);
          setTrackLegend([]);
          return;
        }

        const { legend } = buildColoredSegments(flatPoints, result.operations);
        setTrackLegend(legend);
        toast.success(`${flatPoints.length} puntos GPS cargados`);
      } catch (err: any) {
        console.error("Track load error:", err);
        toast.error(err.message || "Error al cargar recorrido GPS");
        setTrackData(null);
        setTrackLegend([]);
      } finally {
        setTrackLoading(false);
      }
    },
    []
  );

  const handleClearTracks = useCallback(() => {
    setTrackData(null);
    setTrackLegend([]);
  }, []);

  // Deactivate aging when tracks are active
  const handleAgingChange = useCallback(
    (id: string | null) => {
      if (id) {
        setTrackData(null);
        setTrackLegend([]);
      }
      setAgingOperationTypeId(id);
    },
    []
  );

  // Live positions handlers
  const handlePositionsLoaded = useCallback((positions: LivePosition[]) => {
    setLivePositions(positions);
  }, []);

  const handleClearPositions = useCallback(() => {
    setLivePositions(null);
    liveMarkersRef.current.forEach((m) => m.remove());
    liveMarkersRef.current = [];
  }, []);

  // Build track segments for rendering
  const trackSegments = useMemo(() => {
    if (!trackData) return null;
    const flatPoints = flattenTrackPoints(trackData.tracks);
    if (flatPoints.length === 0) return null;
    return buildColoredSegments(flatPoints, trackData.operations);
  }, [trackData]);

  // Helper to render live markers on a given map
  const renderLiveMarkers = useCallback((map: mapboxgl.Map, positions: LivePosition[] | null) => {
    liveMarkersRef.current.forEach((m) => m.remove());
    liveMarkersRef.current = [];

    if (!positions || positions.length === 0) return;

    positions.forEach((pos) => {
      const isMoving = pos.speed > 0.5;
      const dotColor = pos.engineOn ? (isMoving ? "#22c55e" : "#eab308") : "#94a3b8";

      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";

      const label = document.createElement("div");
      label.textContent = pos.tractorName;
      label.style.cssText = `
        font-size: 12px; font-weight: 700; color: #fff;
        background: rgba(0,0,0,0.8); padding: 2px 8px;
        border-radius: 4px; white-space: nowrap; margin-bottom: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      `;
      el.appendChild(label);

      const dot = document.createElement("div");
      dot.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: ${dotColor}; border: 3px solid #fff;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      `;
      if (isMoving) {
        dot.style.animation = "pulse 1.5s infinite";
      }
      el.appendChild(dot);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pos.lng, pos.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="color:#000">
              <strong>${pos.tractorName}</strong><br/>
              GPS: ${pos.gpsName}<br/>
              Motor: ${pos.engineOn ? "Encendido" : "Apagado"}<br/>
              Vel: ${pos.speed.toFixed(1)} km/h<br/>
              Últ. dato: ${pos.lastUpdate ? new Date(pos.lastUpdate).toLocaleString() : "—"}
            </div>`
          )
        )
        .addTo(map);

      liveMarkersRef.current.push(marker);
    });
  }, []);

  // Re-render live markers whenever positions change on the current map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !livePositions) return;

    const doRender = () => renderLiveMarkers(map, livePositions);

    if (map.loaded()) {
      doRender();
    } else {
      map.once("load", doRender);
    }

    return () => {
      liveMarkersRef.current.forEach((m) => m.remove());
      liveMarkersRef.current = [];
    };
  }, [livePositions, renderLiveMarkers]);

  useEffect(() => {
    if (!mapContainer.current || fieldsWithBoundary.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const esriSatelliteStyle: mapboxgl.StyleSpecification = {
      version: 8,
      glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
      sources: {
        "esri-world-imagery": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [
        {
          id: "esri-imagery",
          type: "raster",
          source: "esri-world-imagery",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style:
        style === "satellite"
          ? esriSatelliteStyle
          : "mapbox://styles/mapbox/streets-v12",
      center: [-70.0, 18.8],
      zoom: 10,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.on("load", () => {
      const farmIds = [...new Set(fieldsWithBoundary.map((f) => f.farm_id))];
      const farmColorMap: Record<string, string> = {};
      farmIds.forEach((id, i) => {
        farmColorMap[id] = FARM_COLORS[i % FARM_COLORS.length];
      });

      const isAgingMode = !!agingMap;
      const isTrackMode = !!trackSegments;
      // In track mode, reduce field opacity
      const fieldFillOpacity = isTrackMode ? 0.15 : 0.35;

      const features = fieldsWithBoundary.map((field) => {
        const aging = agingMap?.get(field.id) ?? null;
        const daysSince = aging?.daysSince ?? null;
        const color = isAgingMode
          ? getAgingColor(daysSince, thresholdGreen, thresholdRed)
          : farmColorMap[field.farm_id];

        return {
          type: "Feature" as const,
          properties: {
            id: field.id,
            name: field.name,
            hectares: field.hectares,
            farm_name: field.farm_name,
            color,
            days_since: daysSince,
            last_date: aging?.lastDate ?? null,
            is_aging: isAgingMode,
            op_type_name: selectedOpType ?? "",
          },
          geometry: field.boundary,
        };
      });

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      map.addSource("fields", { type: "geojson", data: geojson });

      map.addLayer({
        id: "fields-fill",
        type: "fill",
        source: "fields",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": fieldFillOpacity,
        },
      });

      map.addLayer({
        id: "fields-outline",
        type: "line",
        source: "fields",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
        },
      });

      map.addLayer({
        id: "fields-labels",
        type: "symbol",
        source: "fields",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      });

      // Add track layers if available
      if (trackSegments && trackSegments.segments.length > 0) {
        const trackBounds = new mapboxgl.LngLatBounds();

        trackSegments.segments.forEach((seg, idx) => {
          const sourceId = `track-seg-${idx}`;
          const layerId = `track-line-${idx}`;

          const lineGeoJson: GeoJSON.Feature = {
            type: "Feature",
            properties: {
              implement: seg.implementName || "Sin implemento",
              operation: seg.opName,
              date: seg.date,
              hectares: seg.hectares,
            },
            geometry: {
              type: "LineString",
              coordinates: seg.points,
            },
          };

          map.addSource(sourceId, { type: "geojson", data: lineGeoJson });

          const isUnmatched = seg.color === UNMATCHED_COLOR;

          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": seg.color,
              "line-width": 3,
              "line-opacity": 0.9,
              ...(isUnmatched ? { "line-dasharray": [2, 4] } : {}),
            } as any,
          });

          // Add click handler for track segments
          map.on("click", layerId, (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;
            const ha = props.hectares ? `${props.hectares} ha` : "—";
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="color:#000">
                  <strong>${props.implement}</strong><br/>
                  Operación: ${props.operation || "—"}<br/>
                  Fecha: ${props.date || "—"}<br/>
                  Hectáreas: ${ha}
                </div>`
              )
              .addTo(map);
          });

          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });

          seg.points.forEach((p) => trackBounds.extend(p as [number, number]));
        });

        // Fit to track bounds
        if (!trackBounds.isEmpty()) {
          map.fitBounds(trackBounds, { padding: 80 });
        }
      }

      // Field click handler – open side panel
      map.on("click", "fields-fill", (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        setSelectedField({
          id: props.id,
          name: props.name,
          farmName: props.farm_name,
          hectares: props.hectares ?? null,
        });
      });

      map.on("mouseenter", "fields-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "fields-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Fit to field bounds if no tracks
      if (!trackSegments || trackSegments.segments.length === 0) {
        const bounds = new mapboxgl.LngLatBounds();
        features.forEach((f) => {
          const coords = f.geometry.coordinates.flat(2) as [number, number][];
          coords.forEach((c) => bounds.extend(c));
        });
        if (livePositions && livePositions.length > 0) {
          livePositions.forEach((p) => bounds.extend([p.lng, p.lat]));
        }
        map.fitBounds(bounds, { padding: 60 });
      }

      // Re-add live markers after map recreation
      renderLiveMarkers(map, livePositions);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fieldsWithBoundary, style, agingMap, thresholdGreen, thresholdRed, selectedOpType, trackSegments, livePositions, renderLiveMarkers]);

  if (isLoading) {
    return <div className="text-center py-8">Loading map data...</div>;
  }

  if (fieldsWithBoundary.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No field boundaries"
        description="Import KML/KMZ boundaries from the Farms & Fields tab to see them on the map."
      />
    );
  }

  return (
    <div className="space-y-2">
      <MapAgingControls
        style={style}
        onStyleToggle={() => setStyle((s) => (s === "satellite" ? "streets" : "satellite"))}
        agingOperationTypeId={agingOperationTypeId}
        onAgingOperationTypeChange={handleAgingChange}
        thresholdGreen={thresholdGreen}
        onThresholdGreenChange={setThresholdGreen}
        thresholdRed={thresholdRed}
        onThresholdRedChange={setThresholdRed}
        expanded={expanded}
        onExpandToggle={onExpandToggle}
      />
      <TrackHistoryControls
        onLoadTracks={handleLoadTracks}
        onClearTracks={handleClearTracks}
        isLoading={trackLoading}
        hasActiveTracks={!!trackData}
      />
      <LivePositionsControl
        onPositionsLoaded={handlePositionsLoaded}
        onClear={handleClearPositions}
        isActive={!!livePositions}
      />
      <div className="relative">
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.7; }
          }
        `}</style>
        <div
          ref={mapContainer}
          className="w-full rounded-lg border"
          style={{ height: expanded ? "calc(100vh - 4rem)" : "70vh" }}
        />
        <TrackLegend items={trackLegend} />
        {selectedField && (
          <FieldHistoryPanel
            fieldId={selectedField.id}
            fieldName={selectedField.name}
            farmName={selectedField.farmName}
            hectares={selectedField.hectares}
            onClose={() => setSelectedField(null)}
          />
        )}
      </div>
    </div>
  );
}
