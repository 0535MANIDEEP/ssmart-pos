# SS Mart POS — Design System & UI Guidelines

## 1. Spacing System (4px Base Grid)

All spacing values must be multiples of 4px for pixel-perfect rendering at 1x, 2x, 3x densities.

### Spacing Tokens

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `space-0` | 0px | `p-0` / `m-0` | Reset |
| `space-xs` | 4px | `p-1` / `m-1` | Icon-to-text gaps, tight inner padding |
| `space-sm` | 8px | `p-2` / `m-2` | Inline element gaps, small internal padding |
| `space-md` | 12px | `p-3` / `m-3` | Input padding, compact component gaps |
| `space-lg` | 16px | `p-4` / `m-4` | Card padding, button padding, standard gaps |
| `space-xl` | 24px | `p-6` / `m-6` | Section spacing, form field gaps |
| `space-2xl` | 32px | `p-8` / `m-8` | Large sections, major divisions |
| `space-3xl` | 48px | `p-12` / `m-12` | Page margins, hero spacing |
| `space-4xl` | 64px | `p-16` / `m-16` | Major section dividers |

### POS-Specific Spacing Rules

| Element | Gap/Padding | Notes |
|---------|-------------|-------|
| Product grid card gap | 12-16px | Tight to fit more products |
| Cart item gap | 8px | Compact, scannable |
| Sidebar padding | 16px horizontal, 12px vertical | Between nav items |
| Main content padding | 24px all sides | Generous breathing room |
| Form field spacing | 16-24px vertical | Between fields |
| Modal padding | 24-32px internal | Comfortable reading |
| Button padding (primary) | 12px vertical, 24px horizontal | Large touch target |
| Button padding (secondary) | 8px 16px | Smaller but still accessible |

---

## 2. Typography Scale

### Type Scale (Major Third — 1.250 ratio)

| Token | Size | Weight | Line Height | Tailwind | Usage |
|-------|------|--------|-------------|----------|-------|
| `text-xs` | 12px | 400 | 16px (1.33) | `text-xs` | Captions, helper text, timestamps |
| `text-sm` | 14px | 400 | 20px (1.43) | `text-sm` | Secondary text, labels, table data |
| `text-base` | 16px | 400 | 24px (1.5) | `text-base` | Body text, prices (default) |
| `text-lg` | 18px | 500 | 28px (1.56) | `text-lg` | Emphasized text, nav items |
| `text-xl` | 20px | 500 | 28px (1.4) | `text-xl` | Card titles, subsection headers |
| `text-2xl` | 24px | 600 | 32px (1.33) | `text-2xl` | Section headers, page subtitles |
| `text-3xl` | 30px | 600 | 36px (1.2) | `text-3xl` | Page titles |
| `text-4xl` | 36px | 700 | 40px (1.11) | `text-4xl` | Grand totals, hero numbers |

### POS-Specific Typography

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Product name (card) | 14px | 500 | Max 2 lines with ellipsis |
| Price display | 18-22px | 600-700 | Use monospace/tabular nums |
| Cart item name | 14px | 400 | Truncate with ellipsis |
| Cart total | 20-24px | 700 | Bold, high contrast |
| Button text | 14-16px | 500-600 | Medium to semibold |
| Input field text | 14-16px | 400 | Regular weight |
| Navigation labels | 14px | 500 | Medium weight |
| Table headers | 12px | 500 | Uppercase, letter-spacing 0.05em |

### Font Rules
- **Primary font:** Geist Sans (already in project)
- **Monospace font:** Geist Mono (for prices, codes)
- **Limit to 2 font families** maximum
- **Limit to 3-4 font weights:** 400, 500, 600, 700
- **Use tabular numbers** (`font-variant-numeric: tabular-nums`) for all price/quantity displays

---

## 3. Color System

### WCAG Contrast Requirements

| Element | Min Ratio (AA) | Enhanced (AAA) |
|---------|---------------|-----------------|
| Body text (< 18pt) | 4.5:1 | 7:1 |
| Large text (≥ 18pt or 14pt bold) | 3:1 | 4.5:1 |
| UI components & icons | 3:1 | N/A |

### Light Mode Tokens

| Token | Hex | Usage | Contrast on White |
|-------|-----|-------|-------------------|
| `--background` | `#F8F9FA` | Page background | — |
| `--foreground` | `#1A1D21` | Primary text | 16.75:1 ✓ |
| `--surface` | `#FFFFFF` | Cards, panels | — |
| `--surface-muted` | `#F1F3F5` | Hover states, alternating rows | — |
| `--border` | `#DEE2E6` | Dividers, card borders | 3.03:1 ✓ |
| `--border-strong` | `#ADB5BD` | Input borders, focus rings | 4.08:1 ✓ |
| `--text-secondary` | `#495057` | Secondary labels, captions | 7.13:1 ✓ |
| `--text-tertiary` | `#868E96` | Placeholders, disabled | 3.47:1 (large only) |
| `--brand` | `#4263EB` | Primary actions, links | 4.67:1 ✓ |
| `--brand-hover` | `#3B5BDB` | Primary button hover | 5.89:1 ✓ |
| `--brand-light` | `#EDF2FF` | Active nav item background | — |
| `--danger` | `#E03131` | Errors, delete, out-of-stock | 4.63:1 ✓ |
| `--danger-light` | `#FFF5F5` | Error backgrounds | — |
| `--success` | `#2F9E44` | Payment success, in-stock | 3.45:1 (use for large only) |
| `--success-light` | `#EBFBEE` | Success backgrounds | — |
| `--warning` | `#F08C00` | Low stock, alerts | 3.08:1 (use for large only) |
| `--warning-light` | `#FFF9DB` | Warning backgrounds | — |
| `--info` | `#1C7ED6` | Informational badges | 4.56:1 ✓ |

### Dark Mode Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#1A1D21` | Page background |
| `--foreground` | `#F1F3F5` | Primary text |
| `--surface` | `#25262B` | Cards, panels |
| `--surface-muted` | `#2C2E33` | Hover states |
| `--border` | `#373A40` | Dividers |
| `--border-strong` | `#5C5F66` | Input borders |
| `--text-secondary` | `#909296` | Secondary text |
| `--text-tertiary` | `#5C5F66` | Placeholders |
| `--brand` | `#5C7CFA` | Primary actions |
| `--brand-light` | `#1A1D2E` | Active nav background |
| `--danger` | `#FF6B6B` | Errors |
| `--success` | `#51CF66` | Success |
| `--warning` | `#FFD43B` | Warnings |

### POS-Specific Color Rules
- **Primary action color:** One consistent brand color for CTAs (Add to Cart, Pay Now)
- **Error/success:** Red for destructive, green for success. Never rely on color alone (add icons)
- **Price color:** Primary text color (high contrast). Sale prices in danger/red color
- **Sidebar:** Dark sidebar (`#1A1D21`) with white text works well for POS
- **Avoid pure `#000000` and `#FFFFFF`** in dark mode to prevent halation

---

## 4. Elevation / Shadow System

### Shadow Levels

| Level | CSS Value | Tailwind | Usage |
|-------|-----------|----------|-------|
| `shadow-0` | None | `shadow-none` | Flat surfaces, backgrounds |
| `shadow-1` | `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)` | `shadow-sm` | Resting cards, input fields |
| `shadow-2` | `0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)` | `shadow-md` | Raised buttons, search bars, dropdowns |
| `shadow-4` | `0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)` | `shadow-lg` | App bars, sticky headers, cart panel |
| `shadow-8` | `0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)` | `shadow-xl` | FABs, floating cards |
| `shadow-16` | `0 16px 32px rgba(0,0,0,0.25), 0 16px 32px rgba(0,0,0,0.22)` | `shadow-2xl` | Navigation drawers |
| `shadow-24` | `0 24px 48px rgba(0,0,0,0.30), 0 24px 48px rgba(0,0,0,0.22)` | — | Dialogs, modals |

### POS Element Elevation Map

| Element | Elevation | Shadow |
|---------|-----------|--------|
| Page background | 0 | None |
| Cards (resting) | 1 | `shadow-sm` |
| Cards (hover) | 2 | `shadow-md` |
| Search bar | 1 | `shadow-sm` |
| Sidebar | 4 | `shadow-lg` |
| Cart panel | 2 | `shadow-md` |
| Dropdown menu | 4 | `shadow-lg` |
| Modal backdrop | — | `rgba(0,0,0,0.5)` |
| Modal dialog | 16 | `shadow-2xl` |
| Toast notification | 8 | `shadow-xl` |
| FAB (floating action) | 8 | `shadow-xl` |

### Hover Lift Effect
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-2);
}
```

---

## 5. Border Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `radius-sm` | 4px | `rounded-sm` | Badges, chips, small tags |
| `radius-md` | 8px | `rounded-md` | Buttons, input fields, cards |
| `radius-lg` | 12px | `rounded-lg` | Modals, large cards, panels |
| `radius-xl` | 16px | `rounded-xl` | Bottom sheets, feature cards |
| `radius-full` | 9999px | `rounded-full` | Avatars, pills, status dots |

### POS Element Radius Map

| Element | Radius | Notes |
|---------|--------|-------|
| Cards | 12px (`rounded-lg`) | Consistent card feel |
| Buttons | 8px (`rounded-md`) | Slightly rounded |
| Input fields | 8px (`rounded-md`) | Matches buttons |
| Modals | 12px (`rounded-lg`) | Distinct from cards |
| Product grid tiles | 8px (`rounded-md`) | Tight, compact |
| Navigation items | 8px (`rounded-md`) | Active state background |
| Toast notifications | 8px (`rounded-md`) | Consistent |
| Dropdown menus | 8px (`rounded-md`) | Matches buttons |
| Status badges | 9999px (`rounded-full`) | Pill shape |
| Avatars | 9999px (`rounded-full`) | Circle |

---

## 6. Button Design

### Button Sizes

| Type | Height | Padding | Font | Tailwind | Usage |
|------|--------|---------|------|----------|-------|
| XL (Touch Primary) | 56px | 16px 32px | 16px SemiBold | `h-14 px-8 text-lg font-semibold` | "END SALE", "Pay Now" |
| Large (Primary) | 48px | 12px 24px | 14-16px SemiBold | `h-12 px-6 text-base font-semibold` | Primary CTAs |
| Medium (Default) | 40px | 8px 16px | 14px Medium | `h-10 px-4 text-sm font-medium` | Standard actions |
| Small | 32px | 4px 12px | 12-13px Medium | `h-8 px-3 text-xs font-medium` | Inline actions, table rows |
| Icon Button | 40px | 8px | 18-20px icon | `h-10 w-10` | Toolbar actions |

### Button Variants (Update Current System)

| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| **Primary** | `--brand` (#4263EB) | White | None | Darken 10% |
| **Secondary** | `--surface` (#FFF) | `--foreground` | 1px `--border` | `--surface-muted` |
| **Danger** | `--danger` (#E03131) | White | None | Darken 10% |
| **Ghost** | Transparent | `--foreground` | None | `--surface-muted` |
| **Success** | `--success` (#2F9E44) | White | None | Darken 10% |

### Button States
```css
.btn {
  /* Base */
  min-height: 40px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 150ms ease;
  
  /* Focus */
  outline: 3px solid var(--brand);
  outline-offset: 2px;
  
  /* Active/Pressed */
  transform: scale(0.97);
}
```

### Fitts's Law for POS
- **Primary actions** should be large, close to natural hand/cursor position
- **Bottom-right** is prime real estate for terminal actions (Pay, Submit) on desktop
- **Bottom-center** for touch devices (thumb zone)
- **Group related buttons** close together (Save + Cancel)
- **Destructive actions** separated from primary actions with visual distance

---

## 7. Sidebar Navigation

### Layout Specifications

| State | Width | Usage |
|-------|-------|-------|
| Expanded | 240px | Standard POS view |
| Collapsed (icon-only) | 64px | Maximizing content area |
| Hidden (fullscreen) | 0px | Billing mode |
| Mobile (< 768px) | Full overlay | Responsive |

### Sidebar Structure
```
┌────────────────────────────────┐
│  ┌──────┐                      │
│  │ Logo │ Shop Name            │  ← Fixed top, 64px height
│  └──────┘                      │
├────────────────────────────────┤
│  ▸ Dashboard        [icon]    │  ← Nav items, 48px height
│  ▸ POS Checkout     [icon]    │  ← Most-used, top position
│  ▸ Customers        [icon]    │
│  ▸ Inventory        [icon]    │
│  ▸ Sales            [icon]    │
│  ──────────────────────────── │  ← Divider (1px, --border)
│  ▸ Settings         [icon]    │  ← Secondary group
│                                │
│                                │
│                                │  ← Flexible spacer
├────────────────────────────────┤
│  ┌──────┐                      │
│  │User  │ Name                 │  ← Fixed bottom, 64px height
│  │Avatar│ Role                 │
│  └──────┘                      │
│  [Collapse] [Logout]           │
└────────────────────────────────┘
```

### Nav Item Spec
- **Height:** 48px (touch-friendly)
- **Padding:** 12px horizontal, 0 vertical
- **Icon:** 20px, 24px from left edge
- **Label:** 14px Medium, 48px from left edge
- **Active state:** `--brand-light` background, `--brand` text + icon
- **Hover state:** `--surface-muted` background
- **Border radius:** 8px on all sides
- **Gap between items:** 4px

### Collapsed State
- Width: 64px
- Icons centered (24px from left, 20px icon)
- Labels hidden
- Tooltips on hover (300ms delay, `shadow-2` background)
- Shop logo shrinks to icon-only (32x32px)

---

## 8. Card Design

### Card Spec
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-1);
  transition: box-shadow 200ms ease, transform 200ms ease;
}

.card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);  /* Optional: for interactive cards */
}
```

### Card Types

| Type | Padding | Shadow | Border | Usage |
|------|---------|--------|--------|-------|
| **Default** | 16px | `shadow-1` | 1px `--border` | General content |
| **Elevated** | 16px | `shadow-2` | None | Floating panels, cart |
| **Inset** | 12px | None | 1px `--border` | Nested content |
| **Interactive** | 16px | `shadow-1` → `shadow-2` on hover | 1px `--border` | Clickable cards |

### Card Gaps in Grid
- **Product grid:** 12px gap (tight, more products visible)
- **Dashboard cards:** 16px gap (standard)
- **Settings cards:** 24px gap (spacious)

---

## 9. Modal/Dialog Design

### Modal Spec

| Property | Value | Notes |
|----------|-------|-------|
| Backdrop | `rgba(0, 0, 0, 0.5)` | Semi-transparent black |
| Backdrop blur | `blur(4px)` | Optional, modern browsers |
| Max width | 560px | Standard modals |
| Max width (large) | 720px | Complex forms |
| Min width | 400px | Prevents too narrow |
| Padding | 24-32px | Internal content |
| Border radius | 12px | Matches cards |
| Shadow | `shadow-24` | Maximum elevation |
| Position | Center of viewport | Fixed positioning |

### Modal Animation
```css
/* Backdrop */
.modal-backdrop {
  opacity: 0;
  transition: opacity 200ms ease-out;
}
.modal-backdrop.active {
  opacity: 1;
}

/* Dialog */
.modal-dialog {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-dialog.active {
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

### Modal Focus Management
1. **Trap focus** inside modal (Tab cycles within)
2. **Return focus** to triggering element on close
3. **Escape key** always closes modal
4. **Click outside** closes non-destructive modals
5. **First focusable element** receives focus on open

---

## 10. Form Design

### Input Spec
```css
.input {
  height: 44px;           /* Touch-friendly */
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 14px;
  color: var(--foreground);
  background: var(--surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.15);
  outline: none;
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

### Label Placement
- **Above field** for POS forms (fastest completion, 50ms eye movement)
- **4-8px gap** between label and input
- **14px Regular** for label text
- **Color:** `--text-secondary` (#495057)

### Error Messages
- **Position:** Below the input, 8px gap
- **Color:** `--danger` (#E03131)
- **Size:** 12px Regular
- **Icon:** ⚠ before text
- **Validate on blur** (not on every keystroke)

### Form Field Spacing
- **Between fields:** 16-24px vertical gap
- **Between label groups:** 16px
- **Between sections:** 24-32px

---

## 11. Data Table Design

### Table Spec

| Property | Value | Notes |
|----------|-------|-------|
| Row height (compact) | 36px | Dense data, inventory |
| Row height (default) | 44px | Standard tables |
| Row height (relaxed) | 52px | Tables with secondary info |
| Cell padding | 12px horizontal, 10px vertical | |
| Header height | 44px | Same as default row |
| Header background | `--surface-muted` | Distinct from rows |
| Sticky header | Yes | `position: sticky; top: 0` |
| Border bottom | 1px `--border` | On each row |

### Table Styling Rules

**Alignment:**
- Text columns: **Left-aligned** (natural reading flow)
- Numbers/currency: **Right-aligned** (easy comparison)
- Dates: **Left-aligned** or center
- Status badges: **Left-aligned** or center
- Action buttons: **Right-aligned** (consistent endpoint)

**Row States:**
- **Default:** `--surface` background
- **Hover:** `--surface-muted` background
- **Selected:** `--brand-light` background (8% opacity)
- **Alternating:** `--surface-muted` on even rows (optional, use 1px border instead)

**Scrolling:**
- Horizontal scroll: Always provide
- Sticky header: Always visible
- Show row count and pagination info

---

## 12. POS Screen Layout

### Three-Column Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  [Search..................]  [Auto-save ●] [⏻]      │  ← Top bar: 56px
├──────────┬──────────────────────────┬───────────────────────┤
│          │                          │                       │
│  SIDE    │   MAIN CONTENT           │   CHECKOUT PANEL      │
│  BAR     │   (Product Grid / Cart)  │   (Customer, Payment) │
│          │                          │                       │
│  240px   │   Flex: 1 (fills space)  │   360-400px           │
│          │                          │                       │
│  Nav     │   ┌─────┐ ┌─────┐       │   Customer Info       │
│  Items   │   │Prod │ │Prod │       │   Discount            │
│          │   │Grid │ │Grid │       │   Payment Method      │
│          │   └─────┘ └─────┘       │   Returns             │
│          │   ┌─────┐ ┌─────┐       │   ─────────────────   │
│          │   │Prod │ │Prod │       │   Totals              │
│          │   │Grid │ │Grid │       │                       │
│          │   └─────┘ └─────┘       │   [ ===== END SALE ===]│
│          │                          │                       │
└──────────┴──────────────────────────┴───────────────────────┘
```

### Layout Dimensions

| Element | Width/Height | Notes |
|---------|--------------|-------|
| Top bar | 56px height | Fixed, full width |
| Sidebar | 240px (expanded), 64px (collapsed) | Fixed left |
| Main content | `calc(100% - sidebar - checkout)` | Flex: 1 |
| Checkout panel | 360-400px | Fixed right |
| Bill tabs bar | 48px height | Below top bar |

### Information Hierarchy
1. **Primary zone (center):** Product selection — most frequent action
2. **Secondary zone (right):** Cart summary + payment — always visible
3. **Tertiary zone (left):** Navigation — accessible but not dominant
4. **Top bar:** Search + user context + auto-save indicator

---

## 13. Touch vs Mouse Considerations

| Aspect | Mouse/Keyboard | Touch |
|--------|---------------|-------|
| Min target size | 24×24px | 44×44px |
| Target spacing | 4-8px | 8-12px |
| Hover states | Essential | Not applicable |
| Cursor precision | ~1-3px | ~7-10mm |
| Scrolling | Scroll wheel | Swipe gestures |

### POS Touch Rules
- **Product grid tiles:** Minimum 48×48px touch area
- **Quantity +/- controls:** 44px minimum, 8px gap
- **Number pad:** 56px minimum height
- **Provide active/pressed states** (background darken, scale 0.98)
- **Avoid tiny close buttons** — 44px minimum

---

## 14. Animation Guidelines

### Timing Functions
| Name | Value | Usage |
|------|-------|-------|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entering elements |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting elements |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Modals, dialogs (slight overshoot) |

### Duration Guidelines
| Type | Duration | Usage |
|------|----------|-------|
| Micro | 100-150ms | Button press, hover, focus |
| Short | 200-250ms | Modal open/close, tooltip |
| Medium | 300-350ms | Page transitions, layout changes |
| Long | 400-500ms | Complex animations, celebrations |

### POS Animation Rules
- **No animation on primary actions** (scanning items should be instant)
- **Subtle animation on secondary UI** (modals, toasts, panels)
- **Auto-save indicator:** Pulse animation when saving, solid when saved
- **Error shake:** 300ms horizontal shake on validation errors
- **Respect `prefers-reduced-motion`** — disable non-essential animations

---

## 15. Focus Indicator Spec

```css
:focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 2px;
}

/* Two-color technique for maximum contrast */
*:focus-visible {
  outline: 2px #FFFFFF solid;      /* Inner band */
  outline-offset: 0;
  box-shadow: 0 0 0 4px #193146;  /* Outer band */
}
```

### Focus Rules
- **Always visible** for keyboard users
- **Never visible** for mouse users (`:focus-visible` not `:focus`)
- **3px minimum** thickness
- **3:1 contrast** against adjacent colors
- **2px offset** from element edge

---

## 16. WCAG Compliance Checklist

- [ ] All text meets 4.5:1 contrast ratio (AA)
- [ ] Large text meets 3:1 contrast ratio
- [ ] UI components meet 3:1 contrast ratio
- [ ] Touch targets are 44×44px minimum
- [ ] Focus indicators are visible (3px, 3:1 contrast)
- [ ] Text spacing can be overridden (1.5× line height, 2× paragraph spacing)
- [ ] Content reflows at 400% zoom (320px width)
- [ ] No information conveyed by color alone
- [ ] Error messages are descriptive and accessible
- [ ] Form fields have associated labels
- [ ] Modals trap focus and return focus on close
- [ ] Animations respect `prefers-reduced-motion`

---

## 17. Quick Quantity Input System

### Problem
Customer wants 10 of an item → clicking + 10 times is slow, annoying, error-prone.

### Solution: Three-Layer Quantity Input

**Layer 1: Clickable Quantity Number**
- Click/tap on the quantity number in cart row → becomes editable input
- Type exact quantity → press Enter → done
- Arrow keys to increment/decrement after clicking

**Layer 2: Quick Preset Buttons**
- When quantity is clicked, show a popover with common presets:
  ```
  [1] [2] [3] [5] [10] [20] [50]
  ```
- One tap to set quantity
- Plus a custom input field for any other number

**Layer 3: Keyboard Shortcuts**
- When cart row is focused, type digits directly to set quantity
- Press Enter to confirm
- Press Escape to cancel

### Visual Design

**Normal state:**
```
┌─────────────────────────────────────────────────────┐
│ Item         │ Qty │ Price    │ Total   │          │
├──────────────┼─────┼──────────┼─────────┼──────────┤
│ Aashirvaad.. │ [10]│ ₹265     │ ₹2,650  │ [🗑]     │
│ Fortune..    │  1  │ ₹189     │ ₹189    │ [🗑]     │
└──────────────┴─────┴──────────┴─────────┴──────────┘
```

**When quantity "10" is clicked:**
```
┌─────────────────────────────────────────────────────┐
│ Item         │ Qty                     │ Price      │
├──────────────┼─────────────────────────┼────────────┤
│ Aashirvaad.. │ ┌─────────────────────┐ │ ₹265       │
│              │ │ [1] [2] [3] [5]     │ │            │
│              │ │ [10] [20] [50] [__] │ │            │
│              │ └─────────────────────┘ │            │
│ Fortune..    │  1                      │ ₹189       │
└──────────────┴─────────────────────────┴────────────┘
```

### Component Spec: QuantityPopover

| Property | Value | Notes |
|----------|-------|-------|
| Trigger | Click on quantity number | Not just +/- buttons |
| Width | 200px | Compact popover |
| Preset buttons | 1, 2, 3, 5, 10, 20, 50 | Common grocery quantities |
| Button size | 40×40px each | Touch-friendly |
| Custom input | Number input below presets | For any quantity |
| Close on | Enter, click outside, Escape | Multiple dismiss paths |
| Max quantity | Product stock limit | Show warning if exceeded |

### Keyboard Flow (MARG-Style)
1. Scan item → added to cart with qty 1
2. Press `↓` or click → focus moves to quantity field
3. Type `10` → quantity shows "10"
4. Press `Enter` → quantity confirmed, focus returns to search
5. Or: Press `↓` → move to next cart item

### Quantity Input States

| State | Visual | Behavior |
|-------|--------|----------|
| **Display** | Plain number, centered | Click to edit |
| **Hover** | Number + subtle border | Shows it's clickable |
| **Editing** | Input field + preset popover | Type or click preset |
| **Confirming** | Brief green flash | Quantity saved |
| **Error** | Red border + shake | Stock exceeded |

### Preset Button Grid
```
┌─────────────────────────────────────┐
│  Quick Quantity                     │
│  ┌────┬────┬────┬────┬────┬────┐   │
│  │ 1  │ 2  │ 3  │ 5  │ 10 │ 20 │   │
│  └────┴────┴────┴────┴────┴────┘   │
│  ┌────┬────────────────────────┐   │
│  │ 50 │ Custom: [________]     │   │
│  └────┴────────────────────────┘   │
└─────────────────────────────────────┘
```

### Touch vs Mouse Behavior

| Input | Touch | Mouse |
|-------|-------|-------|
| Quantity click | Opens popover with presets | Opens popover with presets |
| Preset button | Tap to set | Click to set |
| Custom input | Opens numeric keypad | Focus for keyboard input |
| +/- buttons | Long press for repeat | Click for single increment |

### Accessibility
- `aria-label="Set quantity for [product name]"` on quantity button
- `aria-live="polite"` on quantity display for screen reader announcements
- `role="spinbutton"` on quantity input
- Keyboard: Arrow keys to increment/decrement when focused
- Min: 1, Max: product stock
- Show "Out of stock" message if max reached
