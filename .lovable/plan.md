

# Fullscreen Map Toggle

## What Changes

When viewing the **Map** tab, an **expand button** will appear that hides the page header (title/subtitle) and tab bar, allowing the map to fill nearly the entire screen. A **collapse button** on the map controls will restore the normal layout.

## How It Works

1. **FieldsMapView** gets a new `expanded` state and an expand/collapse toggle button (using the `Maximize2` / `Minimize2` icons from lucide) placed alongside the existing satellite/streets toggle in `MapAgingControls`.

2. When expanded:
   - The map container height changes from `70vh` to `calc(100vh - 2rem)` (nearly full screen)
   - The parent layout hides the page header and tab bar using a callback

3. **TabbedPageLayout** gets an optional `hideChrome` prop. When `true`, the `<header>` and `<TabsList>` are hidden (via `className="hidden"`), leaving only the tab content visible.

4. **Operations page** passes the expand state down: the Map tab content receives an `onExpandToggle` callback, and Operations holds the `expanded` state, passing `hideChrome={expanded}` to `TabbedPageLayout`.

## Technical Details

### File: `src/components/layout/TabbedPageLayout.tsx`
- Add optional `hideChrome?: boolean` prop
- Conditionally apply `hidden` class to the `<header>` and `<TabsList>` when `hideChrome` is true

### File: `src/pages/Operations.tsx`
- Add `const [mapExpanded, setMapExpanded] = useState(false)` state
- Pass `hideChrome={mapExpanded}` to `TabbedPageLayout`
- Pass `expanded` and `onExpandToggle` props to `FieldsMapView`
- Reset `mapExpanded` to `false` when switching away from the "map" tab

### File: `src/components/operations/FieldsMapView.tsx`
- Accept `expanded?: boolean` and `onExpandToggle?: () => void` props
- Pass `expanded` and `onExpandToggle` to `MapAgingControls`
- Change map container height: `expanded ? "calc(100vh - 4rem)" : "70vh"`

### File: `src/components/operations/MapAgingControls.tsx`
- Accept `expanded?: boolean` and `onExpandToggle?: () => void` props
- Add an expand/collapse icon button next to the satellite/streets toggle using `Maximize2` (expand) and `Minimize2` (collapse) icons

