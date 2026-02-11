import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Map as MapIcon } from "lucide-react";
import { differenceInDays } from "date-fns";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapAgingControls } from "./MapAgingControls";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY2hhcmxlc2hlZm5lcmpvcmQiLCJhIjoiY21saWx4YjJyMDRtZDNmb3B5dzZwenBxZiJ9.k8mtyT5Xip_xmjOv0sN8WQ";

const FARM_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
  "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
];

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

function getAgingColor(daysSince: number | null, tGreen: number, tRed: number) {
  if (daysSince === null) return AGING_GREY;
  if (daysSince <= tGreen) return AGING_GREEN;
  if (daysSince <= tRed) return AGING_YELLOW;
  return AGING_RED;
}

export function FieldsMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [style, setStyle] = useState<"satellite" | "streets">("satellite");

  // Aging state
  const [agingOperationTypeId, setAgingOperationTypeId] = useState<string | null>(null);
  const [thresholdGreen, setThresholdGreen] = useState(30);
  const [thresholdRed, setThresholdRed] = useState(90);

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

  // Build aging map: field_id -> { daysSince, lastDate }
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

  // Fetch operation type name for popup
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

  useEffect(() => {
    if (!mapContainer.current || fieldsWithBoundary.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style:
        style === "satellite"
          ? "mapbox://styles/mapbox/satellite-streets-v12"
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
          "fill-opacity": 0.35,
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

      map.on("click", "fields-fill", (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const ha = props.hectares ? `${props.hectares} ha` : "—";
        let agingHtml = "";
        if (props.is_aging) {
          if (props.days_since !== null && props.days_since !== undefined && props.last_date) {
            const dateStr = String(props.last_date).split("T")[0];
            agingHtml = `<br/><strong>${props.op_type_name}:</strong> hace ${props.days_since} días (${dateStr})`;
          } else {
            agingHtml = `<br/><strong>${props.op_type_name}:</strong> Sin registro`;
          }
        }
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#000"><strong>${props.name}</strong><br/>Finca: ${props.farm_name}<br/>Área: ${ha}${agingHtml}</div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "fields-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "fields-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      const bounds = new mapboxgl.LngLatBounds();
      features.forEach((f) => {
        const coords = f.geometry.coordinates.flat(2) as [number, number][];
        coords.forEach((c) => bounds.extend(c));
      });
      map.fitBounds(bounds, { padding: 60 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fieldsWithBoundary, style, agingMap, thresholdGreen, thresholdRed, selectedOpType]);

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
        onAgingOperationTypeChange={setAgingOperationTypeId}
        thresholdGreen={thresholdGreen}
        onThresholdGreenChange={setThresholdGreen}
        thresholdRed={thresholdRed}
        onThresholdRedChange={setThresholdRed}
      />
      <div
        ref={mapContainer}
        className="w-full rounded-lg border"
        style={{ height: "70vh" }}
      />
    </div>
  );
}
