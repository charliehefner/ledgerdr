

## Visual Polish: Making the UI Look More Commercial

The current design is functionally solid — clean typography, consistent spacing, good color system. What's missing are the subtle details that make commercial SaaS products feel premium. Here's a focused plan:

### 1. Richer Shadows and Depth

**Cards** currently use `shadow-sm`. Commercial apps use layered, softer shadows.

- Update `Card` component: `shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]` with `hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)]` transition
- Add `transition-shadow duration-200` for smooth hover effects

### 2. Sidebar Polish

The dark sidebar is a good foundation but feels flat.

- Add a subtle gradient: `bg-gradient-to-b from-[hsl(210,24%,16%)] to-[hsl(210,24%,12%)]`
- Active nav item: add a left border accent (`border-l-2 border-primary`) instead of just background change
- User avatar: add a ring/glow (`ring-2 ring-primary/30`) for visual interest
- Logo area: subtle bottom shadow instead of hard border

### 3. Header Bar Upgrade

- Add a subtle bottom shadow (`shadow-[0_1px_3px_rgba(0,0,0,0.05)]`) instead of just `border-b`
- Breadcrumb-style page title with slightly smaller, lighter text
- User dropdown: avatar with initials in a colored circle (already exists, but add subtle ring)

### 4. Button Refinements

- Primary buttons: add subtle gradient `bg-gradient-to-b from-primary to-primary/90` with inner shadow
- All buttons: slightly increase font-weight and letter-spacing for crispness
- Add `active:scale-[0.98]` micro-interaction on click

### 5. Input Fields

- Increase border radius slightly and add `focus:shadow-[0_0_0_3px_rgba(30,111,92,0.1)]` for a glowing focus ring
- Slightly taller inputs (h-11 instead of h-10) for comfort

### 6. Table Upgrades

- Sticky header with subtle background blur `backdrop-blur-sm bg-card/95`
- Rounded corners on the table container with overflow hidden
- Row hover: smooth left border accent animation

### 7. Login Page

- Add a subtle background pattern or gradient (e.g., radial gradient behind the card)
- Card: larger shadow, slightly more padding, subtle top accent bar in primary color

### 8. Tab Bar

- Use pill-style tabs with slightly more padding and a subtle transition animation
- Active tab: add a slight scale bump `data-[state=active]:scale-[1.02]`

### 9. CSS Token Updates (index.css)

- Refine `--background` to pure white or very faint warm grey `0 0% 99%` for a cleaner feel
- Add new tokens: `--shadow-card`, `--shadow-card-hover`, `--shadow-header`
- Add smooth global transitions: `* { transition-property: background-color, border-color, box-shadow; transition-duration: 150ms; }`

### Files to Edit

| File | Changes |
|------|---------|
| `src/index.css` | New shadow tokens, background tweak, global transition, gradient utilities |
| `src/components/ui/card.tsx` | Better shadow, hover effect, transition |
| `src/components/ui/button.tsx` | Gradient primary, active scale micro-interaction |
| `src/components/ui/input.tsx` | Taller, glow focus ring |
| `src/components/ui/tabs.tsx` | Pill refinement, scale animation |
| `src/components/layout/Sidebar.tsx` | Gradient background, active border accent, avatar ring |
| `src/components/layout/MainLayout.tsx` | Header shadow, refined spacing |
| `src/pages/Login.tsx` | Background gradient, card accent bar, enhanced shadow |
| `src/components/dashboard/StatCard.tsx` | Enhanced hover shadow |

All changes are CSS/className-level. No logic or data changes.

