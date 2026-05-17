## Problem

On the Fields map (Operaciones → Mapa), GPS track lines often blend into field fills/outlines because:
- Some implement colors (`#3cb44b` green, `#469990` teal, `#9A6324` brown) sit very close to farm/field greens and browns.
- The track line is only 3px wide with no contrasting outline, so on satellite/terrain it disappears.
- Field fills are dimmed in track mode but field outlines still use the full farm color at 2px.

## Fix (visual only, in `src/components/operations/FieldsMapView.tsx`)

1. **Add a white casing under every track segment.** Render a second line layer beneath each `track-line-*` with `line-color: #ffffff`, `line-width: 7`, `line-opacity: 0.9`. This guarantees contrast against any field fill (green, brown, beige) or basemap.
2. **Thicken the main track line** from `line-width: 3` → `5`, and bump `line-opacity` from `0.9` → `1`.
3. **Refresh the `IMPLEMENT_COLORS` palette** to remove tones that collide with field/farm greens and browns. New palette (high-saturation, map-safe):
   ```
   #e6194b (red)   #f032e6 (magenta) #f58231 (orange)
   #ffe119 (yellow) #911eb4 (purple)  #4363d8 (blue)
   #42d4f4 (cyan)   #00d084 (mint)    #ff7f50 (coral)
   #7c3aed (violet)
   ```
   Drops the muddy green, teal, and brown that caused the blending.
4. **Soften field outlines while a track is shown.** When `isTrackMode` is true, set `fields-outline` `line-opacity` to `0.4` (currently full opacity) so the track reads as the foreground layer.
5. Update the legend swatch (no code change needed — `TrackLegend` already reads `color` from the segment build).

## Out of scope

- No changes to GPS ingestion, segment-building logic, or operation-matching.
- No backend or i18n changes.
