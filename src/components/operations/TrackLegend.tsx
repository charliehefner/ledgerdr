interface LegendItem {
  name: string;
  color: string;
}

interface TrackLegendProps {
  items: LegendItem[];
}

export function TrackLegend({ items }: TrackLegendProps) {
  if (items.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 bg-card/95 border rounded-lg shadow-lg p-3 z-10 max-w-[220px]">
      <h4 className="text-xs font-semibold text-foreground mb-2">Implementos</h4>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="inline-block w-5 h-1 rounded-full"
              style={{
                backgroundColor: item.color,
                border: item.color === "#999999" ? "1px dashed #666" : "none",
              }}
            />
            <span className="text-xs text-foreground truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
