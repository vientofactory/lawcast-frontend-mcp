# LawCast UI/UX Design System Analysis

## Source and precedence

The bundled snapshot records the current frontend version, Git baseline, per-file SHA-256 and a combined fingerprint. It is regenerated from the working sources, including shared components, all Svelte routes and the two shared CSS files; hashes, not the baseline commit alone, identify uncommitted changes. Source-observed hook names are separately identified; their presence does not imply a global CSS definition. See `design/snapshot.json` for the current counts and provenance.

Sources of truth are `frontend/src/app.css`, `frontend/src/lib/styles/layout.css`, the shared component implementations and the root `agent_memories/repo/frontend-notes.md`. The original exploration document describes older export-let/reactive-label behavior; current components use Svelte 5 runes and `#lib` aliases. Historical screenshot/interaction findings in `agent_memories/65-ui-layout-redesign/` explain why existing focus, disclosure and notification abstractions must be preserved.

## Visual primitives

`src/app.css:83` defines the light neutral palette; the following dark-theme block replaces surfaces, text, borders and status values together. The system distinguishes primary/muted/inset/hover surfaces and primary/secondary/muted/dim text. Reusing the raw light-theme color in a component loses the corresponding dark-theme contract. Tokens are declaration records, not a flattened light-only map.

`src/lib/styles/layout.css:1` centralizes gutters and wide/reading/form widths. Shared reading axes and page-owned gutters prevent nested padding. `lc-page-heading`, `lc-section-heading`, `lc-list-title` and the late typography rules define hierarchy. Supporting text is generally 0.875rem; small legacy labels are not a reason to reduce new body text.

Late layout rules define flat list rows and responsive pagination. This is not a generic dashboard-card design: lists and opinions stay open, separators belong to one boundary owner and metadata remains subordinate. Some content panels still have semantic backgrounds. Do not mechanically remove every surface or flatten every component-specific radius.

The generic radius reset is 0.5rem and generic decorative shadows/backdrop filters are neutralized. Earlier CSS still contains gradients and old color literals, including specialized timeline/brand treatments. Those are existing exceptions, not an invitation to introduce a new decorative palette. The guard treats new decorations conservatively; exceptional changes need explicit policy/test review.

## Interaction ownership

`ModalShell.svelte` owns shared modal structure, notification scope, Escape handling and modal focus/motion actions. Its closing lifetime is linked to inertness/focus restoration, not merely an opacity change. `FilterDialog.svelte` is a native-dialog pattern with its own lifecycle. `ModalCloseButton.svelte` supplies the labelled 44px close action. Rebuilding these ad hoc risks losing behavior that static markup cannot prove.

`notifications.ts`, `NotificationViewport.svelte`, `Alert.svelte` and `FormFeedback.svelte` separate transient scoped notifications from persistent field descriptions. A success timer in a new component would create a parallel notification system. Native disclosures use `disclosure-motion.ts`; their open state and lazy content must survive closing animation. `PaginationNav.svelte` preserves navigation and responsive targets, with 48px mobile targets in layout.css.

`LoadFailureState.svelte` and `request-failure.ts` distinguish recoverable failures and explicit HTTP 429 cooldown. A search engine health warning is advisory, not permission to disable already-working search results. UI review must include loading, empty, failed and retry/cancel states rather than only a successful screenshot.

## Automated boundaries

Svelte parsing separates real markup and scripts from comments and quoted examples. Svelte compilation contributes accessibility diagnostics. PostCSS parses CSS declarations. Deterministic checks catch unknown semantic names, raw palette utilities/CSS colors, new decoration, custom dialogs, missing test hooks, suppressed focus and legacy props/reactivity.

Runtime bindings/spreads and custom styles become review states instead of unsupported claims of compliance. Named shared components can be inspected without unrestricted filesystem reads. Submitted source is never imported or evaluated. The stdio-only server has no filesystem-write or network tools.

Static analysis cannot certify contrast, touch target geometry, page-level hierarchy, cancellation or modal lifetime. Browser acceptance includes both themes, keyboard, reduced motion, 320px width, 200% text, long Korean content and relevant API states. The MCP prompt establishes a pre-change/reference/review sequence; an external required CLI/CI gate supplies enforcement. This repository does not silently modify client settings or frontend CI.

## Maintenance and rollback

Regenerate the snapshot after frontend design changes and review source hashes and policy together. The runtime deliberately does not follow arbitrary external roots. Run the unit and real-protocol tests, then introduce the CLI on changed frontend files before considering a legacy-wide baseline. The verification demo preserves its original hash, modifies a copy, and proves rollback on a second copy; actual frontend source and unrelated working-tree changes remain untouched.

## Unified list and icon contract (2026-11-27)

Current working-source extraction includes every Svelte route, not only shared components. Source hashes/fingerprint identify uncommitted designs; the Git commit is the baseline, not a claim that its tree equals the snapshot.

Navigable lists share `lc-flat-list-row` structure, `lc-list-title` typography and native `a.lc-list-link` behavior. Pointer hover is visually inert across rows, titles and metadata: no row background, color, underline or movement changes. Independent secondary buttons retain their neutral hover background. Keyboard focus retains the shared row surface, a visible outline and 44px link targets. Whole-row destinations and title/information-region destinations keep the same neutral contract; independent downloads/history/comparison controls never become nested links. Prose links remain distinct. The common flat-row base still overrides legacy dark-card surfaces.

FontAwesome glyphs have no decorative backplates or padded tiles. Semantic icon colors, status text badges, banner surfaces, button hit targets and stateful switch thumbs remain intentional. The two new AST rules reject list-title overrides (including descendant anchors and literal dynamic classes) and icon-only wrapper plates; runtime/custom CSS still needs browser review.

## Frontend Playwright commit gate

Static pass/review is not commit authorization. Run `npm run test:e2e:all` in the frontend without file, grep or project filters. Every Playwright configuration, including both PWA runtimes and real-backend integration, runs through its owning runner with its required fixture flags. Set `PLAYWRIGHT_BACKEND_URL` to the real API base including `/api`, or provide the local default backend. Missing or unavailable backend prerequisites block commits. Record the target and never describe mock coverage as live integration proof. The complete gate clears frontend-reuse overrides for integration and web-vitals so old servers cannot stand in for the staged source.

Any failure or missing prerequisite blocks a frontend-related commit. Fix the cause and rerun the complete matrix from its beginning after the last edit. Do not weaken assertions, add skips, accept stale output, or bypass the gate. The frontend `.githooks/pre-commit` executes the same matrix and fails closed for unstaged/untracked changes or index/source changes during validation; activate it with `git config core.hooksPath .githooks` in that repository. MCP remains a read-only design server rather than a shell executor.
