# Project Scope & Inventory Cleanup Plan

> **Scope Realignment: Local Business Service vs. Global Self-Serve SaaS**  
> **Context:** The application serves **local businesses**, not anonymous public self-serve subscribers.  
> **Lifecycle:** Super Admin provisions and configures each company once (brand kit, logo, colors, locked header & footer bands, and default templates). Client Admin and User roles log in strictly to generate on-brand posters using their assigned template(s), customize details/photos, and download high-resolution assets. Companies update or generate posters infrequently (e.g. once a year or for seasonal events).

---

## 1. Role Access & Reach Matrix

### Current State vs. Target State

| Role | Current Pages Reached | Current Menu Items (`SideBar`) | Current API Routes Reached | Target State in New Local Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`superadmin`** | `/` (Home), `/login`, `/dashboard`, `/clients` (Orgs), `/users`, `/security`, `/brand-kit`, `/brand-layer/edit`, `/templates`, `/templates/:id/edit`, `/templates/builder` *(dead link)*, `/create`, `/posters`, dev routes (`/studio-test`, `/export-test`, `/catalog-dev`, `/preview-test`) | Dashboard, Organizations, Users, Create, Posters, Brand kit, Templates, Org Picker (`OrgBar`), UserMenu (`/security`, Change Password, Sign out) | Full access (`*`): `/api/clients/*`, `/api/users/*`, `/api/brand-kit/*`, `/api/templates/*`, `/api/posters/*`, `/api/assets/*`, `/api/audit/*`, `/api/uploads/*`, `/api/auth/*` | **KEEP FULL ACCESS:** Provisions local companies, sets up default brand kit & bands, creates default company templates, and manages company logins. |
| **`clientadmin`** | `/dashboard`, `/team` (`Users.jsx`), `/security`, `/brand-kit`, `/brand-layer/edit`, `/templates`, `/templates/:id/edit`, `/create`, `/posters` | Dashboard, Create, Posters, Brand kit, Templates, Team, UserMenu (`/security`, Change Password, Sign out) | `/api/brand-kit` (GET, PUT), `/api/templates` (Full CRUD), `/api/posters` (CRUD), `/api/users` (read/invite within tenant), `/api/clients/me`, `/api/auth/*`, `/api/uploads/*` | **SIMPLIFY & RESTRICT:** Does NOT edit brand kit, header/footer bands, or template layout. Primary actions: `/create` (Generate poster), `/posters` (View/Download past posters), and optionally `/team` (view coworkers). Remove `/brand-kit` and `/templates` from their menu. |
| **`user`** | `/brand-kit` *(guarded read-only)*, `/create`, `/posters`, `/security` | Create, Posters, UserMenu (`/security`, Change Password, Sign out) | `/api/posters` (CRUD own), `/api/brand-kit` (GET), `/api/templates` (GET), `/api/clients/me`, `/api/uploads/image`, `/api/auth/*` | **KEEP STREAMLINED:** Day-to-day user who only creates posters from their assigned company template and downloads them (`/create` and `/posters`). |

---

## 2. Complete Codebase Inventory & Classification

Every item is classified as:
- **`KEEP`**: Essential for the local company workflow (Super Admin setup, Client generation & download).
- **`SIMPLIFY`**: Redundant SaaS complexity that can be trimmed down to fit infrequent, non-technical local use.
- **`DISABLE`**: Enterprise / SaaS feature preserved in code but toggled off via configuration flag.
- **`DELETE`**: Dead code, orphan test benches, abandoned prototypes, or obsolete screenshots with zero production value.

---

### A. Client Pages & Routes (`client/src/App.jsx`, `client/src/pages/`)

| File / Route | Classification | One-line Reason |
| :--- | :--- | :--- |
| `App.jsx` | **KEEP** | Core client router; needs route pruning to remove dead test pages and restrict template routes to superadmin. |
| `Home.jsx` (`/`) | **SIMPLIFY** | Marketing landing page; for direct local business users, redirect authenticated users to `/create` or simplify into clean login portal. |
| `HowItWorks.jsx` (`/how-it-works`) | **DELETE** | Public SaaS onboarding explainer; local business clients do not need public marketing walkthroughs. |
| `Login.jsx` (`/login`) | **KEEP** | Primary authentication entry point for all roles. |
| `ForgotPassword.jsx` (`/forgot-password`) | **KEEP** | Standard self-service password recovery for company admins and staff. |
| `ResetPassword.jsx` (`/reset-password`) | **KEEP** | Completes password reset link flow. |
| `AcceptInvite.jsx` (`/invite`) | **KEEP** | Allows new company staff invited by Super Admin or Client Admin to set their password. |
| `VerifyEmail.jsx` (`/verify-email`) | **DISABLE** | Email verification step; local company users created by Super Admin can be pre-verified by default. |
| `AccessDenied.jsx` (`/access-denied`) | **KEEP** | Clean 403 fallback screen when unauthorized roles try to access administrative tools. |
| `Dashboard.jsx` (`/dashboard`) | **SIMPLIFY** | System health check and recent posters widget; can be streamlined or bypassed in favor of going straight to `/create`. |
| `Clients.jsx` (`/clients`) | **KEEP** | Super Admin's company organization manager to onboard and maintain local clients. |
| `Users.jsx` (`/users` & `/team`) | **KEEP** | Super Admin manages all accounts (`/users`); Client Admin can optionally see organization staff (`/team`). |
| `Security.jsx` (`/security`) | **DISABLE** | Complex session manager, TOTP MFA, and email change requests; excessive friction for local small businesses. |
| `BrandKit.jsx` (`/brand-kit`) | **KEEP** | Super Admin's configuration panel for client logo, brand colors, typography, and contact info (hide from Client Admin/User). |
| `TemplateEdit.jsx` (`/templates/:id/edit`, `/brand-layer/edit`) | **KEEP** | Super Admin's tool to construct locked brand bands and initial poster layout templates (hide from Client Admin/User). |
| `Templates.jsx` (`/templates`) | **KEEP** | Super Admin's template catalog manager (hide from Client Admin/User). |
| `TemplateBuilder.jsx` (`/templates/builder`) | **DELETE** | Obsolete prototype builder completely superseded by `TemplateEdit.jsx` and never linked in UI. |
| `Generate.jsx` (`/create`) | **KEEP** | The primary operational screen where local companies generate, fine-tune text/photos, and download posters. |
| `History.jsx` (`/posters`) | **KEEP** | Gallery of previously saved posters with one-click download, duplicate, and export actions. |
| `CatalogDevPage.jsx` (`/catalog-dev`) | **DELETE** | Dev-only test bench for visual scoring and palette matrices; unneeded in production. |
| `ExportTestPage.jsx` (`/export-test`) | **DELETE** | Dev-only test bench for raster/PDF export verification. |
| `PosterStudioTest.jsx` (`/studio-test`) | **DELETE** | Dev-only test bench for template rendering experiments. |
| `PreviewTestPage.jsx` (`/preview-test`) | **DELETE** | Dev-only test bench displaying a 60-poster archetype contact sheet. |

---

### B. Client Components (`client/src/components/`)

| Component | Classification | One-line Reason |
| :--- | :--- | :--- |
| `DeleteTemplateDialog.jsx` | **KEEP** | Confirmation modal when Super Admin removes a template in `Templates.jsx`. |
| `DraftRestoreDialog.jsx` | **KEEP** | Restores unsaved poster work in `Generate.jsx` if browser refreshes unexpectedly. |
| `EditTextPanel.jsx` | **KEEP** | Side panel in `Generate.jsx` allowing non-technical users to edit headline, dates, venue, and photos. |
| `ErrorBoundary.jsx` | **KEEP** | Protects the application UI from crashing on unhandled render errors. |
| `FaqAccordion.jsx` | **DELETE** | FAQ component exclusively rendered on the marketing `Home.jsx` page. |
| `Footer.jsx` | **SIMPLIFY** | External marketing links footer; remove public SaaS fluff and keep minimal copyright. |
| `LandingPosterCard.jsx` | **DELETE** | Interactive poster card exclusively rendered on the public `Home.jsx` marketing page. |
| `LandingPosterCard.test.jsx` | **DELETE** | Test file dedicated to `LandingPosterCard.jsx`. |
| `Logo.jsx` | **KEEP** | Renders brand mark and application name across navigation headers. |
| `Navbar.jsx` | **SIMPLIFY** | Public top navbar; simplify to a bare login header for guests. |
| `PosterCanvas.jsx` | **KEEP** | The single unified DOM/CSS poster renderer serving editor, preview miniatures, and exports. |
| `PosterCanvas.*.test.jsx` (4 files) | **KEEP** | Core unit tests verifying brand bands, content strip bounds, recipe mapping, and photo slots. |
| `PosterCard.jsx` | **KEEP** | Visual card rendering saved posters in `History.jsx` and `Dashboard.jsx`. |
| `PosterDetailDrawer.jsx` | **KEEP** | Slide-out drawer in `History.jsx` for previewing poster metadata and downloading exports. |
| `PosterElementLayer.jsx` | **KEEP** | DOM element layer drawing text, shapes, icons, and photos onto `PosterCanvas`. |
| `PosterExportButtons.jsx` | **KEEP** | PNG and PDF generation and download buttons. |
| `posterIcons.js` | **KEEP** | Lucide icon dictionary providing icons for poster elements. |
| `PosterImageInput.jsx` | **KEEP** | Upload control and photo picker for poster image slots. |
| `PosterPreview.jsx` | **KEEP** | Scaled responsive container wrapping `PosterCanvas`. |
| `ProtectedRoute.jsx` | **KEEP** | Enforces authentication and role-based access control on routes. |
| `SocialIcon.jsx` | **KEEP** | SVG icons for social media links rendered in locked footer bands. |
| `TemplateCard.jsx` | **KEEP** | Miniature card representing a template in Super Admin's `Templates.jsx`. |
| `TemplatePreview.jsx` | **KEEP** | Miniature canvas preview used across template listings and creation dialogs. |
| `TemplatePreview.test.jsx` | **KEEP** | Unit test verifying template thumbnail rendering. |
| `brand/BrandImageField.jsx` | **KEEP** | Image uploader for brand logo and band artwork. |
| `brand/controls.jsx` | **KEEP** | Color pickers, typography selects, and contact fields for Brand Kit setup. |
| `brand/DesignModesCard.jsx` | **DELETE** | Dead, orphaned component not imported anywhere in the application. |
| `brand/DesignModesCard.test.jsx` | **DELETE** | Test file dedicated to orphaned `DesignModesCard.jsx`. |
| `builder/VersionDrawer.jsx` | **KEEP** | Version history drawer used in `TemplateEdit.jsx` for rollback. |
| `create/AiPictureDialog.jsx` | **SIMPLIFY** | AI image generation dialog; local businesses usually use real event/product photos or stock photos. |
| `create/DesignChooser.jsx` | **KEEP** | Visual picker allowing users to choose alternative layouts generated by AI. |
| `create/SaveAsTemplateDialog.jsx` | **DISABLE** | Saving a finished poster as a global template; local company users should not create new templates. |
| `editor/CardEditorModal.jsx` | **KEEP** | Element property modal in Super Admin's `TemplateEdit.jsx`. |
| `editor/ContextualToolbar.jsx` | **KEEP** | Canvas floating toolbar in Super Admin's `TemplateEdit.jsx`. |
| `editor/EditorRail.jsx` | **KEEP** | Left sidebar tool dock in Super Admin's `TemplateEdit.jsx`. |
| `editor/EditorStage.jsx` | **KEEP** | Zoomable, draggable canvas workspace in Super Admin's `TemplateEdit.jsx`. |
| `editor/ItemTextEditor.jsx` | **KEEP** | In-place text formatting inspector in Super Admin's `TemplateEdit.jsx`. |
| `editor/SectionSettingsPanel.jsx` | **KEEP** | Section height and band property drawer in Super Admin's `TemplateEdit.jsx`. |
| `posteredit/CardListEntriesEditor.jsx` | **KEEP** | Editor for structured bullet points or speakers in `Generate.jsx`. |
| `posteredit/EditablePoster.jsx` | **KEEP** | In-place text click-to-edit canvas wrapper in `Generate.jsx`. |
| `posteredit/FieldTextEditor.jsx` | **KEEP** | Form inputs for poster headline, date, time, venue in `Generate.jsx`. |
| `posteredit/PhotoBar.jsx` | **KEEP** | Thumbnail strip for custom user photos placed into poster slots. |
| `posteredit/SizeStepper.jsx` | **KEEP** | Dimension and aspect ratio adjuster in `Generate.jsx`. |
| `posteredit/VariableFields.jsx` | **KEEP** | Sidebar displaying custom blanks and photo slots defined by the template. |
| `posteredit/VariableFields.slots.test.jsx` | **KEEP** | Unit test verifying element blank slot mapping. |
| `shell/AppShell.jsx` | **KEEP** | Full viewport shell coordinating fixed sidebar, top bar, and scrollable content. |
| `shell/ChangePasswordDialog.jsx` | **KEEP** | Modal for first-time password set or user credential update. |
| `shell/navItems.js` | **SIMPLIFY** | Nav menu definitions; remove Brand Kit and Templates from client roles. |
| `shell/OrgBar.jsx` | **KEEP** | Multi-company switcher dropdown and picker modal for Super Admin. |
| `shell/SideBar.jsx` | **KEEP** | Main collapsible left navigation menu and mobile flyout drawer. |
| `shell/TopBar.jsx` | **KEEP** | Fixed header bar displaying screen title, tenant name, and user menu. |
| `shell/useClientOptions.js` | **KEEP** | Fetches client company list for Super Admin's tenant selector. |
| `shell/UserMenu.jsx` | **KEEP** | User avatar menu for password update and signing out. |
| `ui/*` (14 shadcn component files) | **KEEP** | Reusable UI atoms (Button, Dialog, Input, Select, Skeleton, etc.). |

---

### C. Client Hooks, Utils, Config & Data

| File | Classification | One-line Reason |
| :--- | :--- | :--- |
| `hooks/useAutoFitText.js` | **KEEP** | Shrinks poster text dynamically to fit designated element boxes without clipping. |
| `hooks/useAutosave.js` | **KEEP** | Automatically persists poster changes to server draft. |
| `hooks/useGoogleFonts.js` | **KEEP** | Loads active Latin and Tamil Google Fonts on demand. |
| `config/brand.js` | **KEEP** | App branding constants (`Brandframe`, `PosterAI`). |
| `config/draft.js` | **KEEP** | Autosave interval and debounce settings. |
| `context/AuthContext.jsx` | **KEEP** | User session state, active client ID, token refresh, and permission queries. |
| `data/demoPosters.js` | **SIMPLIFY** | 1,200 lines of hardcoded demo mocks for dead dev test benches; trim down to basic sample prompts. |
| `lib/utils.js` | **KEEP** | Tailwind class merge utility (`cn`). |
| `services/api.js` | **KEEP** | Axios client with base `/api` URL, retry handling, and Bearer token headers. |
| `test/setup.js` | **KEEP** | Vitest testing setup and canvas mocks. |
| `utils/assetUpload.js` | **KEEP** | Direct and multipart asset upload helpers. |
| `utils/brandBands.js` | **KEEP** | Calculations for locked header and footer band positioning. |
| `utils/brandBands.test.js` | **KEEP** | Tests for band positioning and element isolation. |
| `utils/brandImage.js` | **KEEP** | Image validation, size limits, and friendly error messages. |
| `utils/brandImage.test.js` | **KEEP** | Tests for image validation rules. |
| `utils/brandPresets.js` | **KEEP** | Pre-packaged color schemes to speed up Super Admin's initial company brand setup. |
| `utils/brandRender.js` | **KEEP** | Resolves brand tokens (`brand:primary`, fonts) into browser CSS. |
| `utils/cardListHelpers.js` | **KEEP** | Data formatting for structured event agendas and speaker lists. |
| `utils/contrast.js` | **KEEP** | WCAG AA contrast ratio calculations and auto-color selection. |
| `utils/editorGuides.js` | **KEEP** | Grid lines and snapping math for Super Admin's template editor. |
| `utils/exportPoster.js` | **KEEP** | Pure browser-side PNG (`html-to-image`) and PDF (`jsPDF`) generator. |
| `utils/posterAiDesign.js` | **KEEP** | Maps AI design responses into template recipe structures. |
| `utils/posterAiDesign.test.js` | **KEEP** | Tests for AI design layout mappings. |
| `utils/posterContentFields.js` | **KEEP** | Extracts and formats headline, subheadline, dates, venue, and descriptions. |
| `utils/posterDesign.js` | **KEEP** | Isolates poster design snapshots from live template changes. |
| `utils/posterThumbnail.jsx` | **KEEP** | Generates lightweight preview thumbnails for poster cards. |
| `utils/posterVariables.js` | **KEEP** | Replaces template variable blanks with user-supplied text and photos. |
| `utils/posterVariables.slots.test.js` | **KEEP** | Tests for poster slot replacement logic. |
| `utils/templateBuilderRules.js` | **DELETE** | Dead helper rules exclusively imported by obsolete `TemplateBuilder.jsx`. |
| `utils/templateEditorItems.js` | **KEEP** | Coordinate clamping and boundary checks for template elements. |
| `utils/templateRender.js` | **KEEP** | Resolves zones, brand bands, and content area for rendering. |
| `utils/timeAgo.js` | **KEEP** | Friendly relative timestamps ("2 days ago", "just now"). |

---

### D. Server Routes, Controllers, Middleware & Validation

| Module / Route | Classification | One-line Reason |
| :--- | :--- | :--- |
| `routes/health.routes.js` | **KEEP** | Production health check endpoint (`/api/health`) used by render keep-alive ping. |
| `routes/auth.routes.js` & `auth.controller.js` | **SIMPLIFY** | Keep login, refresh, logout, password change/reset; disable MFA and email-change endpoints. |
| `routes/user.routes.js` & `user.controller.js` | **KEEP** | User listing, creation, and password resets; Super Admin provisions local company logins. |
| `routes/client.routes.js` & `client.controller.js` | **KEEP** | Tenant company CRUD for Super Admin, and `/clients/me` for active company context. |
| `routes/brandKit.routes.js` & `brandKit.controller.js` | **SIMPLIFY** | Keep GET `/api/brand-kit` for all; restrict PUT to Super Admin (Client Admin no longer overwrites brand kit). |
| `routes/template.routes.js` & `template.controller.js` | **SIMPLIFY** | Keep GET for all; restrict template creation/editing/activation/deletion exclusively to Super Admin. |
| `routes/poster.routes.js` & `poster.controller.js` | **KEEP** | Core generation (`/generate`, `/image`), draft autosave, listing, versioning, and thumbnail endpoints. |
| `routes/upload.routes.js` & `upload.controller.js` | **KEEP** | Handles company logo uploads, poster photo uploads, and signed Cloudinary tickets. |
| `routes/asset.routes.js` & `asset.controller.js` | **DISABLE** | Generic asset repository endpoints; unneeded since images are bound directly to posters and brand kits. |
| `routes/audit.routes.js` & `audit.controller.js` | **DISABLE** | Enterprise audit log viewer and CSV export; unneeded for infrequent local company poster generation. |
| `middleware/auth.middleware.js` | **KEEP** | Enforces JWT token verification, role permissions, and tenant isolation (`req.clientId`). |
| `middleware/cookies.middleware.js` | **KEEP** | Parses cookies safely. |
| `middleware/csrf.middleware.js` | **KEEP** | Guard against CSRF attacks on state-modifying requests. |
| `middleware/upload.middleware.js` | **KEEP** | Multer memory storage preventing serverless local disk writes. |
| `middleware/validate.middleware.js` | **KEEP** | Zod request validation runner returning standardized 400 responses. |
| `validation/ai.schema.js` | **KEEP** | Validates structured LLM outputs and prompt payloads. |
| `validation/auth.schema.js` | **SIMPLIFY** | Validates auth requests; can remove unused MFA schemas. |
| `validation/brandKit.schema.js` | **KEEP** | Enforces brand kit color, typography, and band limits. |
| `validation/client.schema.js` | **KEEP** | Validates client company creation and settings updates. |
| `validation/poster.schema.js` | **KEEP** | Validates poster creation, drafts, versions, and edits. |
| `validation/template.schema.js` | **KEEP** | Enforces 30-element cap, zone boundaries, and archetype rules. |
| `validation/user.schema.js` | **KEEP** | Validates user creation, role assignment, and profile edits. |

---

### E. Server Services

| Service | Classification | One-line Reason |
| :--- | :--- | :--- |
| `services/ai/chain.js` | **KEEP** | Fallback chain coordinating Groq -> Cerebras -> Gemini -> Mock for high availability. |
| `services/ai/choices.js` | **KEEP** | Enforces diversity in design layout recipes across AI generations. |
| `services/ai/index.js` | **KEEP** | Core AI service transforming plain user language into structured poster copy and layout choices. |
| `services/ai/listParser.js` | **KEEP** | Parses raw pasted text into structured event agenda or speaker lists. |
| `services/ai/prompt.js` | **KEEP** | System and user prompts directing LLM poster writing. |
| `services/ai/schema.js` | **KEEP** | Zod response schema guaranteeing AI never outputs raw HTML or arbitrary colors. |
| `services/ai/providers/*` (5 files) | **KEEP** | Connectors for Anthropic, Gemini, OpenAI, Groq/Cerebras, and offline mock. |
| `services/auth.service.js` | **KEEP** | Password hashing (bcrypt) and public user sanitization. |
| `services/brand/style.js` | **KEEP** | Derives styling rules and defaults from brand kit tokens. |
| `services/image/*` (5 files) | **SIMPLIFY** | AI image generation; local businesses typically upload photos of real people, places, or products. |
| `services/images.js` | **KEEP** | Stock photo search via Pexels / Unsplash. |
| `services/mail.service.js` | **SIMPLIFY** | Sends password resets and invites via Resend; remove MFA/email-verification mailers. |
| `services/mfa.service.js` | **DISABLE** | TOTP token generation and step-up auth; disable via `ENABLE_MFA=false`. |
| `services/poster/content.js` | **KEEP** | Sanitizes and normalizes poster copy fields. |
| `services/poster/design.js` | **KEEP** | Snapshots template design into poster document for version isolation. |
| `services/poster/recipe.js` | **KEEP** | Resolves design recipes into concrete layout tree nodes. |
| `services/rateLimit.js` | **KEEP** | Database-backed sliding rate limiter protecting login and AI generation endpoints. |
| `services/storage.js` | **KEEP** | Cloudinary direct stream upload and signed ticket generation. |
| `services/template/elements.js` | **KEEP** | Normalizes and validates template elements. |
| `services/template/zones.js` | **KEEP** | Calculates zone geometry and content area boundaries. |
| `services/token.service.js` | **KEEP** | Secure random token generation for password resets and invites. |
| `services/audit.service.js` | **DISABLE** | Writes audit log events to MongoDB; disable via `ENABLE_AUDIT=false` to reduce database writes. |

---

### F. Shared Modules (`shared/`)

| Module | Classification | One-line Reason |
| :--- | :--- | :--- |
| `shared/aiChoices.js` | **KEEP** | Design archetype enum and layout recipe mapping table. |
| `shared/archetypes.js` | **KEEP** | Definitions for 10 structural poster archetypes (hero, split, card list, etc.). |
| `shared/auditSentences.js` | **DISABLE** | Human-readable audit sentence formatters; tied to disabled audit feature. |
| `shared/defaultTemplates.js` | **KEEP** | Seed templates created when onboarding a new local client company. |
| `shared/designBlocks.js` | **KEEP** | Procedural layout building blocks used by design engine. |
| `shared/designComposer.js` | **KEEP** | Assembles blocks and archetypes based on event category. |
| `shared/designPaging.js` | **KEEP** | Paginates through design variations in `DesignChooser.jsx`. |
| `shared/designRecipes.js` | **KEEP** | Procedural layout engine placing elements within the content area. |
| `shared/eventTypes.js` | **KEEP** | Event classifications (sports, gala, meeting, market, festival, etc.). |
| `shared/fallbackParser.js` | **KEEP** | Regex and heuristic fallback parser extracting dates, times, and venues when LLM is unavailable. |
| `shared/layoutEngine.js` | **KEEP** | Flexbox-like constraint solver computing bounding boxes for elements. |
| `shared/paletteFamilies.js` | **DELETE** | Only used by dev test bench `CatalogDevPage.jsx` and offline report script `catalog-report.js`. |
| `shared/permissions.js` | **SIMPLIFY** | Role-based permission matrix; restrict brandkit/template write permissions strictly to `superadmin`. |
| `shared/redirect.js` | **KEEP** | Validates redirect URLs to prevent open-redirect vulnerabilities. |
| `shared/templateElements.js` | **KEEP** | Shared element limits, token validators, and variable slot detectors. |
| `shared/textFit.js` | **KEEP** | Font size reduction math for headings and body copy. |
| `shared/textScripts.js` | **KEEP** | Multi-script typography rules, line heights, and Tamil script font stacks. |
| `shared/visualScore.js` | **KEEP** | Evaluates generated poster layout quality and contrast balance. |

---

### G. Server Scripts (`server/scripts/`)

| Script | Classification | One-line Reason |
| :--- | :--- | :--- |
| `seed.js` | **KEEP** | Essential seed script provisioning Super Admin account and initial baseline data. |
| `seed-demo.js` | **KEEP** | Provisions demo company and sample templates for testing. |
| `migrate-brandkit.js` | **KEEP** *(Archive)* | Historical migration script; keep for database version documentation. |
| `migrate-poster-designs.js` | **KEEP** *(Archive)* | Historical migration script; keep for database version documentation. |
| `migrate-templates.js` | **KEEP** *(Archive)* | Historical migration script; keep for database version documentation. |
| `migrate-client-id.js` | **DELETE** | One-time migration script already executed; not registered in `package.json`. |
| `debug-save-template.js` | **DELETE** | Ad-hoc debug script from past troubleshooting; zero imports or package runners. |
| `catalog-report.js` | **SIMPLIFY** | Offline benchmarking script measuring design scores across presets. |
| `design-report.js` | **SIMPLIFY** | Generates visual layout report across archetypes. |
| `eval-ai.js` | **KEEP** | Evaluates AI prompt quality and JSON compliance against sample briefs. |
| `test-stage3.js` | **DELETE** | Obsolete stage 3 regression script superseded by vitest suite. |
| `test-stage4.js` | **DELETE** | Obsolete stage 4 regression script superseded by vitest suite. |
| `test-stage5.js` | **DELETE** | Obsolete stage 5 regression script superseded by vitest suite. |
| `test-acceptance-images-layout.js` | **DELETE** | Redundant test script duplicate of `test-acceptance.js`. |
| `test-*.js` (remaining 22 test scripts) | **KEEP** | Active component and integration test suites run via `npm run test:*`. |

---

### H. Tests, Workflows, Docs, Root Files & Folders

| Item | Classification | One-line Reason |
| :--- | :--- | :--- |
| `shots/` (folder with 5 PNG images) | **DELETE** | Old UI screenshot dumps with zero code references. |
| `.github/modernize/code-migration/` (folder) | **DELETE** | Leftover markdown artifacts from early October migration logs. |
| `e2e/*` (5 Playwright specs) | **KEEP** | End-to-end browser test suites verifying acceptance, editor, and exports. |
| `tests/server/*` (5 Vitest files) | **KEEP** | Core server integration test suite run in CI. |
| `tests/shared/*` (1 Vitest file) | **KEEP** | Unit tests for shared element and layout validation. |
| `.github/workflows/ci.yml` | **KEEP** | GitHub Actions pipeline running linting, formatting, security audit, tests, and build. |
| `.github/dependabot.yml` | **KEEP** | Automated dependency security patcher. |
| `docs/CODEMAP.md` | **KEEP** | Authoritative architecture and codebase codemap. |
| `docs/progress-log.md` | **KEEP** | Historical log of development stages. |
| `docs/SCOPE_CLEANUP.md` | **KEEP** | This authoritative cleanup plan. |
| `api/index.js` | **KEEP** | Serverless Express entry point required for Vercel deployment. |
| `.env.example`, `.env` | **KEEP** | Environment variable definitions. |
| `package.json`, `package-lock.json` | **KEEP** | Project manifest and dependency locks. |
| `.gitignore`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `playwright.config.js`, `vitest.config.js`, `vercel.json`, `README.md`, `AGENTS.md` | **KEEP** | Standard root repository configurations. |

---

## 3. Detailed Verification for DELETE Candidates

Every item proposed for deletion has been verified with recursive grep to confirm that removing it will not break existing production routes or components:

1. **`client/src/pages/CatalogDevPage.jsx`**
   - *Grep check:* Imported only in `client/src/App.jsx` line 35 wrapped in `import.meta.env.DEV`.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove lazy import and `<Route path="/catalog-dev">` from `App.jsx`.
2. **`client/src/pages/ExportTestPage.jsx`**
   - *Grep check:* Imported only in `client/src/App.jsx` line 32 wrapped in `import.meta.env.DEV`.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove lazy import and `<Route path="/export-test">` from `App.jsx`.
3. **`client/src/pages/PosterStudioTest.jsx`**
   - *Grep check:* Imported only in `client/src/App.jsx` line 29 wrapped in `import.meta.env.DEV`.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove lazy import and `<Route path="/studio-test">` from `App.jsx`.
4. **`client/src/pages/PreviewTestPage.jsx`**
   - *Grep check:* Imported only in `client/src/App.jsx` line 38 wrapped in `import.meta.env.DEV`.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove lazy import and `<Route path="/preview-test">` from `App.jsx`.
5. **`client/src/pages/TemplateBuilder.jsx`**
   - *Grep check:* Imported only in `client/src/App.jsx` line 25 (`/templates/builder`). Not linked in any menu, button, or component across the app.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove lazy import and `<Route path="/templates/builder">` from `App.jsx`.
6. **`client/src/utils/templateBuilderRules.js`**
   - *Grep check:* Exclusively imported by `client/src/pages/TemplateBuilder.jsx` line 14.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, deleted alongside `TemplateBuilder.jsx`.
7. **`client/src/components/brand/DesignModesCard.jsx`**
   - *Grep check:* Orphaned. Never imported by `BrandKit.jsx` or any other application component.
   - *Used only by:* `client/src/components/brand/DesignModesCard.test.jsx`.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, delete component and its companion test file.
8. **`client/src/components/brand/DesignModesCard.test.jsx`**
   - *Grep check:* Tests the orphaned `DesignModesCard.jsx`.
   - *Safe to delete:* Yes.
9. **`client/src/pages/HowItWorks.jsx`**
   - *Grep check:* Imported in `App.jsx` line 20. Linked only in `Footer.jsx` line 11 and `navItems.js` guest links.
   - *Impact on Stored Data:* None.
   - *Safe to delete:* Yes, remove route from `App.jsx` and link from `Footer.jsx`.
10. **`client/src/components/FaqAccordion.jsx`**
    - *Grep check:* Imported exclusively in `client/src/pages/Home.jsx` line 8.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes, remove alongside public landing page simplification.
11. **`client/src/components/LandingPosterCard.jsx` & `LandingPosterCard.test.jsx`**
    - *Grep check:* Imported exclusively in `client/src/pages/Home.jsx` line 6 and its test file.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
12. **`shared/paletteFamilies.js`**
    - *Grep check:* Imported only in `client/src/pages/CatalogDevPage.jsx` and `server/scripts/catalog-report.js`.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes, once `CatalogDevPage.jsx` is deleted and `catalog-report.js` is cleaned.
13. **`server/scripts/debug-save-template.js`**
    - *Grep check:* Zero imports. Not referenced in `package.json` scripts or documentation.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
14. **`server/scripts/test-stage3.js`, `test-stage4.js`, `test-stage5.js`**
    - *Grep check:* Zero imports. Old milestone test scripts not in `package.json` or CI.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
15. **`server/scripts/test-acceptance-images-layout.js`**
    - *Grep check:* Redundant copy of `test-acceptance.js`.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
16. **`server/scripts/migrate-client-id.js`**
    - *Grep check:* Historical migration script already completed.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
17. **`shots/` directory (5 PNG files)**
    - *Grep check:* Zero references across all codebase files.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.
18. **`.github/modernize/code-migration/` directory**
    - *Grep check:* Leftover git tracking files from October migration experiment.
    - *Impact on Stored Data:* None.
    - *Safe to delete:* Yes.

---

## 4. Stored Data & Model Dependencies (NEVER Deleted Without Migration)

The following MongoDB models and schema fields touch stored database collections. They are strictly preserved to ensure zero database corruption or data loss:

| Model | Collection | Key Fields | Dependent Code / Collections | Migration Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`Client.model.js`** | `clients` | `name`, `slug`, `status`, `settings` | Root tenant entity referenced by `clientId` in `User`, `BrandKit`, `Template`, `Poster`, `Asset`, `AuditEvent`, `Token`. | **NEVER DELETE.** Essential for company isolation. |
| **`User.model.js`** | `users` | `name`, `email`, `passwordHash`, `role`, `clientId`, `isActive`, `mustChangePassword`, `mfa`, `emailVerified` | Referenced by `Poster.userId`, `Template.userId`, `Session.userId`, `Token.userId`. | **NEVER DELETE.** Preserved even if MFA is disabled at the route level. |
| **`BrandKit.model.js`** | `brandkits` | `clientId`, `templateId`, `orgName`, `orgSubtext`, `logoUrl`, `palette`, `typography`, `headerBand`, `footerBand`, `socialLinks` | Loaded by `PosterCanvas` and `TemplatePreview` for every poster render. | **NEVER DELETE.** Super Admin sets up once per company; default brand kit for all tenant posters. |
| **`Template.model.js`** | `templates` | `clientId`, `name`, `category`, `size`, `zones`, `layout`, `elements`, `versions`, `draft`, `isActive` | Referenced by `Poster.templateId`. Defines the layout, variable blanks, and photo slots. | **NEVER DELETE.** Super Admin sets up company templates once; client users render posters against them. |
| **`Poster.model.js`** | `posters` | `clientId`, `userId`, `templateId`, `headline`, `subheadline`, `date`, `time`, `venue`, `description`, `photos`, `design`, `versions`, `draft`, `thumbnail`, `status` | Contains saved posters, user customizations, and frozen layout snapshots. | **NEVER DELETE.** Represents customer deliverables and export history. |
| **`Session.model.js`** | `sessions` | `userId`, `tokenHash`, `userAgent`, `ip`, `expiresAt` | Read by auth middleware for token revocation and user session management. | **NEVER DELETE.** Required for active refresh token rotation. |
| **`Token.model.js`** | `tokens` | `type`, `userId`, `email`, `clientId`, `tokenHash`, `expiresAt` | Used for user invites and password reset links. | **NEVER DELETE.** Required for onboarding and recovery. |
| **`RateCounter.model.js`** | `ratecounters` | `key`, `count`, `resetAt` | Multi-instance sliding window rate limiter in MongoDB. | **NEVER DELETE.** Protects against brute-force attacks on serverless deployment. |
| **`LoginAttempt.model.js`**| `loginattempts`| `ip`, `email`, `attempts`, `lockedUntil` | Tracks consecutive failed sign-ins to throttle brute force. | **NEVER DELETE.** Core security throttle. |
| **`Asset.model.js`** | `assets` | `clientId`, `url`, `publicId`, `width`, `height` | Media asset records. | **PRESERVE SCHEMA.** Endpoints can be disabled without dropping existing database records. |
| **`AuditEvent.model.js`**| `auditevents` | `clientId`, `actorId`, `action`, `targetType`, `targetId`, `diff`, `meta` | Historical audit logs. | **PRESERVE SCHEMA.** Disable logging via feature flag without dropping historical records. |

---

## 5. Architectural Recommendations for Local Business Scope

1. **Direct Entry for Local Clients**:
   - Local business owners do not self-register on a marketing page.
   - If unauthenticated, root `/` can redirect directly to `/login`.
   - Once logged in, `clientadmin` and `user` can land directly on `/create` (or a simplified `/posters` dashboard).
2. **Simplified Navigation for Client Roles**:
   - `Super Admin`: Sees Dashboard, Organizations (`/clients`), Users (`/users`), Brand Kit, Templates, and Poster Studio.
   - `Client Admin`: Sees Create Poster (`/create`), Past Posters (`/posters`), and optionally Team (`/team`).
   - `User`: Sees Create Poster (`/create`) and Past Posters (`/posters`).
3. **Restricted Template & Brand Layer Access**:
   - Lock `/brand-kit`, `/brand-layer/edit`, `/templates`, and `/templates/:id/edit` exclusively to `superadmin`.
   - Client Admins and Users generate posters using the locked template(s) pre-assigned to their company.
4. **Trim Unused Dead Weight**:
   - Remove the 4 dev test pages (`CatalogDevPage`, `ExportTestPage`, `PosterStudioTest`, `PreviewTestPage`) and dead `TemplateBuilder`.
   - Remove orphaned `DesignModesCard.jsx`, unused `shots/` folder, and outdated migration scripts.

---

## 6. Questions for Approval

Before executing any file deletions or route pruning, please confirm your preference on these architectural decisions:

1. **Landing Page vs. Direct Sign-In:**  
   Should visiting the root domain (`/`) redirect directly to `/login` with a clean company sign-in screen, or do you still want to preserve a public homepage?
2. **Client Admin Role Capabilities:**  
   Since Super Admin sets up the company once, should Client Admin be able to invite their own coworkers (`/team`), or should Super Admin manage all user accounts?
3. **Initial Template Provisioning:**  
   When Super Admin sets up a new company, should the system automatically copy 1 or 2 standard default templates (e.g. from seed defaults) into that company, which Super Admin can then tweak?
4. **AI Generation & Stock Photography:**  
   For local companies changing posters once a year, do you want to keep the full external AI text generation (LLM chain) and stock photo search (Unsplash/Pexels), or should user photo upload and direct text input take primary focus?
5. **MFA & Audit Logs:**  
   Can we cleanly disable TOTP MFA and Audit Event logging via feature flags (`ENABLE_MFA=false`, `ENABLE_AUDIT=false`) to eliminate unnecessary complexity for local businesses?

---

*Awaiting your approval to proceed with execution.*
