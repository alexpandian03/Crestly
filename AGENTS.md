# PosterAI (AI Poster Generator) - Project Context

Before any task, read docs/CODEMAP.md
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

## AI Rules
- The AI never outputs HTML, SVG, CSS, pixel measurements or coordinate values.
- AI returns strictly structured JSON validated against a schema (Zod on server) and chooses only from predefined enums (recipes, variants, icons, event types).
- All colors and typography come exclusively from brand tokens (e.g. `brand:primary`, `brand:heading`, or derived palette families); the AI never invents colors or hex codes.
- The brand header and footer are permanently locked and owned by the Brand Kit; the AI never touches, rearranges or overrides header and footer bands.
- AI-generated copy is checked for duplicate lines and fact invention against user prompt before rendering.

## Editor & Renderer Rules
- One single unified renderer (`<PosterCanvas>`) serves the interactive editor, preview miniatures (`<TemplatePreview>`), and high-resolution exports.
- Empty slots (missing photos, blank extra fields, unused bullets or lists) are never drawn and collapse automatically.
- No canvas or Konva in bundle: editor uses pure DOM elements, CSS inline styles, SVG, and pointer events.
- Items architecture (`editorVersion: 2`, max 30 items: text, image, shape, icon) clamped to `contentArea(brandKit, template)`.
- Snapping to grid (10px default, 50px with Shift) and dynamic guides.
- Variable items: text blanks (`extras`, max 10) and user photos (`images`, max 4).
- Contrast safety: `readableItems()` enforces WCAG AA (>= 4.5:1) against backing surface/plates.
- Per-item auto-fit shrinks text down without clipping. Dynamic font loading loads only unique families actively rendered.

## Naming Conventions
- React components: PascalCase (e.g. `PosterCanvas.jsx`, `TemplatePreview.jsx`, `DesignModesCard.jsx`).
- Utilities, services, routes, models: camelCase with dot suffix (e.g. `brandRender.js`, `poster.controller.js`, `Poster.model.js`, `poster.routes.js`).
- Shared pure modules: camelCase in `/shared` (e.g. `templateElements.js`, `designRecipes.js`, `paletteFamilies.js`).
- Database collections / models: Singular PascalCase in Mongoose (e.g. `Poster`, `Template`, `BrandKit`, `Client`, `User`).

## Test Commands
- `npm run test:auth` - Auth, tokens, throttling & RBAC security.
- `npm run test:brandkit` - Brand kit validation, style defaults & migrations.
- `npm run test:elements` - Shared template element normalization & token rules.
- `npm run test:recipes` - Design recipes layout engine & build assertions.
- `npm run test:stage8` - Poster CRUD, versions, duplication, restore & thumbnails.
- `npm run test:stage9` - Template zones, items, validation & limits.
- `npm run test:posterdesign` - Poster design snapshot isolation & staleness.
- `npm run catalog:report` - Visual quality and contrast across all presets and palette families.
- `npm run build` - Full client Vite production build check.

## UI Rules
- Plain language for non-technical users: NEVER show technical jargon ("prompt", "layer", "JSON", "token", "zones", "regex", "schema"). Use "Words", "Photo", "Area", "Spaces to fill in", "Design", "Layout".
- Brandframe style: calm, clean SaaS (14px base, 6px inputs/buttons, 8px cards/dialogs, 1px subtle borders, #2563EB accent, no decorative gradients).
- Single solid primary button per screen; outline or ghost for secondary actions.
- Every screen handles loading (skeletons), empty, and friendly error states.
- Confirm destructive actions (delete, restore, discard unsaved changes).

## Progress
- Stages 1-4: Project scaffold, JWT auth, RBAC, client tenants, brand kits, templates & PosterCanvas.
- Stage 5-7: AI structured JSON generation, in-browser PDF/raster export, instant generation UI.
- Stage 8: Poster CRUD, 20-version history, in-place text/photo editing, poster gallery & drawer.
- Stage 9: Template model, HTML/DOM template editor without Konva, per-item nudge offsets.
- Brand Kit & Bands: Granular styling, WCAG contrast resolution, locked brand layer bands (header/footer).
- Templates & Blanks: 30-element model, AI-fillable text variables (`extras`), user photo slots (`images`).
- Design Recipes & Archetypes: 10 layout tree archetypes, 6 styles, procedural layout engine, 33 icons.
- Multi-Script Typography: Tamil font families, script-specific leading, fallback rules, subset loading.
- Design Catalog & Chooser: Catalog presets, diversity signatures, copy variants, paged chooser with prefetch.
- Visual Quality & Palettes: 6 derived palette families, variety setting (`designPalette`), flat fill clamps (<= 35%), visual scoring (`visualScore.js`), catalog report test suite.
