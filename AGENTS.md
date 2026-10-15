# PosterAI (AI Poster Generator) - Project Context

Details of past work: docs/progress-log.md (read only when asked)

Multi-client SaaS. Non-technical users describe a poster in plain language. Each client has a LOCKED brand kit (logo, header, footer, colors, fonts, contacts). AI writes only center content or picks a design recipe. Poster text is real HTML rendered by React `<PosterCanvas>`. AI never renders the raster poster image directly.

## Stack
- Client: React 18, Vite, Tailwind CSS, Lucide icons, ES modules.
- Server: Node.js, Express, Mongoose, MongoDB Atlas, Cloudinary, ES modules.
- Auth: JWT Bearer tokens with user refresh and database login throttling.
- Deployment: Single repo on Vercel. `/api/index.js` exports Express app, `/server` backend, `/client` Vite SPA, `/shared` pure shared code, root `.env`.

## Vercel & Security Rules
- No local disk writes in production: multer memory storage -> Cloudinary stream/direct upload.
- No `app.listen()` in production; keep cached Mongo connection (`cached.conn`).
- Client uses relative `/api` URLs only.
- No in-memory state that must persist across requests.
- Request bodies under 4.5 MB (template writes guarded by `smallBody` 1 MB).
- No Puppeteer: browser export with `html-to-image` + `jsPDF`.
- Secrets in environment variables only; maintain `.env.example`.
- Rate limiting stored in MongoDB (`RateCounter`, `LoginAttempt`).
- Direct Cloudinary uploads signed via `POST /api/uploads/brand-image/sign` (no image bytes through Vercel).
- Image URLs restricted to tenant Cloudinary folders (`brand/<clientId>/`) or approved providers (Pexels, Unsplash).

## Roles & Multi-Tenancy
- Roles: `superadmin`, `clientadmin`, `user`. Guards: `requireAuth`, `requireRole`, `tenantGuard`.
- Multi-tenant isolation: `clientId` is an ObjectId ref to Client. ALWAYS read from authenticated token or tenant guard (`req.clientId`), NEVER from request body.
- Every database query for tenant data filters by `clientId`.
- API response envelope: `{ success: true, data }` or `{ success: false, error: { message, status } }`.

## Editor & Renderer Rules
- Template Editor:
  - Items architecture (`editorVersion: 2`, max 30 items: text, image, shape, icon). Pure DOM & pointer events (no canvas/Konva in bundle).
  - Canvas default 1080x1350 (w: 600-2400, h: 600-3200). Content clamped to `contentArea(brandKit, template)`.
  - Brand header and footer bands are locked and clear.
  - Snapping to grid (10px default, 50px with Shift) and dynamic guides.
  - Variable items: text blanks (`extras`, max 10) and user photos (`images`, max 4).
- PosterCanvas & Renderer:
  - Pure DOM/HTML with inline styles and SVG; renders identically in preview and export.
  - Style tokens (`brand:primary`, `brand:heading`, etc.) resolved via `resolveStyleTokens(style, brandKit)`.
  - Template page overrides applied via `effectivePage(brandKit, template)`.
  - Contrast safety: `readableItems()` enforces WCAG AA (>= 4.5:1) against backing surface/plates.
  - Dynamic font loading: `useGoogleFonts` loads only unique font families actively rendered on canvas.
  - Per-item auto-fit shrinks text down to `minSize` without clipping.

## Data Contracts
- AI Content JSON:
  `{ title, date, time, venue, tagline, details[max 4], imageQuery, extras?: Record<string, string> }`
- AI Design Recipe JSON:
  `{ recipeId, variant, icon, title: { main, sub }, tagline, slogan: { line1, line2 }, bullets: string[], info: { date, time, venue }, cta: { line, button }, imageQuery }`
- Poster Model:
  `{ clientId, title, content: { title, tagline, date, time, venue, details, imageUrl, extras, images }, templateId, templateVersion, design: { brandKit, template, bands, capturedAt }, versions: [...], status, isDeleted }`
- Template Model:
  `{ clientId, name, category, size: { width, height }, elements: [...], page: { background, decoration, watermark, infoCard }, editorVersion: 2, versions: [...], isActive, isDefault }`

## Folder Conventions
- `/client`: React SPA. `src/components` (canvas, shell, dialogs), `src/pages` (routes), `src/utils` (renderers, export, helpers), `src/hooks`.
- `/server`: Express backend. `controllers/`, `services/` (ai, poster, template, brand, storage), `models/`, `routes/`, `validation/` (Zod schemas), `scripts/`.
- `/shared`: Pure shared modules with no external runtime dependencies. `templateElements.js`, `designRecipes.js`.
- `/api`: Vercel serverless entrypoint (`/api/index.js`). DO NOT add files here.
- `/docs`: Documentation and logs (`docs/progress-log.md`).

## Test Commands
- `npm run test:auth` - Auth, tokens, throttling & RBAC security.
- `npm run test:brandkit` - Brand kit validation, style defaults & migrations.
- `npm run test:elements` - Shared template element normalization & token rules.
- `npm run test:recipes` - Design recipes layout engine & build assertions.
- `npm run test:stage8` - Poster CRUD, versions, duplication, restore & thumbnails.
- `npm run test:stage9` - Template zones, items, validation & limits.
- `npm run test:posterdesign` - Poster design snapshot isolation & staleness.
- `npm run test:image` - AI picture prompt safety, quotas & uploads.
- `npm run test:timeago` - Relative time formatting.
- `npm run build` - Full client Vite production build check.

## UI Rules
- Plain language for non-technical users: NEVER show technical jargon ("prompt", "layer", "JSON", "token", "zones", "regex", "schema"). Use "Words", "Photo", "Area", "Spaces to fill in", "Design", "Layout".
- Brandframe style: calm, clean SaaS (14px base, 6px inputs/buttons, 8px cards/dialogs, 1px subtle borders, #2563EB accent, no decorative gradients).
- Single solid primary button per screen; outline or ghost for secondary actions.
- Every screen handles loading (skeletons), empty, and friendly error states.
- Confirm destructive actions (delete, restore, discard unsaved changes).
- Responsive: mobile drawer menu + desktop sidebar; Template Builder requires screen >= 1024px.

## Progress
- Stages 1-4: Project scaffold, JWT auth & RBAC, client tenants & brand kits, templates & PosterCanvas.
- Stage 5: AI poster content generation (mock and Gemini providers) returning structured JSON.
- Stage 6: In-browser high-res export (PNG, JPG, PDF) using html-to-image and jsPDF.
- Stage 7: Poster generation interface with instant preview and template selection.
- Stage 8 (A-D): Poster persistence, version history (capped at 20), in-place editing, poster gallery & drawer.
- Stage 9 (A-C): Template model, HTML/DOM template editor without Konva, per-item nudge offsets.
- Brand Kit Upgrades (1-4): Granular styling, WCAG contrast resolution, direct Cloudinary uploads, Simple/Advanced mode.
- Template Items & Blanks: 30-element model, AI-fillable text variables (`extras`), user photo slots (`images`).
- AI Design Recipes: Procedural layout engine (5 recipes, 4 arrangements), 33 icons, AI illustration generation.
- Render & Contrast Fixes: Locked band resolution, full-bleed patterns, baseline alignment, contrast enforcement.
- Style Link (1-4): Brand tokens (`brand:primary`, etc.), template page overrides, editor token tabs, tokenized canvas.
- Preview Unification: Unified `<TemplatePreview>` component across all views, dynamic font loading.
- Image Resolution: Unified keyword-to-image pipeline for template and AI recipe generation modes.
- Shared Languages (Tamil): Six Tamil-capable families in every allowed font list, per-family published weights (`FONT_WEIGHTS`/`weightsFor`), Tamil script rules (`shared/textScripts.js`: 1.4 leading, no letter spacing, no capitals, Tamil fallback) applied at measure and paint time, Tamil-subset font loading, Tamil + mixed samples in geometry/element tests and exports.
- Brand Layer 1 (server + /shared): Brand Kit header/footer bands carry the template section shape (`mode: 'legacy' | 'elements'`, height, background, always-locked non-variable items). Shared `resolveBands`/`effectiveBand` decide whose band a poster draws (template custom band, else the kit's items or settings); `defaultBrandBands` seeds items on a new kit and offers them on a legacy kit without rewriting it; PUT /api/brand-kit accepts and validates bands for clientadmin/superadmin; saved posters pin the resolved `design.bands` so later kit edits cannot move them.
- Brand Layer 2 (client only): Brand Kit page keeps only brand facts - tabs 'Identity and contact', 'Colours and fonts' (preset button inside) and 'Header and footer' (live band strip from `resolveBands`, Default/Customized status, Edit header/footer, reset with confirm). Header/footer look and page look are authored in the template editor: `TemplateEdit({ brandLayer })` reuses it at route /brand-layer/edit?section=header|footer with only the two tabs, always-locked items, a sample template behind them, and Save that PUTs only `changedBrandBands` after an `updatedAt` stale check. Template header/footer tabs offer 'Use organization header' vs 'Customize for this template' plus an edit link. Rule-type switches moved to a clientadmin /settings page (DesignModesCard). `client/src/utils/brandBands.js` + Vitest cover promotion, dirty diffing and reset.
