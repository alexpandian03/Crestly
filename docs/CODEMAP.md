# PosterAI Code Map

## 1. Directory Structure & Ownership

- `client/src/pages/`: React SPA route views (Create/Generate, BrandKit, TemplateEdit, History, Dashboard, Auth, Settings, Dev).
- `client/src/components/`: Reusable UI components (canvas rendering, template preview, modal dialogs, contextual editors, shell layout).
- `client/src/utils/`: Client-side rendering helpers, font loaders, token resolution, export utilities, and form helpers.
- `shared/`: Pure JavaScript isomorphic logic shared identically across client and server (element schema, layout recipes, text script rules, palette math, visual scoring). Zero npm runtime dependencies.
- `server/routes/`: Express endpoint declarations and route middleware guards (`requireAuth`, `requireRole`, `tenantGuard`).
- `server/controllers/`: Request orchestration, input extraction, and response envelope formatting.
- `server/models/`: Mongoose schemas and database models (multi-tenant `clientId` isolation).
- `server/services/`: Core business logic (AI generation orchestration, image uploads, poster composition, brand kit resolution).
- `server/validation/`: Zod schemas validating API request bodies and database payloads.
- `server/scripts/`: Database migrations, CLI seeders, evaluation scripts, and Node.js test runners.
- `api/`: Vercel serverless entrypoint (`api/index.js`).

---

## 2. Poster Workflow Key Files & Tests

| Component / Function | Implementation Files | Test Files |
| :--- | :--- | :--- |
| **Renderer** | `client/src/components/PosterCanvas.jsx`<br>`client/src/components/PosterElementLayer.jsx`<br>`client/src/utils/brandRender.js` | `client/src/components/PosterCanvas.recipe.test.jsx`<br>`client/src/components/PosterCanvas.brandBands.test.jsx`<br>`client/src/components/PosterCanvas.slotPictures.test.jsx`<br>`server/scripts/test-render-layout.js` |
| **Preview Component** | `client/src/components/TemplatePreview.jsx`<br>`client/src/components/PosterPreview.jsx` | `client/src/components/TemplatePreview.test.jsx` |
| **Design Recipes** | `shared/designRecipes.js`<br>`server/services/poster/recipe.js` | `server/scripts/test-design-recipes.js`<br>`server/scripts/catalog-report.js` |
| **Template Builder** | `client/src/pages/TemplateEdit.jsx`<br>`client/src/components/editor/EditorStage.jsx`<br>`client/src/components/editor/EditorRail.jsx` | `server/scripts/test-stage9.js`<br>`server/scripts/test-template-elements.js` |
| **Brand Kit Editor** | `client/src/pages/BrandKit.jsx`<br>`client/src/components/brand/DesignModesCard.jsx`<br>`client/src/pages/TemplateEdit.jsx` (mode: `brandLayer`) | `server/scripts/test-brandkit.js`<br>`client/src/utils/brandBands.test.js`<br>`client/src/components/brand/DesignModesCard.test.jsx` |
| **Create Page** | `client/src/pages/Generate.jsx`<br>`client/src/components/create/DesignChooser.jsx` | `server/scripts/test-e2e-generate.js`<br>`server/scripts/test-acceptance.js` |
| **POST /api/posters/generate** | `server/routes/poster.routes.js`<br>`server/controllers/poster.controller.js` | `server/scripts/test-stage5.js`<br>`server/scripts/test-acceptance.js` |
| **Gemini Call** | `server/services/ai/providers/gemini.js`<br>`server/services/ai/chain.js`<br>`server/services/ai/prompt.js` | `server/scripts/test-ai-chain.js`<br>`server/scripts/eval-ai.js` |
| **Validator** | `server/services/ai/index.js`<br>`server/validation/poster.schema.js`<br>`shared/visualScore.js` | `server/scripts/test-ai-chain.js`<br>`server/scripts/test-poster-design.js`<br>`server/scripts/catalog-report.js` |

---

## 3. Key Data Shapes

- **Poster Element**: Defined in `shared/templateElements.js` (`normalizeElement`, item types: `text`, `image`, `shape`, `icon`, `card_list`). Validated by `server/validation/template.schema.js` (`elementItemSchema`).
- **Template**: Defined in `server/models/Template.model.js` (`elements`, `zones`, `page`, `size`, `editorVersion: 2`, `versions`). Schema validated in `server/validation/template.schema.js`.
- **Brand Kit**: Defined in `server/models/BrandKit.model.js` (`orgName`, `colors`, `fonts`, `header`, `footer`, `bands`, `contacts`, `social`). Schema validated in `server/validation/brandKit.schema.js`.
- **Poster**: Defined in `server/models/Poster.model.js` (`content`, `design: { brandKit, template, bands, capturedAt }`, `versions`, `status`, `isDeleted`). Schema validated in `server/validation/poster.schema.js`.

---

## 4. Protected Files (Do NOT Touch)

The following files govern authentication, session security, tenant boundary enforcement, and team/admin management:

- `server/routes/auth.routes.js`
- `server/controllers/auth.controller.js`
- `server/services/auth.service.js`
- `server/models/User.model.js`
- `server/models/LoginAttempt.model.js`
- `server/models/RateCounter.model.js`
- `server/middleware/auth.middleware.js`
- `server/validation/auth.schema.js`
- `server/validation/user.schema.js`
- `server/routes/user.routes.js`
- `server/controllers/user.controller.js`
- `server/routes/client.routes.js`
- `server/controllers/client.controller.js`
- `server/services/storage.js`
- `client/src/context/AuthContext.jsx`
- `client/src/components/ProtectedRoute.jsx`
- `client/src/pages/Login.jsx`
- `client/src/pages/Users.jsx`
- `client/src/pages/Clients.jsx`
- `api/index.js`

---

## 5. Duplicate or Inactive Code (File Names Only)

- `client/src/pages/TemplateBuilder.jsx` (legacy zone viewer superseded by `client/src/pages/TemplateEdit.jsx`)
- `client/src/utils/posterThumbnail.jsx` (older thumbnail helper superseded by `client/src/components/TemplatePreview.jsx`)
- `server/services/ai/providers/anthropic.js` (inactive AI provider stub)
- `server/services/ai/providers/openai.js` (inactive AI provider stub)
- `server/scripts/test-stage3.js` (early development milestone script superseded by `test-stage8.js`)
- `server/scripts/test-stage4.js` (early development milestone script superseded by `test-stage9.js`)
- `server/scripts/debug-save-template.js` (temporary one-off debug script)
