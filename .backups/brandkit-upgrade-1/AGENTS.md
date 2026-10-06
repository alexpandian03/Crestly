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