import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Map as MapIcon, Satellite, Layers } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoibWFyY29zZ29kb3kiLCJhIjoiY21icTlkcGFjMTFyMzJxcTRjMDlucTY3ZCJ9.WQ4cSPqO3K9v3FswOWvJOQ";

const FARM_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
  "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
];

interface FieldWithBoundary {
  id: string;
  name: string;
  hectares: number | null;
  farm_id: string;
  farm_name: string;
  boundary: any;
}

export function FieldsMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [style, setStyle] = useState<"satellite" | "streets">("satellite");

  const { data: fields, isLoading } = useQuery({
    queryKey: ["fields-with-boundaries"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_fields_with_boundaries");
      if (error) throw error;
      return (data ?? []) as FieldWithBoundary[];
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
      // Build a color map per farm
      const farmIds = [...new Set(fieldsWithBoundary.map((f) => f.farm_id))];
      const farmColorMap: Record<string, string> = {};
      farmIds.forEach((id, i) => {
        farmColorMap[id] = FARM_COLORS[i % FARM_COLORS.length];
      });

      const features = fieldsWithBoundary.map((field) => ({
        type: "Feature" as const,
        properties: {
          id: field.id,
          name: field.name,
          hectares: field.hectares,
          farm_name: field.farm_name,
          color: farmColorMap[field.farm_id],
        },
        geometry: field.boundary,
      }));

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

      // Popup on click
      map.on("click", "fields-fill", (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        const ha = props.hectares ? `${props.hectares} ha` : "—";
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#000"><strong>${props.name}</strong><br/>Farm: ${props.farm_name}<br/>Area: ${ha}</div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "fields-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "fields-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Fit bounds
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
  }, [fieldsWithBoundary, style]);

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
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setStyle((s) => (s === "satellite" ? "streets" : "satellite"))
          }
        >
          {style === "satellite" ? (
            <>
              <Layers className="h-4 w-4 mr-2" /> Streets
            </>
          ) : (
            <>
              <Satellite className="h-4 w-4 mr-2" /> Satellite
            </>
          )}
        </Button>
      </div>
      <div
        ref={mapContainer}
        className="w-full rounded-lg border"
        style={{ height: "70vh" }}
      />
    </div>
  );
}
