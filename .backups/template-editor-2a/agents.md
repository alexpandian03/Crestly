# PosterAI (AI Poster Generator) - project context

Multi-client SaaS. Users describe a poster in plain language. Each client has a
LOCKED brand (logo, header, footer, colors, fonts, contacts). AI writes only the
center content.

## Stack
React 18 + Vite + Tailwind (client), Node + Express + Mongoose (server), MongoDB Atlas,
JWT Bearer auth, Cloudinary, ES modules. One repo, one Vercel project:
/api/index.js exports the Express app, /server app code, /client Vite app, one root .env.

## Rules
- Vercel: no local disk writes (multer memory -> Cloudinary), no app.listen in
  production, keep cached Mongo connection, client uses relative /api URLs, no
  in-memory state that must persist, bodies under 4.5 MB, no Puppeteer (export
  in browser with html-to-image + jsPDF), secrets only in env, keep .env.example updated.
- AI never generates the poster image. LLM returns JSON only
  { title, date, time, venue, tagline, details[max 4], imageQuery }. React
  <PosterCanvas> renders from brandKit + template + content. Poster text is real HTML.
- Layers: routes -> controllers -> services -> models. Zod validation, central error handler.
- Multi-tenant: clientId is an ObjectId ref to Client. Take it from the token, never
  from the body. Every query filters by clientId.
- Roles: superadmin, clientadmin, user (requireAuth, requireRole, tenantGuard exist).
- UI for non-technical users: never show words like prompt, layer, JSON.
- Do not recreate existing files. Work only on the stage I name. Be concise: no long
  summaries. After each stage list files changed, test steps, then STOP.

## Stages
1 scaffold, 2 auth+roles, 3 clients+brand kits+Cloudinary,
4 templates + PosterCanvas renderer, 5 AI generation (mock provider first),
6 browser export PNG/JPG/PDF, 7 Generate page, 8 edit+history+versions,
9 template builder (react-konva), 10 approvals+usage limits, 11 hardening+deploy.

## Progress (update after every stage)
- Done: 1, 2, 3, 4, 5, 6, 7, 8
- Current: 9
- Notes: demo accounts deleted; seed uses SEED_ADMIN_* env vars; Stage 5 AI generation completed. Stage 6 browser export completed. Stage 7 Poster generation UI completed.
- Stage 8A (server only) done: Poster model with 20-version cap, POST/GET /api/posters save+list+get,
  content limits reused from the AI schema, image URLs restricted to Cloudinary/Pexels.
- Stage 8B (server only) done: version-aware PATCH /:id (409 on stale expectedVersion), regeneration
  /:id/versions, /:id/restore (restore always appends), /:id/duplicate, soft DELETE, JPEG/WebP
  thumbnail upload (<=300 KB) to Cloudinary folder thumbnails/<clientId>. Stage 10 usage counting
  points are marked STAGE-10-COUNT in poster.controller.js. Tests: `npm run test:stage8`.
- Stage 8C (client only) done: Create page auto-saves after generate (POST /posters first time,
  /:id/versions with the matching instruction on regeneration), poster id + currentVersion kept in
  state, Saved chip + "couldn't save" banner with Try again/Reload latest. Edit panel: Headline,
  Line under the headline, Date, Time, Place, Details, Photo (live 150 ms preview, counters, Reset,
  Save changes -> PATCH with expectedVersion, 409/404 mapped to friendly messages, unsaved-close
  confirm + beforeunload). Background 400 px JPEG (quality 0.7, <=300 KB) uploaded best-effort to
  /:id/thumbnail via new renderPosterJpeg in utils/exportPoster.js. Open a saved poster with
  /create?poster=<id>. Server untouched.
- Stage 8D (client only) done: /posters is a lazy route (React.lazy + Suspense skeleton) showing a card
  grid — lazy thumbnails with pulse placeholder, title, type, status chip, "Updated n hours ago", card menu
  Open / Duplicate / Delete (confirm), "Created by" only for clientadmin+superadmin (names from GET /users).
  Search debounced 300 ms, filters (type, status, changed from/until), "Showing x of y" + Load more paging
  (limit 12, request sequence guards races), skeletons, empty states (no posters vs no matches), friendly
  retry banners. Detail drawer (components/PosterDetailDrawer.jsx) fetches GET /posters/:id for live preview
  via PosterPreview, lists Changes (number, note, time, who) with Preview/Back to latest, Restore this version
  (confirm -> POST /:id/restore with expectedVersion, 409 banner + Reload this poster) and Regenerate ->
  /create?poster=<id>. Delete/Duplicate update the local list only (no reload). New utils/timeAgo.js.
  Server untouched.
- Auth/RBAC pass (Oct 2026): all APIs return { success, data } or { success:false, error:{ message, status } }.
  JWT carries only { userId, role }; requireAuth reloads the user each request; server refuses to start when
  JWT_SECRET is under 32 chars. Login throttle (5 per email+IP / 15 min) lives in MongoDB (LoginAttempt).
  `npm run seed` = superadmin only; `npm run seed:demo` = demo client (refuses production); `npm run test:auth`
  covers the attack cases and cleans up its own records.
- Stage 9A (server only) done: Template model gains category enum (Event/Festival/Awareness/Achievement/
  Notice/Custom), layout { alignment, spacing, imagePlacement, infoStyle, decoration } (defaults derived from
  the zones, filled by a pre-validate hook so seeds stay valid), versions[] capped at 10, isDefault,
  createdBy, and indexes { clientId, isActive } + unique { clientId, name } (collation strength 2).
  New services/template/zones.js is the one shared rule set every write route uses: canvas 1080x1350 default
  (width 600-2400, height 600-3200), max 6 zones, exactly one header/footer/content + at most one image,
  min zone 120x80, content >= 40% of canvas height, header/footer/content may not overlap, fonts 10-200
  numbers-only, header+footer forced locked:true and any client-sent zone text dropped (brand kit owns that
  text); failures throw a 400 with a plain-language message. Routes: GET / (users see active only, admin all,
  items keep clientId/name/category/size/layout/zones/version/isActive/updatedAt and no versions), GET /:id
  (users active only), POST /, PATCH /:id (archives the old state, +1 version, 409 on stale expectedVersion),
  POST /:id/duplicate ("<name> copy", inactive), /:id/activate, /:id/deactivate (last active template of a
  client is protected with "Keep at least one active template."), /:id/restore { version }. No delete route:
  deactivate instead. Old PUT /:id and PATCH /:id/active routes removed (client only ever calls GET /templates).
  Migration `npm run migrate:templates` is idempotent, adds layout/isDefault/versions/version + maps legacy
  categories onto the new list, never touches zones, and only renames colliding template names with --fix-names.
  Tests: `npm run test:stage9` (107 assertions, own data, cleans up, also runs the migration twice).
- Brand kit upgrade 1 (server only) done: BrandKit gains textStyle {fontFamily,size,weight 400|500|600|700,
  color,uppercase,letterSpacing 0-12}, background {type color|gradient|image, color, gradientFrom/To,
  gradientAngle, imageUrl, overlayColor, overlayOpacity 0-1}, header {height 60-200, background, alignment,
  logo {show,size 24-160,position}, orgName {show,text,style}, tagline {show,text<=80,style},
  border {show,color,thickness 0-8}}, content {background (+pattern/fit/position), decoration
  none|band|circle|corners, decorationColor, watermark {show,opacity<=0.3}, heading/body/accent colors,
  headingFont, bodyFont, infoCard {background,border,radius 0-32,iconColor}, defaultImageUrl},
  footer {height 60-260, layout 1|2|3, background, address<=120, phone, email, website, social[{platform,url}]
  max 6, legalText<=160, style, linkColor, divider {show,color,thickness}} and preset
  professional|bold|minimal|festival|custom. Everything optional with defaults: old kits keep their orgName,
  colors, fonts, logos, header.showLogo/showOrgName, footer.contactText/socials and defaultPosterSize, and
  header/footer backgrounds stored as a color string are read as { type: 'color', color }.
  services/brand/style.js holds the one rule set (allowed Google Fonts, ranges, defaults,
  withBrandKitDefaults/mergeBrandKitUpdate, collectMissingDefaultPaths, tenant image URL check).
  GET/PUT /api/brand-kit unchanged for users (read only); PUT validates the full shape per request (Zod
  schema is built with req.clientId so image URLs must start with https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/
  and contain /brand/<clientId>/), merges section-by-section, strips HTML/control chars, rejects bad hex,
  range, font, email and social-limit input with plain-language 400s, and returns the defaults-filled kit.
  New POST /api/uploads/brand-image/sign (clientadmin, superadmin with x-client-id) returns
  { cloudName, apiKey, timestamp, folder: brand/<clientId>, allowedFormats: 'jpg,png,webp', signature } from
  cloudinary.utils.api_sign_request so brand photos go straight from the browser to Cloudinary - no image
  bytes through Vercel, no API secret in the response, 30 signatures per user per hour counted in MongoDB
  (RateCounter, TTL window, 429 "Try again in n minutes"). Existing /uploads/logo and /uploads/image unchanged.
  Migration `npm run migrate:brandkit` is idempotent (converts string backgrounds, repairs blank colors, adds
  the new blocks with defaults, never touches text/colors/logos). Tests: `npm run test:brandkit`
  (91 assertions, own data, cleans up, runs the migration twice). validate.middleware now also accepts a
  (req) => schema factory. Run the migration once on deploy.
- Brand kit upgrade 2 (client only) done: <PosterCanvas> now renders every style block. New
  utils/brandRender.js is the single resolver (resolvePosterBrand(brandKit, template) -> { scale, canvas,
  header, content, footer, primary, accent }) and mirrors BRAND_KIT_DEFAULTS; one rule keeps old kits
  identical: a control still at its shipped default falls back to the legacy value (isAtDefault/sameValue),
  so untouched kits keep the palette, Cinzel/legacy fonts, rgba header/footer plates, translucent info card,
  hairline border rgba(primary,0.25), divider rgba(primary,0.19) and the two legacy accent blobs. Brand pixel
  values are authored for 1080 and scaled by clamp(width/1080, 0.7, 2). Band geometry: header from
  brandKit.header.height (else the zone), footer anchored to footerZone bottom minus brandKit.footer.height,
  content fills the gap; the logo shrinks to the band's line boxes so it can never push text out.
  New utils/contrast.js is the WCAG helper for the form (parseColor, toHex, blendOver, relativeLuminance,
  contrastRatio, wcagLevel, contrastLabel, pickReadableColor); every colour the renderer paints goes through
  pickReadableColor against its estimated surface (surfaceOf: gradient midpoint, image overlay over #808080,
  colour composited on the canvas plate) so an unreadable brand choice becomes readable, never invisible.
  Backgrounds (canvas/header/content) render as a plate + optional CSS pattern layer + <img crossOrigin
  "anonymous" onError> + overlay div (image type only) so html-to-image takes the same path as photos;
  decoration band/circle/corners are CSS, watermark reuses the primary logo at <=0.3, footer layouts 1/2/3
  group address | phone+email | website+social with inline SVG icons (components/SocialIcon.jsx, no icon
  library) and the pre-style contactText/socials path kept for old kits; content.defaultImageUrl is the photo
  fallback. Auto-fit, data-export-ignore and the 3.5 s layout-settle wait are unchanged.
  useGoogleFonts(heading, body, extraFonts[]) loads every family the kit names; exportPoster embeds
  weights 300-800, de-duplicates font files, keeps only the unicode subsets the poster's own text needs
  (Poppins 18 files -> 6), caches per family and per file url, aborts a hung font fetch after 8 s and no
  longer overflows the stack on large base64 conversions; PNG/JPG/PDF/thumbnail backgrounds come from
  canvasBaseColor(brandKit). /preview-test (DEV only, lazy + import.meta.env.DEV guard) is the old stage-4
  harness page plus 4 sample brands (professional/bold/minimal/festival) with live contrast readouts and
  "Use above" to feed the export buttons; unauthenticated visits skip the tenant fetch instead of bouncing
  to /login. Server untouched. `npm run build` clean.
- Brand kit upgrade 3 (client only) done: /brand-kit is rebuilt as a lazy route (React.lazy + Suspense in
  App.jsx, own chunk dist/assets/BrandKit-*.js 53 kB) behind ProtectedRoute allowedRoles
  ['superadmin','clientadmin'] + requireActiveClient, light theme / indigo #4338CA / Inter, six tabs
  (Identity and logo | Header | Poster background | Footer | Colors and fonts | Presets) with a sticky live
  preview on the right built from <PosterPreview> + sample words (no zone placeholders); under 1024 px the
  preview moves above the form with a Hide/Show preview button, layout holds from 360 px.
  New utils/brandImage.js validates in the browser (JPG/PNG/WebP, 5 MB before resizing), shrinks to max 2000 px
  on the longest side with a canvas and re-encodes WebP (JPEG/PNG fallback when WebP unsupported, quality 0.82),
  keeps the original when re-encoding is heavier, then POSTs /api/uploads/brand-image/sign and uploads the blob
  straight to https://api.cloudinary.com/v1_1/<cloudName>/image/upload with FormData
  {file, api_key, timestamp, folder, signature, allowed_formats} over XMLHttpRequest (real progress %) -
  no image bytes through the server. friendlyError() strips "Validation failed: <path>:" into plain sentences.
  components/brand/BrandImageField.jsx (labelled Upload/Replace/Remove, thumbnail, %, size + dimensions, inline
  errors) and components/brand/controls.jsx (Field, TextInput with counters, Select, Toggle, SliderNumber =
  slider + typed number clamped to LIMITS, Segmented, ColorInput = native <input type="color"> + hex box +
  WCAG note, TextStyleEditor = font/size/weight/color/capitals/spacing + sample line, BackgroundEditor =
  Solid|Gradient|Photo|Pattern + wash color/strength + fit/position, SectionCard with Reset) hold the form
  primitives; LIMITS mirrors server/services/brand/style.js so the form cannot offer a rejected value, and only
  the 12 BRAND_FONTS / weights 400-700 are offered. utils/brandPresets.js applies Professional/Bold/Minimal/
  Festival after an in-card confirmation and edits stay open afterwards - patches are style-only (preset,
  colors, fonts, textStyle, header/content/footer blocks) and never touch name, logos, contact text or any
  imageUrl, so the tenant image rule can never fail. Footer: address/phone/email/website, up to 6
  platform+URL rows (blank rows dropped on save, https:// required), fine print, 1|2|3 columns. Sticky action
  bar shows Saved/Unsaved (JSON compare vs the saved kit) with Discard changes (confirm) and Save brand kit;
  per-section Reset restores the saved values; beforeunload warns while unsaved. The server has no top-level
  background key, so "Poster background" drives colors.background (base plate) + content.background (area
  behind the text). 404 loads as a fresh kit with a note. Server untouched; `npx vite build` clean.
- Background photo fix (client only) done: a brand's background photo is the poster's backdrop, so
  <PosterCanvas> now paints content.background type image as a full-canvas layer (new
  brand.content.bgFullBleed flag in utils/brandRender.js; the layer sits at z0 under the header/content/
  footer bands, and the inset panel stops painting it) instead of only the area behind the text, which
  left a hard cut at the content panel's right edge. Background photos always cover: `fit` is gone from
  normalizeBackground/BRAND_RENDER_DEFAULTS, BandBackground hardcodes objectFit cover (objectPosition
  still follows content.background.position) and the "Photo display" Fill|Fit whole control is removed
  from BackgroundEditor (a stored fit is ignored, so old contain kits fall back to the legacy defaults
  match). BandBackground resets its imageFailed flag when the photo URL changes so Replace shows the new
  picture. The poster photo path was measured and is correct (flow sibling inside the padded column,
  never wider than the panel). Dev /preview-test festival sample points at a photo that loads.
  Server untouched.
- App shell redesign (client only) done: the crowded single-row header is replaced by a 64px top bar +
  a 240px sidebar + a 44px "Working on" context bar. New components/shell/: navItems.js is the one source
  for nav, roles and persistence (ROLE_LABELS, homeForRole, guestNavItems, memberNavItems, navGroups(user),
  hasSidebar, COLLAPSE_KEY 'bf-sidebar-collapsed' via readCollapsed/writeCollapsed in try/catch);
  AppShell.jsx owns collapsed/drawer/picker/password state, renders the sticky header block
  (TOP_BAR_H 64 + ORG_BAR_H 44) then <div class=flex>{SideBar}{main min-w-0 flex-1}{children}</div> and
  mounts MobileMenu, OrgPicker and ChangePasswordDialog; SideBar.jsx is `sticky z-30 hidden min-w-0
  shrink-0 flex-col overflow-hidden ... lg:flex` at w-60 / w-[68px] with an inner overflow-y-auto list
  (scrolls independently), a 3px left ActiveBar on the active row, disabled rows rendered as
  `button[aria-disabled] title="Select an organization first"` when a needsClient group has no client,
  and a bottom Collapse button; MobileMenu is the drawer (scrim bg-heading/60, role=dialog, closes on route
  change, Escape and scrim click); UserMenu.jsx is the avatar/name/role-chip button + dropdown (Change
  password, Log out of all devices, Log out) with `max-w-[10rem] truncate` name hidden under sm and a
  `shrink-0 whitespace-nowrap` chip so it can never clip; OrgBar.jsx + useClientOptions.js load GET /clients
  and keep the old rule that a removed or deactivated tenant is dropped from the selection;
  ChangePasswordDialog.jsx is the old Navbar modal extracted verbatim (same 10-72 chars/letter+number rule,
  POST /auth/change-password, refreshUser, mustChangePassword locks close). Navbar.jsx is now only the
  64px bar (hamburger, logo, guest/member inline nav, UserMenu); role `user` gets no sidebar and top nav
  Create + Posters. App.jsx wraps <Routes> in AppShell with every route, ProtectedRole/requireActiveClient
  combination and the superadmin "no active client -> /access-denied" rule unchanged; api.js still sends
  Authorization + X-Client-Id from localStorage. Dead ThemeContext.jsx (dark-mode toggle, never imported)
  is deleted and Clients.jsx table wrapper is overflow-hidden -> overflow-x-auto so tables scroll in place.
  Two real bugs found while measuring: tailwind.config.js colours were plain `var(--color-x)` so EVERY
  `/opacity` utility (bg-primary/10, bg-heading/60) silently failed to compile - all tokens now read
  `rgb(var(--color-x-rgb) / <alpha-value>)` with channel vars added to index.css (hex vars kept because
  Logo.jsx/exportPoster/Toaster read them), and `max-w-40` is not a Tailwind 3.4 utility. "Log out of all
  devices" can only clear this browser (the server has no logout/session-revocation endpoint) and says so.
  Verified at 360/380/620/640/1024/1280/1440 with zero page-level horizontal scroll, single-line labels and
  header 64px; `npm run build` clean, BrandKit chunk still separate (53.44 kB). Server untouched.
- Stage 9B (client only) done: new utils/templateRender.js is the client mirror of
  server/services/template/zones.js (TEMPLATE_SIZE_DEFAULT, LAYOUT_BASE, LAYOUT_OPTIONS, FONT_DEFAULTS,
  TEMPLATE_CATEGORIES, templateIdOf, resolveTemplateSize, resolveTemplateRender) and normalises every missing
  field, so a pre-layout template still renders exactly as before. resolveTemplateRender returns
  { size, layout (+spacingFactor 0.72/1/1.32, centerColumn, hidePhoto), fonts {minFont,maxFont},
  zones {content,image,header,footer} }; image is null when there is no image zone or placement is 'none',
  and hidePhoto (image zone + 'none') also suppresses the flow photo. brandRender now takes width/height and
  the content rectangle from it (declaredY/declaredBottom/declaredW clipped by the brand header/footer bands,
  which still own all band geometry). <PosterCanvas> honours it: content box positioned/sized by the zone, the
  photo either flows inside the column (rect inside the content box -> width/local x from the zone) or paints
  as its own absolutely positioned block at the exact rectangle; orderedBlocks follows layout.imagePlacement
  (top/middle/bottom) and falls back to the historic order when no photo area is declared; alignment drives
  alignItems+textAlign, spacing multiplies every gap, infoStyle renders card|inline (one line, · separators)|
  stacked (column with hairline dividers), decoration overrides the brand's own shape (band|circle) and only
  legacy kits keep the old accent blobs. zone minFont/maxFont become the auto-fit window
  (fontCap/fontFloor = px/(DESIGN.details*unitK) clamped to S_HARD..S_MAX, so the single-scale fit, the
  42% image floor and data-export-ignore are unchanged; the declared photo height is a maximum - it shrinks
  before text goes under the floor). New components/TemplateThumb.jsx (fixed-width real renderer, because
  PosterPreview forces minHeight 200px) + TemplateCard.jsx (live miniature, name, size, updated, category /
  Active / Default / Version chips, menu Edit layout | Make a copy | Activate-Deactivate, busy state).
  /templates is rebuilt (lazy, + /templates/builder mount point for 9C showing areas, text-size range and
  plain-word placement readouts): GET /templates + /brand-kit, skeletons, empty state, Reload + New template
  (duplicates the default then opens the builder), actions POST /templates/:id/duplicate|activate|deactivate
  with local list patches, and 409 -> "This template was changed somewhere else. Reload to continue." (then a
  quiet reload). Generate (Create) page: usableTemplates = isActive !== false drives categories, filtering,
  fallback selection and the picker, cards show a live thumbnail + category, no management actions, and
  getRealTemplateId() derives from selectedTemplate so generation always uses the chosen layout.
  /preview-test gains "Template layout samples" (4 templates, same TEMPLATE_SAMPLE_CONTENT: photo band below
  the text, photo inside a centred relaxed column, narrow top-photo compact inline, landscape 1920x1080 with
  no photo area -> two lanes) with "Use above". Verified headless at 5211: every zone rect honoured (70/170/
  940x600, 940x1010, 130/520/680x660, 1920 canvas), absolute photo exactly at 70,800,940x400, no text escaping
  its band or the canvas, no overflow chip, 0 console warnings (fixed two missing React keys: the flow
  orderedBlocks list and FooterBand's social/legacy-social divs). Two dead Unsplash IDs on the dev page were
  swapped for loading ones. Server untouched; `npm run build` clean, Templates 9.28 kB + TemplateBuilder
  4.73 kB separate lazy chunks.
- Stage 9C (client only) done: the template builder. Client deps konva@9.3.22 + react-konva@18.2.16 (18.2.16
  is the last React-18 line; npm's default 19.3.0 wants React ^19.3.0). Only
  components/builder/AreaStage.jsx imports react-konva and it is reachable solely through the lazy
  /templates/:id/edit route, so the main chunk keeps 0 Konva matches and konva ships inside
  TemplateEdit-*.js (325 kB, 99 kB gzip); vite.config.js needed no "canvas" fix.
  New utils/templateBuilderRules.js is the client mirror of server/services/template/zones.js in plain words:
  GRID_STEP 10, POSTER_LIMITS, MIN_AREA_SIZE 120x80, MIN_TEXT_COVERAGE 0.4, MAX_AREAS 6, TEXT_SIZE_RANGE
  10-200, NAME/NOTE_LIMIT 120, HISTORY_LIMIT 30, AREA_NAMES/AREA_HINTS, LAYOUT_LABELS, brandEdges(),
  constrainArea() (snap + clamp inside the poster and between the two brand bands), validateDraft() ->
  friendly sentences, firstProblem(), draftOfTemplate() (ints, forced locked brand areas, synthesises a
  missing header/footer/content), draftKey(). AreaStage: Stage scaleX/scaleY = avail/size.width with every
  child authored in real poster px and every screen-constant size via ui(px)=px/scale; ResizeObserver on the
  wrapper; brand plate Rect fill brand.canvas.color; header/footer drawn semi-locked (surface at 0.45,
  not draggable, lock glyph + "Locked brand area") and selectable only; content/photo are draggable with a
  Konva Transformer (no rotate/flip, keepRatio false, anchorSize ui(11), boundBoxFunc refuses anything under
  MIN_AREA_SIZE * scale); dragMove/transform run constrainArea every frame so snapping, poster bounds and
  band clearance hold mid-gesture; background click deselects. AreaSettings: the selected area's x/y/w/h,
  smallest/largest text, "Keep this area fixed" (disabled for brand areas) plus Add/Remove photo area and the
  five layout settings when the text area is selected; NumberField keeps a local string draft, live-clamps
  while typing and closes the undo transaction on blur. TemplateEdit (lazy, superadmin+clientadmin,
  requireActiveClient): useReducer {past,present,future} with live (no history) vs commit, txRef so one
  gesture or one typed edit = one undo step, capped at 30, dirty = draftKey !== baselineKey; keyboard
  arrows nudge (10 px, x5 with Shift), Delete removes the photo area, Ctrl/Cmd+Z/Y redo, all suppressed
  while typing, previewing or with the drawer open; beforeunload + confirm while unsaved. Three-panel
  desktop grid lg:grid-cols-[280px_minmax(0,1fr)_320px] (Name/Category/layout settings | canvas | selected
  area) and a top bar (Back, Saved/Not saved chip, Preview, Versions, note input, Save); under 1024 px
  (useWideScreen matchMedia) it shows "Use a larger screen to edit templates" plus a read-only preview only.
  Preview swaps the canvas for three real <PosterPreview> renders (sample words, a long-words sample, a
  no-photo sample). Save runs validateDraft first, then PATCH /templates/:id
  { name, category, size, zones, layout, note?, expectedVersion: saved.version } and reports
  "Saved as version N", 409/404 -> "changed somewhere else" banner with Reload this template. VersionDrawer:
  newest-first list (+ a "Now in the editor" row) with Version N, note, who (You or the name from GET /users)
  and time, inline Preview and Restore (POST /:id/restore, confirm, "Version N is back in the editor, saved
  as version M"). Templates.jsx openEditor -> /templates/:id/edit (was the read-only builder) and
  TemplateBuilder's "opens in the next update" note is now an "Edit this layout" link. Copy is plain-word
  throughout ("Area", "Text area", "Photo area", "From the top", "Gaps", "Extra shape") - no zone/JSON/prompt
  words. Verified headless on a temporary DEV /builder-test harness (since deleted) at 5211: Stage mounts and
  paints an 800x1000 canvas at scale 0.7407 in a 1200 px column, all four areas land on their exact rects, the
  panel copy and 10 px snap wording render, console clean apart from the two pre-existing Router future-flag
  warnings; pointer gestures could not be driven headlessly (synthetic PointerEvents never reach Konva), so
  drag/resize is covered by the mid-gesture constrainArea math and code review. Server untouched;
  `npm run build` clean.
- Stage 9C builder canvas rework (client only) done: the schematic boxes were replaced by the real poster so
  edits are visible. AreaStage now stacks three layers in one scaled box: (1) the live <PosterCanvas> with the
  brand kit + the draft template + TEMPLATE_SAMPLE_CONTENT, authored at full poster pixels and shrunk with a
  CSS `transform: scale()` (same technique as PosterPreview, so the auto-fit still measures layout px);
  (2) a transparent Konva Stage at the same scale (plate Rect `fill="rgba(255,255,255,0)"` keeps background
  click-to-deselect) drawing only the area frames, the Transformer and the drag handles; (3) a
  `pointer-events-none` DOM chip layer so every label stays one readable size on screen at any zoom
  ("Locked brand area" with a lock icon over the two brand bands, "Text area · 940 × 640" over the rest).
  The scaled box has `overflow-hidden` so the pre-transform 1080x1350 layout box cannot stretch the scroll
  area. ResizeObserver reads the box width AND height, fit = min(1, boxW/w, boxH/h), and Fit | 50% | 100%
  buttons (ZoomPicker, with the live %) sit above it; above fit the box scrolls. While a drag or resize gesture
  runs the underlay is frozen from a snapshot taken at gesture start (frozen ref + `gesturing`) so the poster
  auto-fit does not re-run every frame; the frames and chips keep moving live. A photo area with no picture
  shows a dashed "Photo goes here" placeholder at the declared rect, hidden when resolveTemplateRender reports
  hidePhoto. Text/photo drag and resize snap to GRID_STEP, or GRID_STEP*5 while Shift is held (stepFor reads
  event.evt.shiftKey); brand areas stay non-draggable and now paint no fill of their own - the real poster
  shows them. A red note appears under the canvas when the text area and the photo area cover each other
  (new areasOverlap() export; it is a warning, not a save block, because the server allows that pair).
  TemplateEdit: middle column is `sticky` with `top: 64 + (superadmin ? 44 : 0) + 16` and
  `height: calc(100vh - top - 16)` so it parks under the sticky app header and never scrolls away while the
  left/right columns do; the grid stays 280px | minmax(0,1fr) | 320px with items-start, and the Preview branch
  scrolls inside the same box. Real bug fixed in constrainArea(): an over-tall typed area used to be pulled
  up over the top brand band (height 1200 -> y 20, which then failed validation as a brand overlap); the
  editable height is now clamped to the clear strip between the bands, so 1200 becomes 1080 at y 140.
  API calls, data models and the saved template shape are unchanged. Verified headless through a temporary
  DEV /builder-test harness (since deleted) in a 1440x900 iframe: grid 280/512/320, sticky column
  top 80px height 804px with a 1321px row (517px of stick) and no clipping ancestor, Konva canvas and poster
  underlay pixel-identical at 476x595 @458,465 (scale 0.440741), 100% zoom -> 1080x1350 with the box scrolling,
  Fit returns to 476x595, Gaps "Generous" re-renders the sample (column gap 25.22px -> 33.29px) and Text
  position changes it again, "No photo area" removes the placeholder and "In the middle" brings it back,
  Height 1200 -> clamped 1080 with From the top 140 and Save enabled, Height 800 -> the red overlap note in
  text-danger with Save still enabled, Preview/Versions/back intact and no console errors beyond the two
  pre-existing Router future-flag warnings. Note: a page in this browser cannot be scrolled by script
  (scrollBy/scrollTop stay 0 on the invisible surface), so stickiness was proven from the computed
  top/height/row-height chain rather than a live scroll. `npm run build` clean, TemplateEdit 328.12 kB with
  all 5 Konva matches, main chunk 408.78 kB with 0. Server untouched.
- Templates card menu + delete (client + one route) done: the card menu was clipped by the card's own
  overflow-hidden, so TemplateCard now renders it through createPortal into document.body as a local
  ActionMenu component: fixed position from the trigger's getBoundingClientRect (right-aligned to the
  trigger, 6 px gap, 8 px viewport edge), useLayoutEffect measures the real menu (224 x 179) and opens
  upward when it does not fit below, clamps to the top edge when it fits neither, and re-places on window
  scroll (capture) and resize using documentElement.clientWidth/clientHeight (not innerWidth: a classic
  scrollbar is in innerWidth but not in the box a fixed element is placed in); closes on mousedown AND
  click outside (click too, because key activation fires no mousedown — this is also what keeps only one
  card menu open at a time), on Escape with focus returned to the trigger, and never on a press inside the
  menu. Items are Edit layout, Duplicate (was "Make a copy"), Activate/Deactivate, then a divider and
  Delete in text-danger rgb(220,38,38) with a Trash2 icon; all four are disabled while the card is busy.
  New components/DeleteTemplateDialog.jsx (fixed inset z-[70], role=dialog aria-modal, scrim click and
  Escape close, AlertTriangle chip) has two modes read from the live list row: an active template gets
  "Turn this template off first" with Cancel | Turn it off (POST /:id/deactivate, its failure message is
  shown inside the dialog), an inactive one gets "Delete this template? / Posters already created from it
  will not be affected. This cannot be undone." with Cancel | Delete. Templates.jsx keeps deleting={{id}}
  and derives the row from `templates`, so a successful turn-off flips the dialog without closing it;
  confirmDelete does DELETE /templates/:id, drops the card from state with no reload, toasts
  "Template deleted.", maps 404/409 to the existing banner + quiet reload and other failures to the dialog
  line. runOn gained an optional onError callback (only the dialog path passes setDeleteError). Server:
  new controller deleteTemplate + `router.delete('/:id', adminOnly, validateParams(templateParamsSchema), deleteTemplate)`
  — same adminOnly guard as the other writers (requireAuth + requireRole('superadmin','clientadmin') +
  tenantGuard), 404 outside the tenant, 400 "Turn this template off first, then you can delete it." while
  isActive, then template.deleteOne(); no model or schema change, and posters keep their own content so a
  deleted template only leaves the list (History/Generate already fall back when templateId is missing).
  Verified headless with a temporary DEV /card-probe page (since deleted) that rendered the real Templates
  page with api.get/post/delete stubbed in memory: menu parent is document.body with the card still
  overflow-hidden, 4 items in order with 1 divider, right edge exactly on the trigger (0 px) and 6 px
  above/below in both directions — flip confirmed at a 420 px-high viewport (trigger 316 -> menu 678-857),
  a 360 px-wide viewport stays inside with no page overflow, scroll re-places it while keeping the 6 px gap,
  Escape/outside-click close and an inside-menu press keeps it open, one menu at a time; the whole flow
  Activate -> Delete on the active card -> Turn it off -> dialog flips to "Delete this template?" -> Delete
  removed the card, closed the dialog and toasted. `npm run build` clean, Templates 13.52 kB, TemplateEdit
  still 328.12 kB, main chunk 408.79 kB. Note: `npm run test:stage9` does not assert the new DELETE route
  (it needs Atlas credentials and shared data, so it was not run here).
- Stage 9C builder canvas 2 (client only) done: react-konva is gone. AreaStage no longer imports konva at
  all — the selection UI is now a plain DOM layer that is a SIBLING of the `transform: scale()` poster layer
  (poster box -> [clip div `absolute inset-0 overflow-hidden` -> scaled poster] + [overlay `absolute
  inset-0`]), so every frame/handle is placed in screen px (x*s, y*s, w*s, h*s) and can never be scaled
  with the poster. Handles are fixed 10x10 px squares, white fill, 1.5px solid #2563EB, border-radius 2,
  8 per selected area (4 corners + 4 edges) at `calc(N% - 5px)`; only the selected area gets a 1.5px solid
  outline + handles, an unselected editable area is a 1px dashed outline (content = brand primary, photo
  = #475569) with no fill, and the two brand areas show a 20px lock badge only (title "Locked brand area",
  a locked text/photo area gets the same badge with title "Kept fixed"). One floating tag sits above the
  selected area only ("Text area · 940 × 640", clamped to the poster width and to y >= 0). Click/pointer
  down anywhere inside an area selects it (the overlay's own pointerdown deselects), and its body drags.
  Dragging is pointer events with setPointerCapture (wrapped in try/catch: it throws once the pointer is
  gone, e.g. under synthetic events) + touch-action none: delta = (clientX - startX)/scale, snapped by
  constrainArea with grid GRID_STEP, or GRID_STEP*5 while Shift is held, and clamped inside the poster and
  between the two brand edges every frame; a resize also snaps w/h, a pure move keeps the typed w/h exactly
  (the fixed result's size is replaced by the gesture's start size, so a Shift-move no longer re-snaps it).
  New "Hide guides" / "Show guides" button (aria-pressed) next to Fit|50%|100%: outlines, handles, lock
  badges and the tag all disappear while the (still draggable) hit areas stay in place. Zoom: fit =
  min(1, (clientWidth-32)/size.width, (clientHeight-32)/size.height) — 16 px of padding all round, the
  denominators are the poster's own size, not 1080/1350 — and the centering wrapper is `flex w-full
  min-h-full` with `padding:16` and the poster box `margin:auto`, so nothing is clipped at 50%/100% (auto
  margins collapse to 0 when the free space is negative, unlike justify-content:center) and the box scrolls.
  ResizeObserver + window resize feed the measurement, and because a box can also shrink without the window
  resizing (the red overlap note appearing under the canvas costs ~58 px) the size is re-checked after every
  render with a same-values bail-out, which fixed a stale fit (39% kept after the note pushed the box from
  558 to 500 px; it now drops to 35% by itself). The underlay still freezes from a gesture-start snapshot so
  the poster auto-fit does not re-run mid-gesture. TemplateEdit: grid is now 240px | minmax(0,1fr) | 300px
  and the sticky canvas column is `top: 64 + (superadmin ? 44 : 0) + 16`, `height: calc(100vh - 140px)` —
  the literal `top: 16px` would park the canvas under the app's own sticky header (z-40, 64 + 44 px), so
  the top stays header-aware while the height matches the request (for a superadmin top 124 + height = the
  viewport minus 140, i.e. 16 px clear at the bottom). Undo/redo, the keyboard nudge, the note input,
  Preview, Versions, save/restore and PATCH /templates/:id are untouched: the payload is still
  { name, category, size, zones[{id,type,x,y,w,h,locked,minFont,maxFont}], layout, note?, expectedVersion }.
  Verified headless through a temporary DEV /stage-probe page (since deleted) that mounted the real
  TemplateEdit with api.get/patch stubbed, in a 1440x900 iframe: grid 240/572/300, sticky column
  position sticky top 80 height 760 = 900-140, scroll box 536x558 with overflow auto; fit 39% -> poster
  421x526 with 59/59 px and 17/17 px gaps (centered, no scrollbars) and the 4 frames at exactly 0/27.27/
  66.24/366.25/249.36 screen px = the stored px x 0.38963; 8 handles measured 10x10 on screen at fit, 50%
  and 100%, border 1.5px solid rgb(37,99,235), radius 2px, white; drag body +100/+80 screen px -> stored
  70,170 -> 140,380 (snapped 330 then clamped by width, snapped 380) with the panel inputs and the "Not
  saved yet" chip updating live; Shift -40/+40 -> 50,500 with w/h unchanged at 940/640; the SE handle
  +30/+30 -> 1030x730 with y clamped to 490 so the area stops exactly at the footer band (1220); background
  pointerdown deselects (0 handles, 0 tags); Hide guides -> all 4 frames transparent, 0 handles, 0 badges,
  0 tags, and a drag there still moved the area 100 -> 140; 100% -> 1080x1350 with scrollWidth/Height
  1096x1382 and the poster still starting at +17/+17 (nothing clipped), 50% -> 540x675; Ctrl+Z / Ctrl+Y
  round-trips 70 <-> 80; Save posted the exact payload above with expectedVersion 3 and the chip went to
  "Saved"; console clean apart from the two pre-existing Router future-flag warnings and Chrome's
  "blocked beforeunload panel" notice for the scripted reloads. konva/react-konva are now unused in src
  (TemplateEdit chunk 328.12 kB -> 36.45 kB, 0 konva matches in dist; main chunk 408.76 kB unchanged) but
  stay in package.json until removed on request. Server and data formats untouched; `npm run build` clean.
- Per-item positioning inside the text area (client + optional layout key) done: the builder can now move
  one group of words at a time - Headline, Line under the headline, Date, Time, Place, Extra lines - on top of
  the layout settings, which stay the starting point. `layout.itemOffsets` is
  `{ headline|description|date|time|venue|details: { dx, dy } }` in poster pixels, default `{dx:0,dy:0}`, the
  only addition to the saved shape (nothing removed, no new route, no migration - an old template simply reads
  as all zeros). Four places had to accept it or the PATCH would have silently dropped it:
  server/services/template/zones.js (LAYOUT_ITEM_KEYS, ITEM_OFFSET_DEFAULT, ITEM_OFFSET_LIMIT 4000, clampOffset
  + exported normalizeItemOffsets, called from normalizeLayout so create/update/duplicate/restore/snapshot all
  cover it), server/models/Template.model.js (itemOffsetSchema/itemOffsetsSchema under the strict layout path,
  per-key defaults), server/validation/template.schema.js (optional itemOffsets with whole numbers in +-4000 and
  plain-word messages "Sideways move must be a number" / "... cannot be further than 4000 pixels"), and the
  client mirror utils/templateRender.js (same constants + ITEM_LABELS + normalizeItemOffsets in a fixed key
  order, so two working copies compare as text) + utils/templateBuilderRules.js (ITEM_KEYS/ITEM_NAMES,
  itemRoom(base, area), constrainItemOffset(offset, room, grid) which snaps then clamps with ceil/floor so the
  rounding is always inwards, and draftOfTemplate re-picking itemOffsets so draftKey and the PATCH see a move).
  PosterCanvas paints each nudge as `transform: translate(dx, dy)` on the block it already renders (new
  shift/shifted helpers in ContentZone, plus a data-item marker on the tagline, the h1, every info row in all
  three info styles and the details list) - a transform changes no offsetTop/offsetHeight, so the auto-fit never
  re-runs and a nudge can never re-scale the text (verified: headline stayed 125.152px through a 100/80 nudge).
  AreaStage gained a second mode: Areas | Items (ModePicker next to Hide guides and the zoom row). In Items mode
  the overlay stops drawing areas and draws one frame per group, positioned from a DOM measurement - each
  `[data-item]` getBoundingClientRect() over the scaled layer, minus the offset it was painted with, gives the
  base rect; `itemRoom()` turns that plus the allowed rectangle into how far it may still travel, and the
  allowed rectangle is `intersectRect(zones.content, brand.content panel)` so words cannot be pushed into a
  strip the brand bands already clip. A dashed guide draws that room. Frames are `touch-action: none`, move on
  pointer events with `delta / scale` snapped to GRID_STEP (x5 on Shift) and clamped by constrainItemOffset, and
  only the selected one gets the solid blue border; measurement is skipped while gesturing and re-runs on
  gesture end and on onLayoutSettled (settleTick), and rooms go up through onItemGeometry behind a
  JSON-signature bail-out so the panel's number boxes get real min/max. The floating tag reads
  "Date - 100 px right, 80 px down" in Items mode and the size readout in Areas mode. TemplateEdit owns
  stageMode/selectedItem/itemRooms, `setItemOffset` (clamps with grid 1 so a typed 7 px stays 7 px - the drag
  side already snapped), `nudgeItem` (arrow keys 10 px, 50 with Shift, only in Items mode), `resetItems`,
  `pickItem` (a row in the panel also switches the canvas to Items and selects the text area) and
  `selectMode`; one gesture or one typed edit is still one undo step. AreaSettings exports ItemFields
  ("Move one item", six rows with the current move as a chip, two Sideways / Up or down boxes limited to the
  measured room, and a Reset item positions button that is present but disabled while nothing is moved).
  Fixed while verifying: AreaStage used `onSelectMode` without declaring the prop, so the canvas threw on
  render for any template. Verified through a temporary DEV /item-probe harness (since deleted) on 5173 that
  mounted the real AreaStage + AreaSettings + ItemFields: six data-item markers and six frames measured, a
  synthetic pointer drag gave {dx:100,dy:80} snapped to 10 px with the painted element matching the frame within
  2 px, an over-range drag and typed 999/-999 both stopped exactly at the measured room (480 / -559), the tag,
  the panel chip and draft.layout.itemOffsets all updated, Reset zeroed all six and disabled itself, Hide guides
  made every item border transparent, switching to Areas restored the two draggable area frames with the size
  tag, and the console stayed clean apart from the two pre-existing Router warnings. Server side proved with a
  throwaway node script (since deleted): normalizeLayout keeps all six keys, drops unknown ones and clamps to
  +-4000; Zod accepts `{headline:{dx:20}}` and rejects a string and 999999 with the plain-word messages; the
  Mongoose document defaults to zeros, round-trips venue.dx=30 and refuses 99999. `npm run build` clean,
  TemplateEdit 44.26 kB, main chunk 409.55 kB. `npm run test:stage9` was not run (needs Atlas credentials and
  touches shared data). konva/react-konva are still unused in src and still in package.json.
- Poster drawer shows the clicked poster (client + server) done: the drawer mixed two posters because it kept
  its state across poster ids and always rendered the LIVE template. Checklist findings — the click handler
  and the fetch were already correct (PosterCard passes the clicked poster, History keeps `openId`, the server
  reads /posters/:id through posterScope with no "latest" query), and this is a Vite SPA with axios, so there is
  no query cache to key. Fixed: (1) Poster.model.js gains `templateVersion` on the poster and on every
  posterVersionSchema entry (no default, so posters saved before pinning keep rendering with the live template —
  no migration); (2) createPosterController pins `template.version || 1` on the poster and version 1,
  appendVersion carries it into each new version (restore passes the source version's own templateVersion, so
  bringing back version N also brings back its layout) and duplicatePosterController copies it;
  (3) getPosterController now answers `{ poster, template }` where template comes from templateForPoster(): the
  tenant's template, replaced by the archived snapshot in Template.versions[] whose `version` equals the pinned
  one (falling back to the live layout when that snapshot has aged out of the 10-entry cap), and sends
  `Cache-Control: no-store` so neither Vercel nor the browser can replay one poster's payload for another;
  (4) History mounts the drawer with `key={openId}`; (5) PosterDetailDrawer resets poster/pinnedTemplate/
  previewVersion/error on every posterId change, fetches with an AbortController signal plus a `stale` flag and
  drops any reply whose `_id` is not the open one (restore does the same before setting state), and renders
  `pinnedTemplate || template` with `key={posterId-version}` on PosterPreview; (6) Generate keeps the template
  returned by GET /posters/:id in a new `pinnedTemplate` state and uses it when the poster's own template is
  archived or missing, instead of silently substituting `usableTemplates[0] || DEMO_TEMPLATE` (that fallback now
  only applies when nothing matches), and its loader also ignores a reply for a different id.
  Verified: server module imports clean (10 exports), `npm run build` clean with no leftover probe chunk.
  Not run here: a logged-in browser pass (no local credentials).
- Poster design snapshots (server only) done: posters no longer follow the live brand kit or template.
  New services/poster/design.js captures a sanitized, self-contained look — brandKitSnapshot() keeps only the
  ten brand sections through withBrandKitDefaults and a recursive prune (no _id/clientId/secrets, strings cut at
  600 chars, arrays at 12, depth 6, any http:/data:/file: URL blanked so only https survives) and
  templateSnapshot() keeps { templateId, name, size, zones, layout, version } via normalizeZones/normalizeLayout;
  captureDesign() refuses anything over DESIGN_MAX_BYTES (60 KB) with a 400. Poster.model.js gains a design
  subdocument { brandKit, template, capturedAt } on the poster AND on every versions[] entry (Mixed Object, so
  the snapshot is stored verbatim; old posters simply have none until migrated). Controllers capture on the
  server from the token's tenant only: create, duplicate and regenerate (POST /:id/versions) store a fresh
  snapshot, PATCH text edits inherit the poster's current one, restore copies the source version's snapshot back
  onto the poster, and the new POST /:id/apply-latest-design { expectedVersion } (same 409 check, Zod
  applyLatestDesignSchema) re-captures the current kit+template as a new version noted "Updated to the latest
  brand design". A deleted template falls back to the stored snapshot instead of losing the look. GET /:id
  returns the full design plus data.template built from the snapshot (echoing _id so the untouched client can
  key it), falling back to the old templateVersion pin for pre-snapshot posters; GET / lists with
  -design.brandKit -design.template.zones -design.template.layout so cards get name/version only. Migration
  `npm run migrate-poster-designs` is idempotent (filter design missing, keyed cursor batches of 200, caches kits
  and templates per run, fills versions.$[v].design through arrayFilters, logs the updated count, skips
  oversize posters). Brand uploads: signDirectUpload signs only { timestamp, folder, allowed_formats } and the
  response carries no public_id, so a direct upload always gets a fresh Cloudinary id and old snapshots' images
  survive — asserted in the tests. Tests `npm run test:posterdesign` (41 assertions: edits after saving change
  nothing, apply-latest adds a version with the new look, restore brings the old look back, cross-tenant 404s,
  oversize 400, trimmed list, sign route has no public id). test-stage9 section 13 was stale ("no delete route")
  and now asserts the shipped DELETE behaviour (400 while active, cross-tenant 404, inactive deletes).
  All suites green: posterdesign 41, stage8 83, brandkit 91, stage9 109, auth; `npm run build` clean.
- Poster design snapshots (client only) done: the client now reads design. New utils/posterDesign.js is the one
  place that answers "which look do I draw with" — designBrandKit/designTemplate (snapshot, else the fallback)
  and isDesignStale(design, { brandKit, templates }) which is true when brandKit.updatedAt is newer than
  design.capturedAt or the live template with the same templateId has a different version; it also owns the three
  user-facing sentences (DESIGN_STALE_MESSAGE "The brand design has changed since this poster was made.",
  DESIGN_APPLY_LABEL "Use the latest brand design", DESIGN_APPLY_CONFIRM "This adds a new version. Your current
  version stays in the history."). New utils/posterThumbnail.jsx (renamed from .js: it holds JSX and Vite only
  parses JSX in .jsx) is renderAndUploadThumbnail(posterId, { brandKit, template, content }, { shouldAbort }) —
  the offscreen ReactDOM.render(<PosterCanvas/>) + 3.5 s settle race + img decode + renderPosterJpeg 400 px
  (quality 0.7, retried at 0.5 above 300 KB) + POST /:id/thumbnail, best-effort (every failure returns false),
  extracted so the drawer can reuse it. Generate.jsx keeps posterDesign in state (set from the ?poster=<id>
  loader, from every runSaveOp response and from refreshPoster) and draws drawBrandKit/drawTemplate =
  snapshot || current, so the live preview, <PosterExportButtons> (which renders its own offscreen PosterCanvas
  from the same two props) and the thumbnail all use the poster's own look; a brand-new poster has no snapshot
  and draws with the current brand until the server stores one. Thumbnails fire ONLY from runSaveOp (generate /
  regenerate / text save) and from apply-latest-design, never on load, never on open, never from the list, and
  always from the snapshot (queueThumbnail(id, content, design) -> captureAndUploadThumbnail with the old
  thumbSeqRef race guard). The stale notice renders under the preview when posterId && designStale, with the
  confirm-then-POST /:id/apply-latest-design { expectedVersion } handler that rewrites content, version,
  posterDesign, marks saved, rebuilds the thumbnail and toasts; 409 goes to the existing conflict banner with
  "Reload latest", anything else to a one-line message. PosterDetailDrawer.jsx takes a new templates prop,
  resolves previewDesign per previewed version (version.design, else poster.design, else the props) so Preview
  of an old version still shows that version's own look, and gained the same notice + apply button (only while
  the latest is on screen) which calls onChanged(updated) so the History card updates without a reload; restore
  now also rebuilds the thumbnail from the version it brought back. History.jsx cards take their aspect ratio
  from poster.design.template.size (the list keeps design.template.{templateId,name,size,version}) and fall back
  to the live template, and pass templates to the drawer. Server untouched; `npm run build` clean (History
  26.62 kB, main chunk 412.51 kB).
- Template editor items (server only) done: the editor's stored shape is items, not areas.
  New /shared/templateElements.js is the one dependency-free rule set (no imports, no env reads, no Node-only or
  browser-only APIs; TextEncoder behind a typeof guard) exporting EDITOR_VERSION 2 / LEGACY_EDITOR_VERSION 1,
  ELEMENT_KINDS field|text|image|shape, ELEMENT_FIELDS headline|tagline|date|time|venue|details|photo, the 12
  allowed fonts, weights 400-800, ELEMENT_LIMITS (30 items, 10 text / 6 photo / 10 shape, min 40x24, text 200
  chars, font 10-200, letterSpacing 0-12, lineHeight 0.9-2, opacity 0-1, radius 0-64, strokeWidth 0-12, z 0-1000),
  TEMPLATE_DOC_MAX_BYTES 200 KB, contentArea(brandKit, template) (poster minus brandKit.header.height and
  footer.height, bands shrink proportionally so at least 120 px of strip stays), normalizeElement(s) (whitelist
  keys, round pixels, clamp ranges, plain words only), legacyToElements(template, brandKit) (6 field rows stacked
  inside intersect(content zone, content area) + a photo row, carrying layout.itemOffsets as nudges and the zone's
  minFont/maxFont), checkElementImageUrl (must start with https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/ and
  contain /brand/<clientId>/) and validateElements/firstElementProblem + jsonBytes. Server imports it with relative
  paths; the client will import the same file in the next part (nothing in /client was touched).
  Template.model.js gains elements[] (elementSchema with the same enums/ranges, _id:false) and editorVersion
  (default 1) on the template and on every versions[] entry, plus a pre-validate hook that refuses more than 30
  items and any document whose JSON is over 200 KB with a plain sentence; zones, layout, indexes and
  getDefaultTemplateData are unchanged (no new index was needed, so no sync-indexes.js).
  services/template/elements.js is the server glue: elementContext({brandKit,template,clientId,size}) resolves the
  real area, cleanElements parses through the shared Zod builder and throws a 400 with the first plain message,
  elementsForRead converts a zones-only template on read (nothing is written to the database until an admin saves),
  editorVersionFor(elements, fallback) and storedEditorVersion(template) and assertTemplateDocSize.
  validation/template.schema.js: templateElementsSchema(context) is the one Zod array used by create, update,
  duplicate and restore (shape only - enums, numbers, lengths, unknown keys stripped), with validateElements in a
  superRefine for the value rules; createTemplateSchemaFor/updateTemplateSchemaFor are request factories carrying
  {cloudName, clientId}, so the route checks semantics and the controller re-checks with today's brand bands
  (validateElements skips the "fully inside" rule only when neither area, brandKit nor template is given).
  template.controller.js: LIST_FIELDS projection + lean() everywhere, Cache-Control no-store, GET /:id returns
  elements + editorVersion (converted when missing), create/update/duplicate/restore store clean items, an update
  that sends no items keeps the stored ones, every snapshot in versions[] carries the items and editorVersion, and
  oversize documents are refused before findOneAndUpdate (pre-validate hooks do not run there).
  routes/template.routes.js adds smallBody (1 MB per template write, 413 "That is too much to save at once…") on
  POST / and PATCH /:id; every other route, guard and message is unchanged, and the old client still saves
  size/zones/layout only. services/poster/design.js: elementSnapshot keeps all 30 items (prune caps arrays at 12)
  with every string cleaned, templateSnapshot always answers editorVersion and adds elements only when there are
  any, still inside DESIGN_MAX_BYTES 60 KB; the poster list projection now also excludes design.template.elements.
  BRAND_IMAGE_KINDS gains 'template' so POST /api/uploads/brand-image/sign with { kind: "template" } signs the same
  brand/<clientId> folder (no public_id in the response, 30 signatures per hour). No migration: old templates keep
  no elements and convert on read. Tests: `npm run test:elements` (68 assertions, plain Node, no database) and
  test-stage9 section 15 (save/one-headline/bands/min-size/font/hex/photo-ownership/HTML-stripped/31-items/
  oversized-document/409/restore-keeps-items/legacy-convert/user-403/other-tenant-404/snapshot-keeps-items);
  full run green: elements 68, stage9 174, stage8 83, brandkit 91, posterdesign 41, auth; `npm run build` clean
  (main chunk 412.51 kB, TemplateEdit 44.26 kB).
