# OptimaX ERP — Visual Identity & Design System Specification
**Role:** Creative Director & Principal Product Designer  
**Project:** OptimaX Cloud ERP Platform  
**Target Users:** SMEs, Growing Enterprises, Finance, Procurement, HR, Operations, CEOs  
**Core Purpose:** Unifying disconnected spreadsheets and fragmented tools into a single, high-trust, audited operational engine.

---

## 1. THE WINNING THEME: "Clean Lab / Precision Enterprise" (Hybrid: Clean Lab + Modern Swiss Instrument)

### Theme Selection
The winning theme is **Clean Lab / Precision Enterprise** — a surgical fusion of **Clean Lab** (clinical neutrality, micro-borders, zero visual noise, soft glare-free canvas) and **Modern Swiss Instrument** (mathematical typographic grid, tabular numeric precision, and authoritative contrast).

### Cognitive Trust & User Psychology Rationale
1. **Spreadsheet Trauma Resolution**: Users migrating from Excel or legacy systems (SAP/Sage) suffer from cognitive overload, fear of hidden calculation errors, and cluttered visual noise. "Clean Lab" provides an immediate sense of structural control and transparency.
2. **Audited Financial Confidence**: In finance, procurement, and inventory, playful or quirky styles (like Neo-Brutalist or 3D skeuomorphism) degrade perceived financial security. Clinical precision signals that calculations are audited, records are immutable, and data is mission-critical.
3. **8-Hour Daily Ergonomics**: Operational staff spend whole days in this UI. A glare-free, cool-slate canvas (`#F8FAFC`) with crisp 1px borders (`#E2E8F0`) eliminates eye fatigue while maintaining WCAG AAA/AA readability across high-density tables.
4. **Single Decisive Accent**: Rather than a rainbow of uncoordinated hues, an **Electric Cobalt / Deep Precision Blue** (`#2563EB`) commands authority for primary calls-to-action, active routes, and key status changes.

---

## 2. THE TYPOGRAPHY SYSTEM

### Font Families
* **Primary Display / Header**: `Plus Jakarta Sans`, sans-serif (Google Fonts)  
  *Characteristics:* Clean geometric construction with subtle humanist warmth. Conveys executive authority and clarity without feeling cold.
* **Secondary Body / UI**: `Inter`, sans-serif (Google Fonts / System Fallbacks)  
  *Characteristics:* The industry benchmark for UI legibility. High x-height, clear differentiation of characters (e.g. `l`, `1`, `I`), tuned for small text (11px–14px).
* **Monospace / Data**: `JetBrains Mono`, monospace (Google Fonts)  
  *Characteristics:* Designed for code and metrics. Monospaced tabular alignment ensuring numbers in financial statements, invoice totals, and inventory counts align cleanly down columns.

### Complete Type Scale & CSS Rules

| Scale Token | Font Family | Size | Line Height | Weight | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `display-2xl` | Plus Jakarta Sans | `1.75rem (28px)` | `1.2` | 700 (Bold) | `-0.03em` | Module titles, Hero stats |
| `display-xl` | Plus Jakarta Sans | `1.5rem (24px)` | `1.25` | 700 (Bold) | `-0.025em` | Page Titles, Main Shell Headers |
| `heading-lg` | Plus Jakarta Sans | `1.25rem (20px)` | `1.3` | 600 (SemiBold) | `-0.02em` | Section Headers, Modal Titles |
| `heading-md` | Plus Jakarta Sans | `1.0625rem (17px)` | `1.35` | 600 (SemiBold) | `-0.015em` | Card Headers, Group Titles |
| `body-base` | Inter | `0.875rem (14px)` | `1.5` | 400 / 500 | `-0.006em` | Standard Body, Form Inputs, Dropdowns |
| `body-sm` | Inter | `0.8125rem (13px)` | `1.45` | 400 / 500 | `0` | Dense Table Cells, Sidebar Navigation |
| `caption` | Inter | `0.75rem (12px)` | `1.4` | 500 / 600 | `+0.01em` | Badges, Helper Text, Form Labels |
| `micro` | Inter | `0.6875rem (11px)` | `1.35` | 600 (SemiBold) | `+0.02em` | Table Headers (Uppercase), Pill counters |
| `data-mono` | JetBrains Mono | `0.8125rem (13px)` | `1.4` | 500 (Medium) | `0` | Currency, SKU codes, Order IDs, Hashes |

### Core CSS Rules
```css
/* Enable advanced typographic features for tabular accounting */
.data-table, .metric-value, .currency, .sku-code {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "cv02" 1, "cv03" 1;
}

body, input, select, textarea, button {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  letter-spacing: -0.02em;
}
```

---

## 3. THE EXACT COLOR PALETTE

### Palette Specification (HEX Codes)

```
[ Canvas: #F8FAFC ]  ──> [ Card Surface: #FFFFFF ]  ──> [ Border: #E2E8F0 ]
[ Text Primary: #0F172A ]  ──> [ Text Muted: #64748B ]
[ Brand Accent: #2563EB ]  ──> [ Hover: #1D4ED8 ]  ──> [ Sub-Tint: #EFF6FF ]
[ Success: #059669 ]  [ Warning: #D97706 ]  [ Error: #DC2626 ]  [ Info: #0284C7 ]
```

### 1. Surfaces & Neutrals
* **Surface / Background (App Canvas)**: `#F8FAFC` (Slate 50 — cool, calm, anti-glare)
* **Card / Container (Elevated Surface)**: `#FFFFFF` (Pure Crisp White)
* **Sunken Well / Table Header**: `#F1F5F9` (Slate 100 — subtle contrast for secondary regions)
* **Hover State Surface**: `#F8FAFC` (Slate 50)
* **Active / Selected Surface**: `#EFF6FF` (Blue 50 — soft accent tint)

### 2. Typography Colors
* **Primary Text**: `#0F172A` (Slate 900 — high-contrast, non-harsh institutional black)
* **Secondary / Muted Text**: `#475569` (Slate 600 — form labels, table text)
* **Tertiary / Subtitle Text**: `#64748B` (Slate 500 — timestamps, secondary counters, placeholders)
* **Disabled Text**: `#94A3B8` (Slate 400)
* **Inverse Text**: `#FFFFFF` (White on brand accent buttons)

### 3. High-Contrast Brand Accent
* **Brand Accent**: `#2563EB` (Electric Cobalt 600 — decisive, vibrant, high-integrity)
* **Brand Accent Hover**: `#1D4ED8` (Cobalt 700)
* **Brand Accent Active / Focus**: `#1E40AF` (Cobalt 800)
* **Brand Accent Tint (10%)**: `#EFF6FF` (For selected tab backgrounds & active pills)
* **Brand Accent Border**: `#BFDBFE` (Cobalt 200)

### 4. Semantic Status Colors
* **Success**: `#059669` (Emerald 600) | **Bg**: `#ECFDF5` | **Border**: `#A7F3D0` (Paid, Delivered, Active, Verified)
* **Warning**: `#D97706` (Amber 600)   | **Bg**: `#FFFBEB` | **Border**: `#FDE68A` (Pending Approval, Low Stock, Due Soon)
* **Error / Danger**: `#DC2626` (Red 600) | **Bg**: `#FEF2F2` | **Border**: `#FECACA` (Overdue, Rejected, Cancelled, OOS)
* **Info**: `#0284C7` (Sky 600)        | **Bg**: `#F0F9FF` | **Border**: `#BAE6FD` (Draft, In Review, In Transit)

### 5. Architectural Borders
* **Default Border**: `#E2E8F0` (Slate 200 — razor-sharp 1px separation)
* **Subtle Inner Border**: `#F1F5F9` (Slate 100 — table row dividers)
* **Strong Border / Inputs**: `#CBD5E1` (Slate 300 — form controls and active states)

---

## 4. LAYOUT & GRID ARCHITECTURE

### Spatial Paradigm
**Structured Modular Grid with Fixed Navigation & Tabbed Shell Containers.**  
OptimaX is neither a toy chat window nor an infinite whiteboard canvas. It is a mission-critical operations center. The architecture uses:
* **Left Navigation Rail**: Fixed width (240px expanded, 64px collapsed), sunken surface (`#F8FAFC` or deep `#0F172A`).
* **Header / Utility Bar**: Sticky top (56px height) with tenant switcher, breadcrumbs, search command palette, and user avatar.
* **Workspace Body**: Fluid container with disciplined max bounds (`1600px` for wide multi-column analytics, `1280px` for transactional forms).

### Spacing & Grid Metrics
* **Base Unit**: 4px / 8px linear scale.
* **Page Padding**: `24px` (`1.5rem`) on desktop; `16px` on tablet/mobile.
* **Card Interior Padding**: `20px` (`1.25rem`) for dashboards; `16px` (`1rem`) for dense modules.
* **Grid Gaps**:
  * Widget / Card Gap: `16px` (`1rem`)
  * Form Field Gap: `16px` vertical, `12px` horizontal
  * Table Cell Padding: `10px 14px` (dense, scannable data density)

### Border Radius Hierarchy
* **Small (`6px`)**: Form inputs, select dropdowns, search bars, badge pills, action icon buttons.
* **Medium (`8px`)**: Primary/secondary buttons, summary cards, dropdown menus, table wrappers.
* **Large (`12px`)**: Main content cards, tab container panels, slide-out drawer sidebars.
* **Extra Large (`16px`)**: Modals and system dialogs.
*(Avoid organic 24px+ pill curves on data containers — they destroy tabular layout alignment and waste screen space).*

---

## 5. UI COMPONENT SPECS & MICRO-INTERACTIONS

### 1. Border Styling & Crisp Framing
* **Cards & Containers**: Strict `1px solid #E2E8F0`. No fuzzy glow or gradient borders on data containers.
* **Form Inputs**: `1px solid #CBD5E1`, background `#FFFFFF`.
* **Focus State**: `1px solid #2563EB` with an ambient glow ring: `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14)`. Smooth `150ms ease-out` transition.

### 2. Shadow Depth (Layered Ambient Occlusion)
* **Level 0 (Flat/Subtle)**: `0 1px 2px 0 rgba(15, 23, 42, 0.05)` — Used on cards, table headers, and static panels.
* **Level 1 (Interactive / Dropdown)**: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` — Used on hover cards, dropdown menus, flyouts.
* **Level 2 (Modals / Overlays)**: `0 20px 25px -5px rgba(15, 23, 42, 0.10), 0 8px 10px -6px rgba(15, 23, 42, 0.05)` — Used on confirmation dialogs, modal sheets, command palette.

### 3. Button Behaviors & Micro-Interactions
* **Primary Button (`btn-primary`)**:
  * *Default*: Background `#2563EB`, text `#FFFFFF`, font-weight `600`, border `1px solid #2563EB`, shadow `0 1px 2px rgba(37, 99, 235, 0.15)`.
  * *Hover*: Background `#1D4ED8`, transform `translateY(-0.5px)`, shadow `0 4px 8px rgba(37, 99, 235, 0.25)`. Transition `150ms cubic-bezier(0.4, 0, 0.2, 1)`.
  * *Active / Pressed*: Background `#1E40AF`, transform `scale(0.98)`, shadow `none` (tactile feedback).
* **Secondary / Outline Button (`btn-secondary`)**:
  * *Default*: Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`.
  * *Hover*: Background `#F8FAFC`, border-color `#CBD5E1`, text `#0F172A`.
  * *Active*: Background `#F1F5F9`, transform `scale(0.98)`.
* **Destructive Button (`btn-danger`)**:
  * *Default*: Background `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`.
  * *Hover*: Background `#DC2626`, text `#FFFFFF`, border-color `#DC2626`.

### 4. Data Tables & Status Badges
* **Data Table Rows**:
  * Default row: `#FFFFFF`, bottom border `1px solid #F1F5F9`.
  * Row hover: `#F8FAFC` (Smooth `120ms` transition).
  * Selected row: `#EFF6FF` with `border-left: 3px solid #2563EB`.
* **Status Badges**:
  * Height `22px`, font-size `11px`, font-weight `600`, padding `2px 8px`, border-radius `6px`.
  * Includes a `6px` colored status dot for non-color-reliant visual accessibility.
