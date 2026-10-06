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
- Template editor items 2a (client only) done: the client now draws a template's placed items.
  `client/vite.config.js` adds `server.fs.allow: [repoRoot]` (path resolved from import.meta.url) so
  the dev server serves `/shared`; the build bundles it for real (proved by grepping dist/assets for
  `field-photo` and `data-element`, both in the main chunk). utils/templateRender.js imports
  EDITOR_VERSION/legacyToElements/normalizeElements from `../../../shared/templateElements.js` and
  exports two functions: `usesTemplateElements(t)` (true only when editorVersion === 2 AND
  t.elements is a non-empty array - so old templates, old poster snapshots and the light list rows
  keep the exact flow layout they always had) and `templateElements(t, brandKit)` (stored items via
  normalizeElements, else legacyToElements). New components/PosterElementLayer.jsx renders each item
  as an absolute poster-px box (left/top/width/height, boxSizing border-box, pointer-events none,
  opacity when < 1, zIndex z+1) sorted by z: field headline/tagline/date/time/venue/details/photo
  fill from the poster content (photo = content photo or brandKit.content.defaultImageUrl), plus
  free text, image (crossOrigin anonymous, style.fit cover|contain, style.radius) and shape
  (rect|circle|line via fill/stroke/strokeWidth). Date/time/venue carry an optional lucide icon
  (showIcon) and uppercase mini label (showLabel); details draw up to 4 bullet lines. An item with
  no words and an empty photo render nothing at all - no blank label, no empty box, in the poster or
  the export. Text shrinks step by step from style.size down to style.minSize until it fits
  (scrollHeight vs clientHeight, which is still poster px under the preview's scale transform) and
  then reports through onOverflow with the same sentence the flow layout uses; a
  data-export-ignore "Content is too long" chip marks it in the editor only. PosterCanvas wraps the
  flow <ContentZone> in `{!items && ...}` and paints the layer as a canvas-root sibling at
  `absolute inset-0 zIndex 11 pointer-events none` (above every background layer, under the z-20
  brand bands), skips the out-of-column photo block in items mode, and fires
  onLayoutSettled({overflow:false}) once fontsReady so thumbnails/export do not wait on the 3.5 s
  timeout. AreaStage: the red "text area and photo area overlap" note is gone (with the now-unused
  overlap/areaOf/areasOverlap/AlertTriangle imports; areasOverlap is deleted from
  templateBuilderRules, overlaps() stays for the brand-area save rule). Server untouched.
  `npm run build` clean (main chunk 426.09 kB, TemplateEdit 43.82 kB); legacy gate checked in plain
  Node: editorVersion 1, editorVersion 2 with no elements, and a list row all stay false, while a
  converted legacy template yields field-headline…field-photo (7 items) and then reads true.
- Template editor items 2b (client only) done: each placed item now fits its own box, the page loads
  only the fonts it draws, and the look survives export.
  Per-item auto-fit lives in components/PosterElementLayer.jsx: `floor =
  max(ELEMENT_LIMITS.fontSize.min, min(style.size, style.minSize))`, the `useLayoutEffect` only acts when
  `boxRef.current.scrollHeight > clientHeight + 1` (so a box with room never shrinks), steps down by 8 %
  (`size - max(1, round(size*0.08))`), can never go under the floor or above the chosen size, and restarts
  from the chosen size whenever the `signature` changes (item id, size, w/h, the resolved words as text, the
  photo url, `fontsReady`, `fontTick` — so redrawing the same poster never re-fits). The fit waits for
  `fontsReady` because measuring before the real typeface arrives gives the wrong answer, and the layer owns
  `fontTick`, bumped by `document.fonts` `loadingdone` plus `fonts.ready`, so a font that arrives late
  re-runs every fit. Only at the floor does an item call `onReport(id, true)`; PosterCanvas turns any report
  into one amber "Words do not fit" chip rendered as a fragment sibling AFTER `#poster-canvas-root` (so it is
  outside the exported node) carrying `data-export-ignore="true"`, `position:absolute; top:12; right:12;
  z-index:60`. `FIT_QUIET_MS = 150` of silence drives `onFitted`, which is what releases the export/thumbnail
  settle wait; with no items it fires straight away from `fontsReady`.
  Real bug fixed in hooks/useGoogleFonts.js: it wrote ONE shared `<link id="poster-google-fonts">` from
  whichever poster mounted last, so a second poster's item fonts were silently dropped and text fell back to a
  system face in both the preview and the file. It is now a ref-counted union registry (module-level `requests`
  Map + `syncLink()`), one link holding every family any mounted poster needs, each hook instance owning a
  slot it deletes on unmount; weights 300-900 and `display=swap` unchanged. Verified: the link href carries
  Playfair Display + Inter + Montserrat + Roboto + DM Sans + Lato + Poppins + Nunito + Outfit and
  `document.fonts.check('24px "Playfair Display"')` / `"DM Sans"` are true.
  Render-time band clamp: utils/templateRender.js `templateElements(template, brandKit)` maps
  `clampItemToArea(item, contentArea(brandKit, template))` over the normalised items, so when the brand's
  header/footer heights changed after the template was saved the items are pulled into today's content area
  at draw time. Proved in plain Node with the sample ten items and bands forced to 200/260: headline
  y 150 -> 200 and the bottom line 1148 -> 1050 while `template.elements` still reads 150/1148 — saved data is
  never mutated. No new key, no migration, server untouched.
  /preview-test (still DEV-only, `import.meta.env.DEV ? <Route/> : null` in App.jsx, not linked anywhere)
  gained a "Placed item samples" section: ITEM_SAMPLE_KIT (the professional sample brand) + ITEM_SAMPLE_TEMPLATE
  (1080x1350, editorVersion 2, ten hand-placed items — headline Playfair 72/30, tagline Inter 22/14, a field
  photo 640x330 radius 18, a static image item 300x330, a line shape 960x6 #38bdf8, date and time 480x60 with
  icon+label, place 960x60, bullets 960x215, and one fixed DM Sans sentence) drawn three times from the same
  template: 1 ordinary words, 2 very long words (every box shrinks to its own floor), 3 no place + no photo
  (both draw nothing at all), each with a "Use above for export" button that loads it into the export panel.
  Export parity, measured headless through the app's own `exportPoster` on each sample (temporary probe module,
  since deleted): 9 files, zero warnings, PNG/JPG both 2160x2700 (pixelRatio 2), PDF `%PDF-1.3` with `/EOF`,
  1 page, a `/Font` entry and `/Subtype /Image`. JPG against PNG over the whole raster: mean channel diff
  1.46 / 1.57 / 1.37 out of 255, max 61, 0.000 % of samples over 60. Counting non-plate pixels inside every
  item's own rectangle proves each piece really paints — sample 1 headline 18774 (PNG) vs 18723 (JPG), photo
  210906 vs 210900, static image 75181 vs 74553, line shape 2879 vs 2880, and date/time/place/bullets/tagline all
  non-zero; sample 2 (long words) raises headline ink to 40876 and details to 21209; sample 3 has photo ink 0 and
  place ink 0 while the static image (75181) and the line shape (2879) come back byte-identical to sample 1, so a
  missing field subtracts nothing else. The exported headline's tight glyph box matches the DOM Range box to
  within a few poster px in width and wraps the same number of lines (e.g. dom [60,139,916,96] vs export
  [60,161,915,70]), which is only possible when the embedded font is the same face at the fitted size. The
  editor-only note stays out of the files: on a forced-overflow poster (headline box 100 px, floor 60 px) the
  chip is present in the DOM, `#poster-canvas-root.contains(note) === false`, and the PNG (2523932 B) /
  JPG (698357 B) / PDF (701619 B) of that same poster all count 0 amber pixels while every item region still
  has ink.
  `npm run build` clean: main chunk index-VKFx-5-J.js 427.84 kB (gzip 133.38), index CSS 43.02 kB,
  TemplateEdit 43.82 kB (gzip 13.72), Templates 13.53 kB, BrandKit 36.10 kB, History 26.62 kB, controls 17.70 kB,
  templateBuilderRules 6.58 kB, TemplateBuilder 4.84 kB, index-CyNOPa0n.js 13.12 kB, lazy export libs unchanged
  (jspdf 390.46, html2canvas 201.42, index.es 150.85, purify 29.40). No PosterStudioTest or probe chunk exists.
- Template editor items 3a (client only) done: /templates/:id/edit is a new editor, built from HTML/CSS and
  pointer events only - no editor library (konva/react-konva stay unused in src and still in package.json).
  Backups of everything replaced are in `.backups/template-editor-3a/`; `components/builder/AreaStage.jsx` and
  `AreaSettings.jsx` are deleted (only `VersionDrawer.jsx` remains there, still used behind a "Versions" button).
  New `utils/templateEditorItems.js` holds the item rules in plain words: HISTORY_LIMIT 50, NAME/NOTE_LIMIT 120,
  FIELD_LABELS/FIELD_ORDER, TEXT_VARIANTS (Heading/Subheading/Body), SHAPE_VARIANTS (a line is 520x24 so
  ELEMENT_LIMITS.minHeight can never be violated), itemsArea (shared contentArea), the six new*Item factories,
  duplicateItem, isTypedText/isPicture/hasWords/isHeadlineItem/itemLabel, cleanItems (normalizeElements + clamp),
  problemsFor, itemsSignature, patchItem (minSize never above size), moveItem, layersOf.
  `pages/TemplateEdit.jsx` (850 lines, still the lazy route behind ProtectedRoute
  allowedRoles ['superadmin','clientadmin'] + requireActiveClient): historyReducer {past,present,future} capped
  at 50 element-array snapshots, `edit(mutate,{live})` + txRef so one gesture or one typed edit is one undo
  step, `items = useMemo(() => cleanItems(hist.present, area))`, top bar (Back, inline editable name,
  Saved/Not saved chip, Undo, Redo, Preview, Versions, Save) plus a slim type/note strip, save() posting exactly
  { name, category, elements: items, note: note.trim() || undefined, expectedVersion: saved?.version },
  problems[0] blocking the save with a banner + `more` lines, 409/404 -> "This template was changed somewhere
  else. Reload to continue." with Reload this template, "Saved as version N" banner + toast, keyboard effect
  (Ctrl/Cmd+Z/Y, Escape closes the panel then the selection, Ctrl/Cmd+D, Delete/Backspace, arrows 1 px and 10
  with Shift, all suppressed while typing/previewing/with the drawer open), beforeunload + goBack confirm while
  dirty, header offsets 64 px + 44 px for superadmin, `!wide` -> "Use a larger screen to edit templates" plus a
  read-only preview, previewOn -> three PosterPreview renders (sample / long words / no photo).
  `components/editor/EditorStage.jsx` (627 lines) is the canvas: the real PosterCanvas underlay authored at poster
  px behind one `transform: scale(s)`, and a sibling overlay in screen px, so React never re-renders mid-gesture -
  `paint` on requestAnimationFrame writes only `translate3d` on the frame (plus `scale()` on resize with the 8
  handles counter-scaled `scale(1/sx,1/sy)`), translates the underlay `[data-element]` box and the selection bar and
  rewrites the size tag through a ref; the store commits on pointerup through onCommitRect. Exports moveRect,
  resizeRect (Shift on a corner keeps the ratio via factor = max(w/start.w, h/start.h)), clampTo (shared
  contentArea - x in [0, size.width-w], y in [header, size.height-footer-h]) and handleStyle (10x10 px,
  1.5px solid #2563eb, radius 2, calc(N% - 5px)). ItemFrame is memo'd with a stable registerFrame(id,node),
  aria-label "Date, 460 by 56 pixels, at 60, 780[, fixed in place]", aria-pressed, tabIndex 0, visible focus ring,
  Enter to edit text; locked items bail out of begin() so they cannot drag. BandOverlay dims the two brand bands
  (rgba(15,23,42,0.42)) with a lock badge and a BrandPopover [role=dialog][aria-label="Brand area"] holding a
  Link "Edit in Brand Kit" to /brand-kit. ZOOMS ['fit',50,75,100,150] bottom-right, fit =
  max(0.05, min(1, (clientWidth-32)/width, (clientHeight-32)/height)) with flex w-full min-h-full + padding 16 +
  margin auto so nothing clips, plus Hide/Show guides (aria-pressed) that keep the hit areas and drop only paint.
  `EditorRail.jsx`: nav[aria-label="What to add"] at w-16 with Fields/Text/Images/Shapes/Layers, and EditorPanel
  [role=dialog] absolute left-0 z-[55] w-[300px] max-w-[86vw] that slides over the canvas, closes on Escape or a
  canvas click; Fields adds only missing fields and can never remove the headline ("The headline always stays on
  the poster."), Text explains double-click, Images reuses BrandImageField kind="template" + "Use your
  organization's own photo", Shapes gives box/circle/line + Shape colour + Line thickness, Layers lists top-first
  with Bring forward/Send backward/Keep in place. `ItemToolbar.jsx` floats at the top of the canvas (font/size/
  colour + hex/bold/italic/all capitals/align/letter spacing/line height for words, "Fill the box"/"Fit inside"
  + Rounded corners for photos); `SelectionBar.jsx` is the small bar beside the selection (size chip, Keep in
  place, Make a copy, Remove, Position popover 228 px with From left/From top/Width/Height, Bring forward/Send
  backward/Done, opens upward when it would run off the poster); `ItemTextEditor.jsx` is the double-click
  contentEditable in the item's own face at size*scale, plain-text paste trimmed to the remaining room out of
  ELEMENT_LIMITS.textChars 200, Enter commits, Escape cancels, blur commits.
  Verified headless in a real browser at 1440x900 through a temporary DEV /editor-probe harness (since deleted,
  together with client/public/probe-host.html and its two App.jsx lines; the port-5311 dev server is stopped):
  rail 64 px, zoom row Fit/50/75/100/150, poster 540x675 centred with scrollWidth == clientWidth (no overflow) at
  fit and 810x1013 scrollable at 75 %, 8 handles exactly 10x10 with the spec border, mid-gesture paint only a
  translate3d with handles counter-scaled, commit on pointerup (Date 60,780 -> 100,800), headline clamped at
  x = 120 = 1080-960, Shift+SE 520x116 -> 879x196 keeping ratio, arrows 1/10 px, Ctrl+D 7 -> 8, Delete refusing
  the headline and removing Time with Ctrl+Z restoring, Escape deselecting, the Position popover committing
  Height 24 and reordering, an illegal 960x6 shape refused with "The shape is too small. It must be at least
  40 x 24.", PATCH keys exactly [category, elements, expectedVersion, name, note] -> "Saved as version 4", the
  forced-409 path with a working Reload, Fields/Shapes/Layers panels adding and selecting items with the panel
  closing on a canvas click, brand popover linking to /brand-kit, Hide guides clearing all handles/badges/tags while
  a drag still worked, locking making an item undraggable and flipping the label to "Allow moving", in-place text
  opening focused in DM Sans at the item's rect with an HTML paste inserting only its plain words and 400 typed
  characters truncating to exactly 200, Font/Bold repainting the live poster and a 200-character note auto-fitting
  26 px -> 18 px, and the console holding only the two pre-existing Router warnings. `npm run build` clean:
  TemplateEdit-DwYaCq29.js 67.24 kB raw / 19.59 kB gzip (well under the ~80 KB budget, its own lazy chunk,
  0 konva matches), main chunk index-DguC_ra7.js 431.17 kB / 134.73 kB gzip, CSS 47.48 kB / 8.38 kB, Templates
  13.53 kB, BrandKit 46.54 kB, History 26.62 kB, TemplateBuilder 5.31 kB; no probe chunk and no probe-host.html
  in dist. Server and data formats untouched; the only deviation from the brief is the retained "Versions" button
  (the restore flow from 9C still needs it).
- Template editor items 3b (client only) done: the five rail panels and the canvas are now a real editor, still
  one lazy chunk and still no library. Backups of everything replaced are in `.backups/template-editor-3b/`.
  New `utils/editorGuides.js` is the snapping rule set: SNAP_PX 6, GRID_STEP 10, GRID_MAJOR 50,
  `guideTargets(area, items, excludeId, { width, height, hidden })` (poster centre, the content area's edges and
  centre, and every visible other item's left/centre/right and top/middle/bottom, plus `bounds`),
  `nearestSnap(rect, targets, limitPx, gesture)` and `gridBackgroundImage(size, scale)`. `gesture` is
  `{ mode, handle }` so a resize only ever moves the edge being grabbed (the opposite edge stays put, minimum size
  held), while a move slides the whole box; the result is then clamped with `clampRectToArea` and any guide that
  fell outside the final box is dropped. `EditorStage.jsx`: snapping runs inside the existing requestAnimationFrame
  `paint()` (no React mid-gesture), `snapLimit = guidesOn ? min(24, max(6, round(6 / scale))) : 0` so it is always
  about 6 SCREEN pixels whatever the zoom and 0 while guides are hidden; guide lines are 1 px `rgb(244,63,94)`
  divs written into `[data-editor-guides]` (zIndex 38) keyed by a `dataset.keys` bail-out and cleared on pointerup;
  a non-passive `wheel` listener returns at once unless ctrl/meta is held, so ordinary page scrolling over the
  canvas is untouched, and with a modifier it `preventDefault()`s and steps the zoom 5% around the point under the
  cursor (`anchorRef` + a `useLayoutEffect` that re-scrolls after the size changes) - `ZOOMS ['fit',50,75,100,150]`
  with `ZOOM_FLOOR 10` / `ZOOM_CEILING 400`; Space (`event.code`, ignored while typing) switches to pan (cursor
  `grab`, "…holding Space: dragging moves the view", `startPan` writes `scrollLeft/scrollTop`, `begin()` bails);
  the readout is "{percent}% · {w} × {h}"; the bottom-left row is Hide guides + Show grid (`aria-pressed`, the grid
  layer is `[data-editor-grid]`). Hidden items are editor-only: `hiddenIds` become one
  `<style data-editor-hidden>` `[data-element="id"]{visibility:hidden}` written inside the scaled poster layer but
  OUTSIDE `#poster-canvas-root`, so nothing about the poster or the PNG/JPG/PDF export changes; a hidden frame is
  dashed `#94a3b8`, has no handles, and its aria-label ends ", hidden while you edit".
  `EditorRail.jsx` (~700 lines) gains four shared controls - `Row` (optional drag grip + dashed drop target),
  `ColourRow` (swatch + hex box; the box now owns its typed draft, so typing works, Enter commits, Escape cancels,
  empty means "no colour"), `AmountRow` (slider, live while dragging, one undo step on release) and `NumberRow`.
  Images: `BrandImageField insert kind="template"` uploads JPG/PNG/WebP up to 5 MB, resized in-browser to 2000 px
  and signed through `/api/uploads/brand-image/sign`, straight to Cloudinary with real % and a thumbnail, and the
  result is inserted as a static image item; the note reads "…N of 6 spaces left", and at six photos the uploader
  is replaced by "This template already has 6 photos of its own, which is the most it can hold. Take one away
  below…" and "Add an empty photo space" is disabled as "No photo spaces left (6)" (`AddButton` gained
  `disabled`). A selected picture gets Choose a different photo, "Use your organization's own photo", Rounded
  corners and See-through; a photo *field* says it shows the photo that comes with each event instead. Shapes:
  type buttons (Box/Circle/Line) plus Fill colour, Border colour, Border thickness 0-12, Rounded corners for a
  box only, Line colour + Line thickness for a line only, and See-through for all. Layers: top-first list with a
  grip that drags through the pointer (`document.elementFromPoint` → the row under the pointer dashes, release
  calls `dropLayer`), Bring forward / Send backward, Keep in place, Eye / EyeOff "Hide while you edit", and Remove
  (disabled on the headline). `pages/TemplateEdit.jsx`: `gridOn` + `hiddenIds` state (hidden is session-only,
  cleared when a template loads and when an item is removed), `addPhoto` shared by `addImage`/`insertImage` with
  the banner "A template holds at most 6 photos of its own. Remove one first.", `moveLayer`/`dropLayer`/
  `toggleHidden`, panelActions extended with `setStyle`/`setStyleLive`, the Preview branch now showing FOUR samples
  (Sample words / Long words / No photo / No place - the fourth empties `venue`, and the item that would draw it
  draws nothing), and the old top-bar Eye button replaced by a `role="group"` Edit | Preview segmented control
  with `aria-pressed`. Two real bugs found while measuring: `shiftLayer`'s sign was inverted against its own doc
  (delta +1 moved an item toward the bottom, so the panel's arrows swapped places - now +1 really brings forward),
  and the Position popover said "Bring forward/Send backward" while calling `moveTo('front'|'back')`, so the
  buttons now say "Bring to the front"/"Send to the back". Verified headless in a real browser at 1440x900 through
  a temporary DEV /editor-probe harness (since deleted, with `probe-host.html` and both App.jsx lines) that mounted
  the real TemplateEdit over stubbed api + fake XHR: an upload produced the sign call with `kind:'template'`, a
  direct POST to `https://api.cloudinary.com/v1_1/probe-cloud/image/upload`, "Uploading 4% … 100%", "89 B · 8×8 px"
  and a new image item with its own frame, "5 of 6 spaces left" counting down to the six-photo warning with the
  uploader gone; shapes fill #123456, border #abcdef typed and #abcdef painted `rgb(171,205,239)`, a bad word
  refused and reverted, cleared to `none` (border 0 px), thickness 7, radius 10 → 44 px, opacity 0.45, and the
  circle/line variants exchanging their controls; Layers dragged 'box' above 'tagline' (z re-handed 1…10), arrows
  one step each way, lock, hide (`<style data-editor-hidden>` outside `#poster-canvas-root`, visibility hidden then
  back to visible with the rule gone), row click selecting, Remove dropping to 9 frames and the headline's Remove
  disabled; a drag snapped a box's right edge onto the poster centre (298 → 300) with two rose guide lines mid-gesture
  that cleared on release; wheel zoom `plain:false / ctrl:true` 50% → 55% → 50%; Space pan at 150% (scrollLeft
  120 → 180, cursor restored); four previews with the fourth holding no place text; Versions list, inline Preview
  and Restore POST; Save posting exactly [category, elements, expectedVersion, name, note] → "Saved as version 4"
  and the forced 409 banner with a working "Reload this template"; console holding only the two pre-existing Router
  warnings and the probe's own dead image URLs. `npm run build` clean: TemplateEdit-CsF37zSV.js 84.72 kB raw /
  24.83 kB gzip (3a was 67.24 / 19.59, still its own lazy chunk, 0 konva matches), main chunk index-DIaXxbGK.js
  431.17 kB / 134.73 kB gzip, CSS 48.37 kB / 8.48 kB, BrandImageField still separate at 7.18 kB, Templates 13.53,
  BrandKit 46.54, History 26.62, TemplateBuilder 5.31; no probe chunk. No new dependency, no new environment
  variable, no file under /api, server and saved data shapes untouched (the payload is still the same element list).
- Poster in-place editing (client only) done: the Create page and an opened saved poster now edit the poster where it
  stands. New utils/posterContentFields.js is the one client source for the poster's own words: CONTENT_LIMITS (mirrors
  the API's content schema — title 60, tagline 100, date 30, time 20, venue 80, detail 90 x4), LOCKED_MESSAGE "Locked by
  your organization", POSTER_FIELDS/FIELD_LABELS/TEXT_FIELDS (Headline, Line under the headline, Date, Time, Place,
  Extra lines, Photo), normalizeFieldName (description -> tagline), wordsOf/linesOf/withFieldWords (a single-line field
  collapses newlines and cuts at its limit, Extra lines keeps max 4 lines x 90), photoUrlOf, and the session-only look
  overrides emptyView/withFieldSize/withWholeMax/withPhotoFit + viewsEqual/viewIsDirty. sizeRangeOf(template, brandKit,
  field) answers in two modes: a placed-item template gives that item its own chosen size down to its own smallest
  readable size; an older layout gives the whole text column the template's smallest text up to the largest size the
  renderer can actually reach (the ceiling mirrors PosterCanvas: 1.12 x the 32 px details unit x the content-zone unit,
  so 34 px on a 940x1080 zone) — offering a declared maximum above it would be a stepper that changes nothing.
  PosterCanvas gains a `view` prop that is never saved with the poster: its items memo re-applies sizes and photoFit onto
  the resolved elements, capFont honours view.wholeMax, and ContentZone paints photoFit as object-fit on both photo blocks,
  now marked data-item="photo"; PosterPreview, PosterExportButtons and utils/posterThumbnail.jsx all take and forward it,
  so the live preview, the PNG/JPG/PDF and the background thumbnail draw the same look.
  components/posteredit/EditablePoster.jsx is the lazy boundary (EditablePoster-*.js 15.45 kB / 6.00 kB gzip): it builds
  descriptors for both render modes (every placed item plus the two brand bands from resolvePosterBrand; an older layout
  answers with its seven painted word groups and uses the image zone as the picture's fallback rectangle), measures each
  one in screen px from its own DOM rect (or its laid-out rectangle when a field holds no words yet) against the scaled
  poster, and lays a pointer-events-none layer of real <button data-poster-hit> boxes over it. Click selects, double-click
  or Enter opens FieldTextEditor.jsx — a contentEditable plate exactly over the words whose face comes from typeOfElement(),
  which descends to the element that actually holds the text so it matches the painted size, weight, spacing, alignment and
  capitals; paste and typing are hard-trimmed to limitOf(field), Extra lines allows 4 lines, Enter commits, Escape
  cancels — and a click on a static item or a brand band answers only "<Label>: Locked by your organization." and opens
  nothing. SizeStepper.jsx offers smaller / larger / the px readout / Reset inside sizeRangeOf and nothing else: this UI
  has no move, resize or delete affordance at all. PhotoBar.jsx over the picture offers Replace (the picture this poster
  came with and the organization's, with thumbnails, or "No other picture is ready for this poster yet. Use Upload to add
  one."), Upload (browser-side resize then the existing POST /uploads/brand-image/sign direct Cloudinary upload with real
  %), Remove and Fit: fill|whole; taking the picture out while the brand kit has its own says "Your organization’s
  picture takes its place." Generate.jsx now centres a big stage (STAGE_WIDTH max-w-560 / xl-660) around
  <Suspense><EditablePoster/></Suspense>, routes its changes through handleStageContent (a picture put in replaces the one
  the poster came with, exactly as the side form does), keeps EditTextPanel for keyboard and mobile users (its local LIMITS
  object deleted, it imports CONTENT_LIMITS), keeps the quick-change buttons, adds Save changes to the toolbar (the same
  Stage 8 runSaveOp create/patch with expectedVersion; a headline-less save now reports through the on-page feedback line
  instead of an invisible drawer error), resets posterView on load and reload, still queues the thumbnail only after a real
  save and never blocks, and shows one plain line under the poster while a size or photo-shape change is on screen
  ("Text size and photo shape apply on this screen and in the file you download."). Verified headlessly through a
  temporary DEV /poster-probe harness (since deleted, with probe-host.html and its two App.jsx lines) that mounted the real
  stage twice — a 10-item editorVersion-2 template (one field locked, one free text, one shape) and an editorVersion-1 flow
  template — at 1440x900 with locally painted pictures (this browser cannot reach external hosts): 12 and 8 hit boxes on
  the painted rects with the ring and 10% tint only on the chosen one; stepper 72 -> 66 -> floor 30 with "These words are
  already as small as they can be." and Reset returning the view to {} while the painted item followed (inline 30px); flow
  mode reading the reachable ceiling 34 and stepping to 16 shrank the headline 104.53px -> 66px and the place line
  37.02px -> 23.38px, and Reset cleared wholeMax; a pointer drag on a box moved nothing and left content and view untouched
  (0 handles, no nested controls); double-click opened the editor focused on the exact words at Playfair Display 700
  41.33px (= 72 x the poster scale) and at 9.19px with 1.72px spacing uppercase for the line under the headline, a 90-character
  paste committed exactly 60 into the headline and 80 into the 100-character line, Enter at the fourth extra line committed
  and closed, Escape left the words untouched; clicking the picture opened Replace/Upload/Remove/Fit, picking "Your
  organization’s picture" rewrote imageUrl, Remove emptied it and disabled itself, Fit flipped the painted object-fit
  cover <-> contain and the view back; an 8 MB file failed in the browser with "That image is 8.0 MB. Please choose one
  under 5 MB." inside the bar and a small file really reached POST /api/uploads/brand-image/sign (401 only because the
  harness is unauthenticated); the locked line's aria-label reads "Line under the headline, Locked by your organization"
  and its double-click opens nothing; Tab + Enter edits and Escape returns. Generate wiring checked by reading the live
  file (no local credentials, so no logged-in run). Server, /shared rules and every saved shape untouched; no new
  dependency, no new environment variable, no file under /api. `npm run build` clean: EditablePoster-C9z_UWn7.js
  15.45 kB / 6.00 kB gzip as its own lazy chunk, TemplateEdit 84.31 kB / 24.74 kB, main chunk index-B5bJ04Vk.js
  436.90 kB / 136.69 kB gzip, CSS 48.51 kB / 8.53 kB, BrandKit 46.58, History 26.62, Templates 13.53, brandImage 4.12
  shared with the stage; no probe chunk in dist.
- Variable items 1 (server + /shared only, /client untouched) done: a template item of kind text|image can be
  marked `variable` so the assistant fills its words (`extras`) or a person replaces its picture (`images`).
  /shared/templateElements.js owns every rule: VARIABLE_LIMITS (10 fill-in texts, 4 fill-in photos, key 2-24
  `[a-z0-9_]`, label 30, hint 80, maxLength 10-200 default 80, all answers on one poster under 4 KB),
  VARIABLE_KEY_PATTERN, `variable`/`key`/`label`/`hint`/`maxLength` in normalizeElement (a variable item with no
  key gets a derived one, HTML is stripped from label/hint), the counting + plain-word messages in validateElements
  ("Only a text box or a picture of its own can be filled in later.", "Two fill-ins share the name ...",
  "A template can hold at most 10 texts to be filled in." / "... 4 photos to be replaced."), and the poster side:
  `elementsOfDesign`, `variableSlotsOf` -> {texts,images}, `aiSlotsOf` (exactly key,label,hint,maxLength),
  `checkContentImageUrl` (https + this client's brand/<clientId>/ folder, or images.pexels.com) and
  `resolveContentValues(content, {elements, cloudName, clientId})` -> {extras, images, problems}, which rejects an
  unknown key, a non-string answer, an answer over the blank's own maxLength and a foreign photo, and only then
  checks the 4 KB total. Template.model.js (elementSchema) and validation/template.schema.js declare the five keys,
  so create/update/duplicate/restore all persist and validate them through the existing cleanElements path - no new
  route, no migration. Poster.model.js content + every versions[] entry carry optional `extras`/`images` objects;
  poster.schema.js validates the key shape only and the real meaning is `services/poster/content.js`
  `contentValuesContext(source, clientId)` (reads the design the content belongs to: the snapshot being captured on
  create/regenerate, the poster's own stored snapshot on PATCH/restore/duplicate/apply-latest) handed to
  normalizePosterContent, which is the one gate all six write paths use, so a later template edit cannot strand an
  old poster's answers. `elementSnapshot` keeps key/label/hint cleaned, so poster.design.template still carries each
  blank's own definition under the 60 KB cap. AI: generatePosterContentController reads `variableSlotsOf(template.elements)`,
  passes only `aiSlotsOf` text blanks as `variables` to generateContent and answers
  `data.imageSlots` [{key,label}] for the photo blanks (never generated); prompt.js appends a short blanks block
  (key: label (hint) - up to N characters, or "" if the user did not say it), ai/schema.js gains `extras`
  (maxProperties 10, string, maxLength 200) plus `contentSchemaFor(slots)` with `additionalProperties:false`,
  `sanitizeAndTruncateContent(raw, variables)` cuts each answer at a word boundary and drops invented keys, and
  `validatePosterContent(data, variables)` uses the strict validator only when the template offers blanks;
  providers/mock.js returns `Sample <label>` trimmed to the blank's room and omits `extras` entirely when there
  are none, so old responses are byte-identical. Tests: `npm run test:elements` 99 (shared rules incl. poster
  answers), test-stage5 (`node server/scripts/test-stage5.js`) 38/0 (generation fills extras, lists photo blanks,
  cross-tenant 404), `npm run test:stage8` 108 (save/PATCH/versions/restore/duplicate judged against the poster's
  own snapshot, Pexels accepted, foreign + other-tenant folder refused), `npm run test:stage9` 199 (10/11 texts,
  4/5 photos, shared and badly spelled keys, maxLength 300, stripped label, history + snapshot keep the blanks);
  brandkit 91, posterdesign 41, auth all green; `npm run build` clean (main chunk 438.85 kB / 137.42 gzip,
  TemplateEdit 84.31 kB, nothing under /client changed). Backups of the 15 files replaced in
  `.backups/variable-items-1/`. Known gap: the /client editor and poster stage do not read or write the new
  variable fields yet, so an admin cannot mark a blank and a user cannot answer one from the UI.
- Variable items 2 (client only) done: the template editor now authors the blanks.
  `client/src/utils/templateEditorItems.js` owns the authoring rules on top of the shared file:
  `modeOf` (ai|user|locked), `isAiText/isUserImage`, `aiTextCount/userImageCount/counterLine`
  ("3 of 10 AI texts", "1 of 4 user images", `fullTexts`/`fullImages`), `LIMIT_MESSAGES` (the two
  plain sentences shown when a cap is hit), `defaultHint` ("Write this from the user's description:
  <label>"), `labelFromWords` (30 chars, plain), `uniqueKey` (from the label, `_<n>` on a clash, cut to
  24), `copyLabel` (label + " copy"), `newTextItem/newImageItem(..., {variable})`, `setItemMode` (one click
  either way; an AI text keeps its words as the blank's name), `setItemMeta`, `commitItemText` (renaming
  follows the label and an erased box falls back to the name), `looksLikeFixedText` (over 30 chars or ends
  like a sentence) + `FIXED_TEXT_WARNING`, `fixedTextProblems` (a fixed text box that is empty or still
  holds a preset default blocks Save), `keepWithinLimits(incoming, list, area)` (an over-cap copy or paste is
  placed as a fixed item and says why), and the sessionStorage clipboard `writeClipboard/readClipboard`
  (key `poster-template-clipboard`, items only, re-ids, re-keys, `copyLabel`, +24 px offset, clamped into
  today's content area, refused whole if a photo URL fails `checkElementImageUrl`, which degrades to the
  `https://res.cloudinary.com/` prefix because the client never learns the cloud name).
  `TemplateEdit.jsx`: `addText`/`addPhoto` create a blank while room remains and otherwise create a Locked
  item with the reason in a new amber `warn` banner; `changeMode`/`changeMeta`; `duplicate`/`copyItem`/
  `pasteItem` all through `keepWithinLimits`; Ctrl/Cmd+C and Ctrl/Cmd+V joined Ctrl/Cmd+D (paste works with
  nothing selected); save gate is `problemsFor` (shared) + `fixedTextProblems`. `ItemToolbar.jsx`:
  "Who changes this?" segmented Locked | "AI fills it, users can edit" (text) / "Users replace it" (image),
  both counters, "Edit label and hint" popover (Name of this blank / "What should the AI write here?" /
  Longest it may be, 30 and 80 counters) and the fixed-text warning. `EditorStage.jsx` `ItemCues`: sparkle
  badge on AI text, picture badge on a user image, lock badge on a locked text/image, all `data-export-ignore`
  and all in the screen-px overlay (never in the exported node); an empty user image shows the dashed "The
  person filling this in chooses the picture" tile and `PosterElementLayer` paints nothing for it, so it is
  absent from the poster and every file. `EditorRail.jsx`: panel titles "Add text" and "Built-in fields" each
  with a one-line help, the counters in the footer, the at-cap notes, and Layers showing the same badges.
  Verified headless through a temporary DEV /var-probe harness (since deleted, with the page file, the Node
  rule probe and both App.jsx lines) over the real EditorRail + EditorStage + ItemToolbar: "Add Heading"
  produced `heading` then `heading_2…heading_10` with the sparkle badge and "N of 10 AI texts", the 11th
  came back fixed with the cap sentence, one click flipped the badge from sparkle to lock and moved the box
  into `fixedTextProblems` ("A text box still holds the words it came with"), an empty photo space drew the
  placeholder tile and nothing in `[data-element]`, "Copy picked" wrote the one sessionStorage key and
  "Put back" refused with "There is nothing to put back yet…" when empty and otherwise re-issued
  `text-16/heading_copy`. The paste cap is proven in plain Node: at 10 AI texts `keepWithinLimits` returns
  the demoted item (`variable` false, no key) plus the same sentence. Found and fixed while verifying: the
  harness pasted without the page's guard, which is why the guard moved out of `TemplateEdit.jsx` into the
  shared util, and `ItemCues` read an undefined `picture` (now a local `fillable`). No library added, no new
  env var, nothing under /server or /shared touched, payload shape unchanged; backups of the replaced files
  in `.backups/variable-items-2/`. `npm run build` clean: TemplateEdit-Ce2drrY2.js 100.42 kB / 29.38 kB gzip
  as its own lazy chunk (0 konva, 0 probe references), main chunk 438.95 kB / 137.43 kB gzip, CSS 49.47 kB.
  Remaining gap: `PosterElementLayer` still draws a variable text item's own words and does not read
  `content.extras`, so a person answering a blank on the poster stage is the next piece.
- Variable items 3 (client only) done: a poster now answers its own blanks. Nothing under /server or
  /shared was touched and no new dependency or env var exists.
  New `utils/posterVariables.js` is the one client reader of the blanks: `itemsOf` takes the poster's
  design snapshot first and a plain template otherwise (so an unsaved poster shows its spaces too),
  `blanksOfDesign(design) -> {texts,images}` with each blank's own `placeholder` (the item's `text` /
  `imageUrl`), `blankLimitOf`, `hasBlanks/blankTextKeys`, `blankLabel`, `wordsOfBlank/imageOfBlank`,
  `withBlankWords` (an empty answer DELETES the key, so the poster falls back to the designer's words),
  `withBlankImage`, `blankPayloadOf` (both absent when empty), `blankAnswersProblem` (per-blank maxLength,
  then each picture through `checkContentImageUrl`, then the 4 KB budget; the cloud name is never known in
  the browser so the folder rule is the one checked here and the server answers on save),
  `blankImageProblem`, `mergeGeneratedBlanks(next, previous, editedKeys)` (every picture a person put in
  stays, every text they typed by hand is kept, the rest is written again), `canUploadBlankImage(user)`
  (superadmin|clientadmin only), `BLANK_IMAGE_MAX_BYTES` 2 MB + `checkBlankImageFile` (JPG/PNG/WebP) and
  `BLANK_MESSAGES` in plain words. `posterContentFields.js` gained the session-only picture shape
  `withBlankFit/blankFitOf` (`view.blankFits[itemId]`, carried through `carried`, so `viewsEqual` and
  `viewIsDirty` know it) - the shape never touches the template item and is never saved.
  `PosterCanvas` re-applies those fits in its items memo; `PosterElementLayer` resolves a blank as
  `content.extras[key] || item.text` and `content.images[key] || item.imageUrl`, so the answer wins, the
  designer's words or picture show until somebody answers, and a space with neither paints nothing at all
  (absent from the poster and from every file); its per-item auto-fit is unchanged, so filled words still
  shrink inside their own box.
  `components/posteredit/VariableFields.jsx` (NEW, own lazy chunk 5.30 kB / 2.31 kB gzip, imported through
  React.lazy inside EditTextPanel so it is never in the main path) is the "Spaces to fill in" section: one
  labelled input + `n/max` counter per text blank (150 ms debounce into `onContentChange`, a `sentRef` so
  the content-sync effect never overwrites what this panel just typed, an untouched box reading the answer
  already on the poster, and the designer's words as the input's placeholder + "Leave it empty and the
  poster keeps the words the designer wrote in the box."), one tile per picture blank with the answer or the
  designer's picture, the state line ("Your picture is in place" / "The designer's picture is here so far" /
  "Nothing here yet") and the shared `PhotoBar` (Replace with thumbnails, Upload, Remove, Fit: fill|whole);
  it returns null when the design has no blanks. `EditTextPanel` takes `blankDesign/blankView/
  blankAlternatives/canUploadBlanks/onBlankContent/onBlankView/onBlankEdited` and renders it under Photo.
  `EditablePoster` now builds a `blank` descriptor for every `variable` text/image item (`editable` true
  whatever the item's locked flag, label = the blank's name, `rect` = the item's own rectangle so an empty
  unpainted space still gets a hit box): double-click opens `FieldTextEditor` at the blank's own
  maxLength (`maxChars`, single line for a blank), committing through `withBlankWords` + `onBlankEdited`;
  clicking a blank picture opens that blank's bar with `currentUrl` = the answer (so Remove disables itself
  when nothing was answered), choices = the designer's picture + the organization's photo + the poster's own
  + any other blank's answer, and `blankImageProblem` refusing a foreign photo inside the bar; a blank gets
  no size stepper (its size belongs to the template) and a locked item still answers only "Locked by your
  organization". Upload uses the existing `uploadBrandImage` direct-to-Cloudinary path (2 MB checked in the
  browser, shrunk to 2000 px, real % progress) with `kind: 'content'`, whose signed folder is
  `brand/<clientId>` - the only folder the server accepts for `content.images`.
  `Generate.jsx`: `buildContentPayload` sends `extras`/`images` only when there are answers, so the dirty
  check, `markSaved`, `queueThumbnail`, PATCH/POST bodies, the export buttons and the drawer previews all
  carry them (requirements 5 needs no other change - History and the drawer already spread `content`);
  `editedBlanksRef` (a Set, cleared when a poster is loaded or reloaded) is fed by both the stage and the
  panel and `runGenerate` (also every quick-change button, which calls it) merges through
  `mergeGeneratedBlanks` so a hand answer and every blank picture survive while a new photo changes only
  the poster's own `imageUrl`; `handleSaveChanges` refuses with `blankAnswersProblem` before the PATCH, and
  `blanksSource = posterDesign || drawTemplate` keeps the panel reading the poster's own snapshot.
  Verified: 35 assertions over the real rendered markup (react-dom/server, temporary probe since deleted) -
  the answer paints and the placeholder does not, a space with no words paints nothing, the fixed line and
  the poster's own words are unchanged, a blank picture's answer paints and an unanswered one falls back to
  the designer's, the painted node carries the `data-element` marker the stage measures, the panel lists
  every space including the one the assistant left empty, counters show each blank's own room, a plain
  account gets 0 Upload buttons and the administrator line instead while an administrator gets one per
  space, and the regenerate merge keeps `Dr. Rao`, re-fills the untouched blank, holds the picture and
  trims/payloads both answer sets; plus 32 plain-Node assertions on the util itself (snapshot vs plain
  template vs light list row, default maxLength, empty answer deleting its key, the 2 MB/type checks, the
  session fit). The poster stage's hit boxes are built from DOM measurement in a layout effect, so they
  cannot be rendered server-side: their wiring was read against the previous stage's real-browser pass, and
  no logged-in browser run was possible here (no local credentials, and the browser tools were refused).
  Caveat to decide later: giving a plain `user` the ability to upload into a blank needs a server route that
  signs into `brand/<clientId>` for that role (or a `content.images` rule that accepts the poster-images
  folder) - both are /server changes and were out of scope. Backups of the replaced files are in
  `.backups/variable-items-3/`. `npm run build` clean: VariableFields 5.30 kB / 2.31 kB gzip and
  EditablePoster 13.75 kB / 5.63 kB gzip as their own lazy chunks, PhotoBar split out at 4.14 kB (shared by
  the stage and the panel), TemplateEdit 100.40 kB / 29.37 kB unchanged, main chunk 445.18 kB / 139.65 kB
  gzip (posterVariables sits there because Generate is in it), CSS 49.51 kB / 8.70 kB, no probe route, page
  file or probe chunk in dist.
- AI DESIGN 1a (shared + server validation only, /client untouched) done: a template can now hold a
  drawn picture, and /shared/designRecipes.js builds whole designs from the brand kit.
  /shared/templateElements.js: ELEMENT_KINDS gains 'icon'; ICON_GROUPS lists 33 lucide names by kind of
  event (health, festival, sports, education, corporate, awareness, meeting, notice, celebration, general),
  ICON_NAMES the flat unique set, ICON_FALLBACK 'star', ICON_STROKE_DEFAULT 2, iconForCategory(category) and
  normalizeIconName(value) (lower-case, spaces to dashes, only a listed name survives). ELEMENT_LIMITS gains
  iconStrokeWidth {1,4} and nameChars 40; ELEMENT_KEYS gains 'name', ELEMENT_STYLE_KEYS gains 'strokeWidth';
  normalizeElement gives an icon its cleaned name and a clamped line thickness; labelFor reads "icon (…)";
  validateElements refuses a missing name ("An icon needs a picture chosen from the ones this app draws."),
  an unlisted one, and a line outside 1-4 px in plain words. Rounded pills are the existing rect with
  style.radius, plus circle and line - no new shape type.
  Server: validation/template.schema.js declares name (<=40 chars) and style.strokeWidth, models/Template.model.js
  declares both on elementSchema/elementStyleSchema (strokeWidth with no default so a field keeps its own
  shipped value), so create/update/duplicate/restore persist an icon through the existing cleanElements path -
  no new route, no migration, no env var. services/poster/design.js needs no change (elementSnapshot spreads
  the item), so a poster snapshot keeps its icons.
  /shared/designRecipes.js is pure: no imports beyond /shared/templateElements.js, no env, no Date, no random,
  so the same words always build the same design. Exports RECIPE_VERSION 1, DESIGN_CATEGORIES, RECIPE_VARIANTS
  [0..3], RECIPE_PALETTES (brand|bright|deep|duo), RECIPE_TYPE_STYLES (bold|elegant|compact), RECIPE_DECORATIONS
  (none|ring|dots|corners), RECIPE_ARTWORKS (none|medallion|emblem|stacked), RECIPE_OPTIONS_DEFAULT,
  MIN_RECIPE_FONT 20, DECORATION_MAX_OPACITY 0.08, DESIGN_BLANKS, tint/shade, brandOf, slotsOf, DESIGN_RECIPES,
  designById (case-insensitive), recipeIds, designsFor, suitsCategory and buildElements(id, {area|brandKit+size,
  slots, options}) -> {elements, problems, design, options}. brandOf reads six colours and two fonts only
  (never a url, id or secret); every colour a design paints is a brand colour or a tint/shade of one, the nine
  BRAND_DEFAULTS hexes being only the kit's own shipped fallbacks. slots = {headline, tagline, date, time, venue,
  details<=4, extras{title_sub, slogan_1, slogan_2, cta_line, cta_button}, icon, imageUrl}; a poster part with no
  words is not placed at all (the headline always is), so no hole shows. Built-in fields carry headline, tagline,
  date, time, venue, details and photo with empty text (the poster brings the words); the five extras are always
  offered as variable items with underscored keys, a plain label, a hint and their own maxLength (40/34/34/48/20).
  A supplied photo is only baked in when it is a Cloudinary address, so a Pexels url can never be stored in a
  template. Rows are laid by a cursor (rowsIn) and columns by colsIn, so two boxes of words can never touch;
  collect() adds the decorations, re-clamps every rectangle into today's content area and caps at 30 items.
  Five designs, each with id, name, suits, needsPhoto, recipeVersion and its function: hero (title over a
  two-tier block, a round medallion with a picture or a photo, two slogans beside it, a rounded info pill with
  date | venue | time and marks, a call to action and a button), photoTop, splitPhoto, typographic, boldBand.
  Tests: new server/scripts/test-design-recipes.js = `npm run test:recipes`, 121 assertions and no rendering -
  240 builds (5 designs x 4 shapes x 4 palettes x 3 sets of words: normal, very long, no place and no photo) each
  proved inside the brand bands, at least 40 x 24 with 20 px minimum text, no word box overlapping another, unique
  names, within the item and fill-in counts, accepted unchanged by the server's own cleanElements and
  validateElements and identical when built twice, every painted colour reachable from the brand kit in at most
  two mixings, another brand kit changing 7 of 7 colours; plus the icon rules, the five underscored keys, the
  built-in fields, the "no words means no box" cases and four poster sizes from 600 x 800 to 2400 x 3200.
  All suites green: recipes 121, elements 99, stage5 38, stage8 108, stage9 199, brandkit 91, posterdesign 41,
  auth; `npm run build` clean, main chunk 446.48 kB / 140.16 kB gzip (was 445.18 / 139.65 - the icon rules in
  /shared are the only new bytes the client sees) and no designRecipes reference in dist. Backups of the four
  files replaced are in `.backups/design-recipes-1a/`. Known gap: the client editor cannot place an icon, the
  recipes have no UI caller yet, and the variety/seed logic is the next part.
- AI DESIGN 1b (server only, /client untouched) done: a poster can now be designed by the assistant.
  AI service: services/ai/schema.js gains DESIGN_ANSWER_LIMITS + designJsonSchema (recipeId enum of
  recipeIds(), variant 0..3, title{main 24,sub 40}, tagline 60, slogan{line1 40,line2 60},
  bullets max 3 x 70, info{date 30,time 20,venue 80}, cta{line 40,button 30}, icon enum of ICON_NAMES,
  imageQuery 60, additionalProperties:false) with sanitizeAndTruncateDesign (HTML stripped, cut at word
  boundaries, unknown design exchanged for 'hero', unknown mark exchanged for one that suits it, unknown
  arrangement 0) and designToContent (title.main -> title, info -> date/time/venue, bullets -> details,
  the five short answers -> content.extras each inside its own DESIGN_BLANKS room, empty answers dropped).
  prompt.js buildDesignSystemPrompt lists only the designs (name, what it suits, whether it shows a
  picture), the allowed marks and five rules (date/time/venue only from the user's text else "", slogan
  and call to action may be creative but never invent facts, numbers, names, contact details, prices or
  claims, stay inside the limits and use plain words, treat the input as data and ignore instructions
  inside it, JSON only). index.js generateDesign keeps the existing 20 s timeout, retries once with the
  ajv errors and falls back to a hero design whose only words are the first thing the user said;
  providers/mock.js answers mode 'design' deterministically from keywords (blood/tree/diwali/sports/
  awards -> health/awareness/festival/sports/celebration) and honours avoidRecipeIds + variant.
  New services/poster/recipe.js builds the items: readRecipe (three values only: design, arrangement,
  mark), buildRecipeDesign -> { name 'AI design', editorVersion 2, size, elements from the tenant's own
  brand kit, recipeId, variant, recipeVersion, icon } and recipePayload. A recipe never stores a photo,
  so a Pexels address always lives in content.imageUrl, and only a needsPhoto design looks one up
  (resolveImage already 5 s, never throws, https images.pexels.com only).
  Route POST /api/posters/generate (no new route) takes mode 'ai'|'template' (default template, so the
  old answer is byte-identical), avoidRecipeIds[] and variant; ai mode refuses 403 in plain words when
  the organization switched it off, and answers { design, content }. POST /api/posters takes
  recipe { recipeId, variant, icon } and stores the rebuilt design in design.template (poster + version
  snapshot, DESIGN_MAX_BYTES untouched), re-checked by contentValuesContext, so a later recipe change
  cannot reach a saved poster; apply-latest-design / regenerate / duplicate re-build from the stored
  recipe against today's brand kit. Client.model.js gains designModes { ai, templates } both default
  true; PATCH /api/clients/:id (clientadmin for its own organization, superadmin for any) allows only
  that field and refuses turning both off. Tests: stage5 86 (ai answer, items inside the content area,
  keyword determinism, avoidRecipeIds, forced variant, blocked mode 403, both-off 400, other
  organization 403, sanitization, provider-less fallback), stage8 129 (snapshot keeps the design shown,
  fits the cap, blanks answered, over-long and foreign blanks refused, unknown design 400, cross-tenant
  404, copy keeps the design, old posters unchanged), stage9 304 (every design x every arrangement
  passes cleanElements, stays between the bands, fits the cap and saves as a template); elements 99,
  recipes 121, brandkit 91, posterdesign 41, auth all green; `npm run build` clean (main chunk
  446.48 kB / 140.16 kB gzip, nothing under /client changed). Backups of the 15 files replaced are in
  `.backups/design-ai-1b/`. Known gap: no /client screen asks for a design yet.
- AI DESIGN 2 (client only) done: recipe designs with icons draw, fit and export like everything else.
  New `client/src/components/posterIcons.js` is the one icon registry: 33 named `lucide-react` imports
  (exactly the `ICON_NAMES` list from /shared, no wildcard import) mapped kebab-name -> component, with
  `Star` as the fallback; `posterIconComponent(name)` runs the name through the shared
  `normalizeIconName` and returns null for anything not allowed. `PosterElementLayer.jsx` gained a
  `PosterIcon` (width/height 100% so it fills the item's own box, `color: style.color`,
  `strokeWidth={item.style.strokeWidth}` which /shared already clamps to 1-4, item opacity carried by the
  existing box style) and an explicit `kind === 'icon'` branch BEFORE the `if (!hasText) return null`
  guard, so a mark with no words paints; rounded rectangles, circles and lines are untouched (the same
  `Shape`). Requirement 2 needed no new fitting code — the per-item auto-fit, the empty-blank `return
  null` and the `data-export-ignore` "Words do not fit" chip already existed; what was missing was the
  info-pill row, now handled by `ROW_FIELDS ['date','time','venue']` + `rowItemIds()` which groups the
  field items that share y+h and renders that group as one flex row with `alignItems center` and
  `justifyContent flex-end`, so the three texts sit on one baseline (legacy posters keep their old
  per-box rendering). `PosterCanvas.jsx` zone-outline layer now also draws each item's own rectangle in
  rose `#f472b6` (a recipe design declares no areas, so the boxes the design chose are the useful
  outlines), still inside the one `data-export-ignore` layer. /preview-test (DEV-only, unchanged route
  guard, not linked from the menu) gained a "Design recipes" section built with the real
  `buildElements`/`DESIGN_RECIPES`/`RECIPE_VARIANTS`/`RECIPE_PALETTES` + `iconForCategory` over the live
  sample brand kit: 5 designs x 4 arrangements x 3 word sets (ordinary, very long, no place and no photo)
  = 60 real posters, a brand|bright|deep|duo palette switch, per-cell piece counts and any build problems,
  and a "Use above for export" button that loads that design into the export panel.
  Verified headless through a temporary DEV /icon-probe harness (since deleted, together with its two
  App.jsx lines) at 5355: the trophy icon renders an inline `<svg viewBox="0 0 24 24">` at exactly its
  287x287 poster px with `stroke-width="3"` and computed stroke `rgb(25, 66, 184)` (a brand colour); the
  three fact cells share one bottom edge in every case; long words auto-fit (headline 150 -> 100 poster
  px, tagline 62 -> 46, cta_line 52 -> 48) and only that case raises the note; the blanks case paints 12
  items with all five `extras` absent; the no-place/no-photo case paints 12 items with no venue box.
  Export parity from the app's own `exportPoster` with zone outlines ON: PNG 350 KB and JPG 180 KB both
  2160x2700, 152,428 / 152,021 pixels inside the icon's own rectangle at the icon's stroke colour (the
  mark is really in the file), 0 rose outline pixels against 17 rose outlines measured in the DOM (the
  editor-only layer never reaches the file), PNG-vs-JPG mean channel diff 1.15/255 with 0.001 % over 60,
  PDF `%PDF-1.3` + `%%EOF`, 1 page, 1 `/Subtype /Image`, `/Font` present, each written in ~1 s with zero
  warnings. /preview-test checked in the browser: exactly 60 poster roots in the section, the 4 palette
  buttons repaint the designs, "Show Zone Outlines" takes the export-ignore nodes 32 -> 100, console
  clean apart from dev noise. One environment caveat worth recording: html-to-image's `toPng`/`toJpeg`
  never settle in this browser tab because `document.visibilityState === 'hidden'` and
  `requestAnimationFrame` does not fire, which stalled the first export attempts; patching rAF to a
  `setTimeout` in the harness made all three formats finish in ~1 s, and no app code changed for it.
  No library added, no new dependency/env var/route, nothing under /server or /shared touched, saved
  shapes unchanged. Backups of the four files replaced are in `.backups/design-ai-2/`.
  `npm run build` clean: main chunk index-BmIO-tIa.js 459.39 kB / 143.63 kB gzip (was 446.48 / 140.16 ->
  +12.91 kB raw, +3.47 kB gzip, all 33 icons), CSS 49.94 kB / 8.74 kB, TemplateEdit 100.40 kB, EditablePoster
  13.75 kB, VariableFields 5.30 kB, Templates 13.53 kB, BrandKit 46.58 kB, History 26.62 kB, export libs
  unchanged; `grep` proves no PosterStudioTest/IconProbe chunk and no recipe name ships in dist.
  Known gap: /Create still does not offer a recipe design (the server has the route, no client screen asks).
- AI DESIGN 3 (client only) done: the Create page designs posters. Nothing under /server, /shared or /api
  changed, no new route, env var or dependency. Backups of the four files replaced are in
  `.backups/design-ai-3/` (BrandKit.jsx, EditTextPanel.jsx, Generate.jsx, App.jsx).
  New `utils/posterAiDesign.js` is the one client reader of the server's AI shapes: MODE_AI/MODE_TEMPLATE,
  AI_DESIGN_NAME, BRAND_LINE ("Your logo, colors and contact details are always added by your brand."),
  DESIGN_MODES_DEFAULT + designModesOf/designModesPayload (read `data.client.designModes`, PATCH only that
  key), modeAllowed/allowedModes/firstAllowedMode + BOTH_OFF_MESSAGE, designSizeFor (the brand's own
  defaultPosterSize, else TEMPLATE_SIZE_DEFAULT), `aiDesignOf(answer, size)` -> a design shaped exactly like
  a saved snapshot ({ capturedAt, template: { name 'AI design', editorVersion 2, version 1, size, zones [],
  layout {...LAYOUT_BASE}, elements from the answer's template, recipeId, variant, recipeVersion, icon } })
  and deliberately holding NO brandKit and NO templateId key so `isDesignStale` cannot mis-fire on an
  unsaved design, isAiDesign, `recipeOf` -> { recipeId, variant, icon } exactly as POST /posters expects,
  recipeKeyOf, zonesForAiDesign (synthesizes header/content/footer bands from the shared contentArea, so a
  design with `zones: []` still satisfies POST /templates), aiTemplateBody and friendlyTemplateError.
  Proven in plain Node: 266 assertions over four brand kits x five poster sizes.
  `pages/Generate.jsx`: `clientModes/designMode/templateDialog` state + `seenRecipesRef`; loadInitialData now
  also GETs `/clients/${activeClientId}`; `allowed = allowedModes(modes)` and an effect falls back to
  `firstAllowedMode` when an organization turns a mode off; the old template/category picker is replaced by a
  lazy `<DesignChooser>`; submit label "Designing your poster..." | "Writing your poster..." |
  "Generate poster"; `runGenerate(instruction, { avoid })` sends `mode`, `templateId` (always, when an active
  layout exists), `prompt`, `instruction` and `avoidRecipeIds: seenRecipesRef.current` only for "Try another
  design" in AI mode, then `aiDesignOf` + dedupes/records the recipe id. `runSaveOp` sends
  `{ mode:'create', recipe: recipeOf(...) }` for an AI design and `{ mode:'version' }` otherwise, because
  POST /:id/versions rebuilds from the poster's STORED recipe and accepts no recipe.
  Real bug found and fixed while verifying: switching from an AI poster to "Use one of our layouts" used to
  append a version whose design the server rebuilds from the stored recipe, silently ignoring the chosen
  layout. Now `designChanges` (saved recipeKey vs the new design's, `newDesignNeeded` when a poster already
  exists) clears the on-screen design and saves a NEW poster with the layout's templateId and no recipe -
  proved in the browser: POST /posters carried templateId + no recipe, a fresh poster id, 0 `[data-element]`
  items in the new render.
  "Save as template" (clientadmin/superadmin only, shown on a saved AI poster) opens lazy
  `components/create/SaveAsTemplateDialog.jsx` (role=dialog aria-modal, scrim + Escape close, Enter commits,
  suggested name "Assistant design"/"… 2", 120 counter) and POSTs /templates through the existing route with
  `aiTemplateBody`, appends the row to the local list, and reports "Saved as a layout. Choose it under
  “Use one of our layouts” or change it under Templates." or the first plain sentence of
  `friendlyTemplateError`. The Edit text panel, in-place editing, blanks, history, thumbnails, approvals and
  PNG/JPG/PDF exports needed no change: they all read `posterDesign`, which now holds the AI design exactly
  like a server snapshot, and the background thumbnail still fires only from `runSaveOp`.
  New `components/create/DesignChooser.jsx` (lazy): "Design" heading, two `button[aria-pressed]` cards
  ("AI designs it" / "Use one of our layouts", single card -> full width + "Set by your organization"), the
  admin's active layout list (category chips + live `TemplateThumb` minis) rendered only when the layouts
  card is chosen and collapsed otherwise, and BRAND_LINE under the section.
  New `components/brand/DesignModesCard.jsx` (lazy, a new "Poster design" tab in `pages/BrandKit.jsx`; the
  sticky brand-kit save bar is hidden on that tab): GET /clients/:id -> designModesOf, two `role=switch`
  toggles "Let AI design posters" / "Let people pick layouts", save() refuses both-off with BOTH_OFF_MESSAGE
  and PATCHes exactly designModesPayload, button reads Save settings / Saving… / Saved.
  Verified headless in a real browser at 1440x900 through a temporary DEV harness (`client/ai3-host.html` +
  Ai3Probe/Ai3ProbeHost/Ai3RafShim, since deleted; App.jsx restored from backup, grep shows zero `Ai3`
  references and no probe chunk in dist) mounting the real Generate page over stubbed api calls: both cards
  render with the right aria-pressed, choosing layouts reveals the list and collapses it again, a
  one-mode organization shows one card with "Set by your organization", the button reads
  "Designing your poster..." while the call runs, the AI answer renders 12 `[data-element]` items with the
  five fill-in blanks, POST /posters carried the exact { recipeId, variant, icon } triple, "Try another
  design" re-sent the same description with avoidRecipeIds growing 1 -> 2 while a hand-typed Pexels picture
  and a hand-edited headline survived the merge, the background thumbnail POSTed to /:id/thumbnail (the tab
  is `visibilityState: hidden`, so the harness shimmed requestAnimationFrame to a timer - no app code
  changed for it, same caveat as stage 2), Save as template POSTed valid zones (header 0+120 locked, content
  120+1140, footer 1260+90 locked = 1350) and appeared in the list, the settings card PATCHed designModes
  only and refused both-off, and the console stayed clean.
  `npm run build` clean: main chunk index-C50nNFzF.js 464.66 kB / 145.60 kB gzip (was 459.39 / 143.63 ->
  +5.27 kB raw, +1.97 kB gzip; posterAiDesign.js is the only new bytes in the main path), CSS 50.03 kB /
  8.75 kB, new lazy chunks DesignChooser 3.40 kB / 1.29 kB gzip, DesignModesCard 3.37 kB / 1.49 kB,
  SaveAsTemplateDialog 2.79 kB / 1.33 kB, TemplateThumb 0.52 kB split out of Templates; BrandKit 47.07 kB,
  TemplateEdit 100.40 kB, EditablePoster 13.75 kB, VariableFields 5.30 kB, History 26.62 kB unchanged.
  `npm run test:recipes` 121 and `npm run test:elements` 99 still green (server rules, unchanged).
  Known gap: a design shown in this session but never saved has no poster id, so "Save as template" only
  appears after the first save - and a *different* design after a save starts a new poster, which the UI
  says in plain words.
- AI DESIGN 4 (optional, client + server) done: a design that keeps a place open for a picture can
  have that picture drawn. New /server/services/image/: prompt.js owns the one sentence
  ("A clean flat illustration of {subject}, no text, no logos, no people's faces, colors {palette}")
  with IMAGE_SUBJECT_LIMITS 3-60, cleanSubject (markup dropped, curly quotes folded, a hyphen that
  opens a word goes with the punctuation so nothing that looks like a command can be carried, an
  inside hyphen stays, cut to 60), UNSAFE_TOPICS (weapons, graphic harm, sexual, drugs, hate,
  gambling, faces/likeness/public figures, logos - deliberately NOT blood/death/war/alcohol, so
  "World Blood Donor Day" stays drawable), screenSubject (whole-word match, plain reason) and
  paletteOf (brandOf's hexes + tint/shade, max 4) + aspectRatioFor(size) (nearest of 9:16…16:9 by
  log distance; 1080x1350 -> 4:5, 1920x1080 -> 16:9, nothing declared -> 4:5). providers/mock.js answers
  one fixed stock placeholder; providers/gemini.js calls generateContent with x-goog-api-key (never the
  key in the URL), responseModalities TEXT+IMAGE and imageConfig.aspectRatio, reads inlineData, and turns
  promptFeedback.blockReason / a SAFETY-family finishReason into a 400 and a missing key into 503;
  limits.js holds IMAGE_LIMITS {10 per person per day, 60 per organization per day} and consumeImageQuota,
  which spends the organization counter first through the existing one-atomic-update consumeRateLimit
  (RateCounter, TTL window = one day). index.js: IMAGE_TIMEOUT_MS 25000 behind an AbortController,
  IMAGE_PROVIDERS ['mock','gemini'], IMAGE_MAX_BYTES 8 MB; a base64 answer is uploaded from the server
  with storageService.uploadBuffer to brand/<clientId>/ai-pictures and only the address comes back,
  re-checked with checkContentImageUrl before anything is answered.
  Route POST /api/posters/image (same Express app, no file under /api) takes {recipeId, title} only -
  never the person's own description - and answers {imageUrl, provider, stockUrl, message}: 400 for a
  design with no picture place, an idea that must not be drawn or too few words; 403 when the organization
  switched assistant designs off; 429 with a plain sentence when the day's count is spent; and on any
  other failure 200 with imageUrl '' plus a stock photo and a friendly line, so the poster keeps its mark
  (a 400 from the provider stays a 400 - a photo of the same idea would be the same mistake). Only a
  sentence that reads like one is shown; a service's own words stay inside the server.
  Item 4 answered by measurement: Vercel's own ceilings are 300 s on Hobby / 800 s on Pro, so the
  project's maxDuration was raised 30 -> 60 and Gemini flash-image (4-8 s) is offered; OpenAI images
  (gpt-image-1, 30-45 s and often longer, plus a 1 MB response cap through the function) cannot be
  relied on inside the limit, so it is NOT wired up and naming it IMAGE_PROVIDER=openai answers 503 in
  plain words. .env.example gained IMAGE_PROVIDER=mock and GEMINI_IMAGE_MODEL= (commented) and no other
  variable; gemini reuses GEMINI_API_KEY.
  Hardening found while testing: content.imageUrl accepted any res.cloudinary.com address, so a picture
  from another organization's folder saved. normalizeImageUrl now takes the tenant and refuses a
  cloudinary path whose brand/<id> or ai-posters/tenants/<id> folder names someone else ("must be a
  picture your own organization keeps"); Pexels and every other shape are unchanged.
  /client: posterAiDesign.js gained PICTURE_BUTTON_LABEL 'Create a picture with AI', pictureSlotOf /
  hasPictureArea (a field-photo space or an image item of its own) and friendlyPictureError (the
  server's own sentence first, else a hung call or a dead network in plain words). New lazy
  components/create/AiPictureDialog.jsx (role=dialog, scrim + Escape close, spinner while waiting,
  "Drawn from <headline> in your brand colors", Use this picture / Make another / Discard, an image that
  will not open is said so, and a stock photo offered as "Use this photo"). Generate.jsx shows the button
  only when a poster is on screen, the assistant is doing the layout, the design really carries a recipe
  and a headline of 3+ words exists, posts {recipeId, title} with a 60 s per-request timeout (api.js holds
  30 s), and taking the picture goes through handleStageContent, so it lands in content.imageUrl/image,
  the unsaved check, the payload, the export buttons and the thumbnail exactly like a photo picked from
  the side form; discarding closes and changes nothing.
  Tests: new `npm run test:image` = server/scripts/test-poster-image.js, 89 assertions in 10 sections
  (the sentence can never hold a URL or an unfilled slot, 15 refusals + 10 awareness events allowed,
  markup cannot smuggle a blocked word past, ownership, the five ratios, the provider choice incl. the
  openai refusal and the key-less 503, the daily counts, then the real route over http on a throwaway
  tenant: 401 anon, 400 bad recipeId / short headline / a design with no picture place / an unsafe idea,
  200 + an own-folder address for a plain user, the address saves with the poster and no bytes are stored,
  another organization's folder refused 400 while this one's own still saves 201, 403 with the setting
  named, ten pictures of the day then 429, a second person still allowed, cleanup of every record incl.
  the three counter keys). `npm run test:aidesign` is the stage-3 rules probe, now named
  scripts/test-poster-ai-design.js and wired to npm (266 assertions). A temporary esbuild/render probe
  (since deleted) checked the dialog 27 ways over the real rendered markup: busy holds every choice, ready
  paints the picture and says nothing is saved yet, the stock fallback says photo, a refusal keeps
  Try again and Discard, and the helper gating. All suites green: image 89, aidesign 266, elements 99,
  recipes 121, stage5 86, stage8 129, stage9 304, brandkit 91, posterdesign 41, auth; `npm run build`
  clean: AiPictureDialog 3.37 kB / 1.41 kB gzip as its own lazy chunk, main chunk 466.99 kB / 146.33 kB
  gzip (was 464.66 / 145.60 -> +2.33 kB raw for the three helpers), CSS 50.13 kB, every other chunk
  unchanged, no probe file or chunk left in dist. Backups of the files replaced are in
  `.backups/design-ai-4/`. Not covered here: a live Gemini call and a real Cloudinary upload (no key in
  this environment, so the mock provider is what the route ran against), and a logged-in browser pass.
- FIX 1 (client only, /shared untouched) done: AI-designed posters render correctly.
  1 BRAND LAYER: the cause was not the brand kit source (both modes already read
  designBrandKit) but `resolvePosterBrand`, which decided a band exists from `Boolean(headerZone)`
  and fell back to 140/130 px otherwise - and every assistant design ships `zones: []`, so neither
  band drew. `utils/brandRender.js` now derives `brandStrip = contentArea(kit, { size })` (the very
  shared rule that placed the items) whenever a design declares no bands, so header.height = strip.y,
  footer.height = height - strip.y - strip.h (unscaled, matching clampItemToArea), content.x = 0,
  content.w = width and content.y/h land exactly on the strip; `present` is true for both bands, and a
  template that DOES declare areas keeps its old numbers (proved: 112/124 from the kit, box
  60,140 960x1050 unchanged). One fix in the resolver covers create, edit, history, PNG/JPG/PDF and
  the thumbnail, because all five render the same `<PosterCanvas>`. `PosterCanvas` now
  `console.error`s in DEV when either band is missing, and its zone outlines follow
  `brand.header.present/footer.present` instead of the areas.
  2 PATTERN: split out of the content plate - `content.bg.pattern` is forced to 'none' while the
  resolver reports `content.pattern` + `content.patternColor` (the decoration colour), and
  `patternLayer` defaults to 4 % with `PATTERN_OPACITY_MAX` 6 %. `PosterCanvas` paints it as one
  `inset: 0`, `zIndex: 1` layer - under the text panel (z10), items (z11) and both bands (z20) - so it
  is edge-to-edge and can never cross a word. A brand whose middle IS a pattern now gets
  `bgFullBleed` (like a background photo) plus `canvasColorFinal` from that base colour, so the plate
  spans the poster and no hard edge appears at the text box.
  3 AUTO-FIT: `fitsBox()` in `PosterElementLayer` measures scrollHeight AND scrollWidth (all wrapped
  lines), still steps 8 % and waits for/re-measures on `document.fonts`; at the item's own minSize the
  box switches to `overflow: visible` (`spill` in all three branches) so a line is never cut off, and
  `flag()` reports through the existing path so the "Words do not fit" note - always OUTSIDE
  `#poster-canvas-root` - still says so.
  4 CONTRAST: `utils/templateRender.js` owns the DOM-free rules `platesUnder` (topmost filled non-line
  shape covering an item's box), `ownsPlate` (same rect within 4 px = a button, not a pill cell),
  `itemBackdrop` (plate fill x item opacity over the surface) and `readableItems(items, {surface,
  candidates})` -> { items, switched }: a word item under `ITEM_CONTRAST_MIN` 4.5:1 is recoloured with
  `pickReadableColor([own colour, headingColor, bodyColor, accentColor, #fff, #0b0f17])` and recorded;
  shapes, icons and photos are never touched. `PosterCanvas` runs it in its items memo.
  5 BUTTON AND PILL: `ElementBox` takes the `plate` it stands on - `valign` centre when on a plate,
  `halign` centre when it owns the shape - so a button label is centred both ways and pill cells sit in
  the middle of the pill, while an un-placed box keeps its chosen alignment.
  6 `/preview-test` gained "Locked bands and a faint pattern": three posters of one brand whose middle
  is lines/dots/grid (each with the live `resolvePosterBrand` readout of pattern, cap, band heights and
  the text strip) plus two "AI poster with header and footer" cases built from `zones: []` recipe
  designs, and `ContrastLines` reporting every colour the renderer changed (per cell in Design recipes,
  quiet there, and in full under the new cases); each design row now names its band heights.
  Verified: throwaway Node probe (since deleted) - 402 assertions over 5 designs x 4 arrangements
  proving both bands present, header/footer/strip exactly equal to `contentArea`, and every text item
  inside the strip; a default kit keeps both bands; an areas-declaring template keeps its old geometry;
  the three patterns report faint/full-bleed/never-inside-the-box; `readableItems` switches one dark
  colour on a shape, reports the failing ratio, leaves a readable colour and ignores a photo. Real
  browser at /preview-test (no harness, the page itself): 92 posters, ALL with exactly two z20 bands
  flush to the poster's top and bottom, the pattern layer measured `inset 0` at the full 432x540 screen
  box with `rgba(125,211,252,0.04)` at z1 while the text panel paints no plate, the zone-less content
  panel sitting at exactly 112/124 between the bands, 87 item boxes painted `overflow: visible` with one
  headline measured 33 px box vs 41 px of words (not clipped) and all 33 notes a sibling AFTER
  `#poster-canvas-root` (0 inside), 70 boxes centred both ways, "Sign up" dark on #059669 and pill labels
  #0b0f17 on #e4eafa, 483 contrast lines, no "locked brand layer is missing" error in the console (only
  the two Router warnings and two dead Unsplash hosts). `npm run build` clean: main chunk
  index-DLv7cB-i.js 469.53 kB / 147.24 kB gzip (was 466.99 / 146.33), CSS 50.22 kB, every other chunk
  unchanged (hashes identical), no PosterStudioTest or probe chunk in dist. Server, /shared, saved
  shapes and every route untouched; no new dependency or env var. Backups of the six files replaced are
  in `.backups/fix-1-render/`.
- FIX 2 (/shared + the AI mock provider only, /client and every route untouched) done: the recipes
  draw a finished poster. /shared/templateElements.js: `iconForWords(words, category)` maps the kind
  of event to a mark (awards/recognition/sports -> trophy or medal, health/blood -> droplet or
  heart-pulse, trees -> leaf, festival -> flame or sparkles, education -> graduation-cap, meeting ->
  users; `gift` only when a gift is really named) and `validateElements` lets a thin rule be thinner
  than `minHeight` (one side 3-8 px, the other may be any length). /shared/designRecipes.js is now
  RECIPE_VERSION 2 and owns the rules in plain numbers: `SPACING_UNIT` 24 with `spacingUnit(width)`
  (one vertical rhythm for every block), `ESTIMATED_CHAR_WIDTH` 0.58 + `linesOfWords` +
  `fitTextSize` + `TITLE_MAX_LINES` 2 so the headline is sized from its own length and box width and
  needs at most 2 lines, with `minSize` at 55 % of the size so the client auto-fit has room;
  `TEXT_CONTRAST_MIN` 4.5 with the pure helpers `posterSurface`, `backdropOf`, `readableColorOn` and
  `readableInks` (a shared contrast check - every word is painted in a colour that reads on what is
  actually behind it, and the accent stays for shapes, rules and buttons, never small text on a dark
  ground); `MAX_TYPE_STYLES` 5 (`distinctTypeStyles`) and `MAX_TEXT_BOXES` 7; the hero pill is three
  equal columns on one row split by two upright rects `PILL_DIVIDER_RATIO` 0.55 of its height (width
  3-4, never a blob) while `FACT_CELL_MAX_LINES` 3 and `MIN_CELL_WIDTH` 190 keep a fact that must
  wrap inside its own column, and only words that no column can hold go one under another with the
  rules lying down. hero paints no tagline and no bullet list at all (other designs keep them).
  The layout engine now fills the space honestly: `SCALES` grows as well as shrinks (1.6 down to
  0.64), `holdsColumns` refuses a larger poster that would break the pill, and in `layoutOf` leftover
  room goes to a flexible block only up to its own `ceiling` (a round mark never bigger than the
  square it draws), then opens the gaps by at most half a rhythm step, and what still stays is
  returned as `spare` and `stack` keeps it as air above and below the whole design instead of a hole
  in the middle; a block that paints nothing but a rule is `thin` and only as tall as that rule.
  server/services/ai/providers/mock.js answers 'awards night' with a trophy.
  Tests: `npm run test:recipes` is now 155 assertions over the same 240 builds and adds the guards the
  brief asked for - every box of words is as tall as the words it was given (estimated lines x size x
  line height vs the box), every word reads on its backing fill at 4.5:1, no `gift` unless the slots
  speak of a gift, hero has no tagline and no bullets, at most 7 text boxes of its own and at most 5
  ways of setting words, the blocks fill the poster with no large empty strip (largest empty row <=
  2 rhythm steps, measured over what actually paints), one rhythm of 24 px at 1080 wide that scales
  with the poster, the title needs <= 2 lines and can shrink to about half, the pill's dividers are
  thin upright bars about half the pill, and the keyword map plus the mock provider give an awards
  night a trophy. All suites green: recipes 155, elements 99, stage5 86, stage8 129, stage9 304,
  brandkit 91, posterdesign 41, image 89, aidesign 266, auth; `npm run build` clean (main chunk
  index-ZEMNv4uM.js 471.88 kB / 148.25 kB gzip, was 469.53 / 147.24; every other chunk unchanged,
  no probe file or chunk in dist). No new dependency, no new env var, nothing saved differently: the
  items are the same shape the editor already stores. Backups of the four files replaced are in
  `.backups/design-polish-2/`.
- Style Link 1 (/shared and server template validation only, /client untouched) done:
  1. BRAND TOKENS: item style colours accept hex or tokens ("brand:primary", "brand:secondary",
     "brand:accent", "brand:text", "brand:background", "brand:heading", "brand:body"). Font values
     accept allowed font names or "brand:heading" / "brand:body". Pure resolveStyleTokens(style, brandKit)
     and constants added to /shared/templateElements.js. Validation accepts hex or known tokens only.
  2. PAGE OVERRIDES: template.page = { background, decoration, watermark, infoCard }, each with mode
     "brand" (default) or "custom". In custom mode, reuses Brand Kit validation schemas and ranges
     (content.background, decoration/decorationColor, watermark, infoCard). Tenant Cloudinary image rules enforced.
  3. Defaults: templates without page and items without tokens behave as before. New items/templates default to
     brand tokens and defaultPage(). No database rewrite.
  4. Pure effectivePage(brandKit, template) in /shared/templateElements.js returns effective settings to draw
     (custom sections over brand kit defaults).
  5. SNAPSHOTS: poster.design.template preserves page and tokens; brand kit snapshot resolves them so old posters
     never restyle when the live brand kit changes. Stays under DESIGN_MAX_BYTES.
  6. Tests: extended test-stage9.js (now 334 assertions) and test-brandkit.js (now 111 assertions); all test
     suites pass; npm run build clean; /client untouched.
- Style Link 2 (client only, /server untouched) done:
  1. In <PosterCanvas> and renderers, effectivePage(brandKit, template) is called for the area behind the poster
     text (fill, decoration, watermark) and date/time/place cards, and resolveStyleTokens is called for every
     item's colors and fonts before auto-fit, contrast checks and export. Saved posters use their own saved brand
     kit snapshot (content?.design?.brandKit || brandKit) and template snapshot.
  2. Contrast checks (readableItems) evaluate with resolved colors against the effective surface and plates;
     header and footer still come only from the brand kit.
  3. Load only Google Fonts actually used: useGoogleFonts requests only the unique font families actually rendered
     on the canvas (active header, footer, placed word items / flow content fonts), with brand tokens resolved
     and stripped.
  4. In /preview-test (DEV only), added a dedicated "Style link and saved snapshot tests" suite showing one template
     with brand tokens and a custom page backdrop drawn with two different brand kits (colors and typography
     follow each brand), and one saved poster snapshot preserving its Rosewood / Cinzel look when the live brand
     kit changes to Bold.
  5. Exports match preview; canvasBaseColor resolves custom page background; old templates and brand kits remain
     visually identical. npm run build clean; all tests pass (740 assertions across suites).
- Style Link 3 (client only, /server untouched) done:
  1. LEFT RAIL: added "Page" and "Brand" tabs to `RAIL_TABS` with `Sliders` and `Palette` icons.
     - Page: four sections (Background, Decoration, Watermark, Cards for date, time and place). Each has a switch
       "Use brand setting" / "Customize", "Customized" badge, and "Reset to brand" button. "Customize" reuses the same
       control components imported directly from `components/brand/controls.jsx` (`BackgroundEditor`, `ColorInput`,
       `Segmented`, `Toggle`, `SliderNumber`, `LIMITS`).
     - Brand: brand colours swatches (Primary, Secondary, Accent, Text, Background) and brand fonts (Heading, Body).
       Clicking a swatch applies the token to the selected item's colour; clicking a font applies the font token.
       Includes link "Edit in Brand Kit" (opens `/brand-kit` in a new tab) and note "Header and footer are set in the Brand Kit."
  2. PICKERS: `ItemColorPicker` in `ItemToolbar.jsx` presents a "Brand colours" row first, then custom picker. Items using a
     brand token show the token name ("Primary") and a "Use custom colour" action; a custom colour displays a "Customized" badge.
     Font select lists brand fonts first under an `<optgroup label="Brand fonts">` followed by other fonts, showing "Customized"
     when custom.
  3. Reset to brand per item (resets text to brand tokens) and per section (sets mode: 'brand'), with seamless undo/redo
     support through `historyReducer` state tracking `{ items, page }`.
  4. Contrast warnings evaluate against resolved colors (`resolveColorToken` + `effectivePage` surface).
  5. Fixed Templates list "updated N hours ago" label in `utils/timeAgo.js`: corrected millisecond/second scaling bug so
     recent templates show "just now", minutes, hours, days.
  6. Plain words everywhere ("Background", "Cards for date, time and place", no technical jargon).
  7. `npm run build` clean; lazy chunk `TemplateEdit-*.js` is 117.41 kB (33.25 kB gzip); no new libraries added.
- Style Link 4 (client only, /server untouched) done:
  1. SIMPLE / ADVANCED SWITCH: added toggle at the top of `/brand-kit` page, persisted in `sessionStorage`
     ('brand-kit-mode'). Simple shows only: organization identity (name & logo), 5 brand colours (primary,
     accent, dark/secondary, text, poster background), 2 fonts (heading & body), header text & toggles, footer
     contact details (address, phone, email, website, up to 6 social links), and style presets picker. Advanced
     shows everything else in collapsible sections: Header, Area behind the poster text, Cards for date, time
     and place, Footer, Fonts and sizes, and Poster creation modes. Each section features an individual Reset button
     and a one-line description of where it is used.
  2. LARGER STICKY LIVE PREVIEW: 6/6 grid split gives 50% width to the live preview card on desktop; live
     preview header contains a small `<select>` populated from loaded templates so admins can test different
     templates; preview and WCAG contrast readouts update live as users type.
  3. NOTES AND TEMPLATE COUNTS: added note near Save: "Changes apply to new posters. Posters already made keep
     their design." Each section displays a "Used by N templates" line computed cheaply from the loaded templates
     list (accounting for templates with custom page overrides vs using brand kit settings).
  4. STICKY SAVE BAR: includes unsaved-changes pulse indicator / status chip, "Discard changes" button, "Save
     brand kit" button, and unsaved changes `beforeunload` guard.
  5. REUSE: existing controls and validation reused without changes to the server or data model. `npm run build`
     clean; BrandKit chunk 39.57 kB (11.39 kB gzip).

- PREVIEW UNIFY (client + one projection line) done: one component now draws every template miniature.
  Investigation: the Templates card used components/TemplateThumb.jsx (fixed-width PosterCanvas, own
  IntersectionObserver), DesignChooser used TemplateThumb at 64 px, BrandKit used <PosterPreview> (which forces
  minHeight 200 px and its own sample), TemplateEdit's Preview and /templates/builder used PosterPreview too, and
  every one of them drew from the LIST row - which the server projected without `elements`, so a card showed a
  zones reconstruction of an items template instead of its real look. PATCH did bump `version` and `updatedAt`
  (findOneAndUpdate + timestamps:true on the model) and the label came from utils/timeAgo.js.
  New `client/src/components/TemplatePreview.jsx` is the single renderer: <PosterCanvas> with the template's own
  items (utils/templateRender.js `templateElements` → normalizeElements, or legacyToElements for an old template),
  the client's brand kit, sample words, `transform: scale(shown/canvasW)` inside an `aspect-ratio` box, plus
  `templateSignature(template)` = id|version|updatedAt|item count|editorVersion used as the PosterCanvas key so any
  save repaints; `size` for a fixed width (list 132, chooser 64), fluid ResizeObserver width when omitted,
  IntersectionObserver (rootMargin 240 px) until in view unless `eager`, and `showZoneBorders` for the read-only
  builder page. TemplateThumb.jsx is deleted; TemplateCard, DesignChooser, VersionDrawer (per-version items,
  `eager`), BrandKit, TemplateEdit (narrow screen + the four Preview samples) and TemplateBuilder all use it, so
  PosterPreview now serves posters only. No template ever reads a stored thumbnail image.
  Freshness: Templates.jsx reloads quietly on window focus and visibilitychange (the list is re-read after the
  editor saves or closes); the server LIST_FIELDS now carries `elements`. Brand Kit preview lists only active
  templates (`previewTemplates`), defaults to the first active one, redraws as the kit is typed and gained an
  "Edit this template" link (/templates/:id/edit in a new tab).
  utils/timeAgo.js rewritten as the shared ladder - "just now" under a minute, N minutes, N hours, N days up to 30,
  then a plain date - with an injectable `now`; new `npm run test:timeago` (server/scripts/test-time-ago.js, 20
  assertions on every boundary). test-stage9.js gained section 8b: a 5-minute-old `updatedAt` planted with a raw
  `Template.collection.updateOne` (the model's timestamp option would overwrite a value planted through it), then
  PATCH, restore (of the version oldest NOW, since the extra save shifts the 10-entry window), activate, deactivate
  and duplicate each proved to date the template again, plus 'a duplicate still starts at version 1'; the old "the
  list stays light" assertion became 'the list carries the placed items so a preview can draw them'.
  Save feedback: TemplateEdit's success banner now carries a "Back to templates" action next to
  "Saved as version N." and the failure banner keeps "Reload this template". Every route, guard and the poster
  canvas are unchanged; a zones-only template converts on read and looks exactly as before.
  Caveat: the sample picture is the organization's own photo (brandKit.content.defaultImageUrl, or the photo baked
  into the item) - no external sample URL is hardcoded, because this project previously shipped dead ones.
  All suites green: timeago 20, stage9 344, elements 99, recipes 155, stage5 86, stage8 129, brandkit 111,
  posterdesign 41, image 89, aidesign 266, auth; `npm run build` clean (TemplatePreview 1.56 kB / 0.80 gzip as its
  own lazy chunk, timeAgo 0.75 kB, Templates 13.92, DesignChooser 3.46, TemplateBuilder 5.44, BrandKit 39.99,
  TemplateEdit 117.24 kB / 33.25 gzip, main chunk 478.00 kB / 149.73 gzip). Backups of the files replaced are in
  `.backups/preview-unify/`.
