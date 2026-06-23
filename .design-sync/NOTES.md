# design-sync notes — fieldvision-web

This repo is a **Next.js app**, not a published component library. The sync scopes
the 5 reusable `src/components/schedule/` components into claude.ai/design. Project:
**FieldVision Design System** (`aecce1fa-8bbf-4c16-8f85-9eb74c29956b`).

## Repo-specific gotchas (read before re-syncing)

- **No dist / no library build.** Shape is `package` in synth-entry territory. We pin
  a synthetic `--entry ./.ds-entry.tsx` (gitignored, re-created if missing — see below)
  that re-exports the 5 components, so `PKG_DIR` resolves to the repo root (needed for
  `cssEntry` bounding and real pkg metadata). Build cmd:
  `node .ds-sync/package-build.mjs --config design-sync.config.json --node-modules ./node_modules --entry ./.ds-entry.tsx --out ./ds-bundle`
- **`.ds-entry.tsx` is gitignored** (it's a generated artifact). If it's missing on a
  fresh clone, recreate it: it just re-exports `PDFUploader, LineItemsTable, GanttBars,
  ScheduleTable, AskTheField` from `./src/components/schedule/<Name>`.
- **No `.d.ts` extraction in synth mode.** ts-morph only ingests `.d.ts` files (it sees
  just `next-env.d.ts`), so every prop interface degrades to `{[key:string]: unknown}`.
  Fixed by hand-written `cfg.dtsPropsFor` for all 5, with domain shapes (Task / LineItem /
  ValidatedOperation / AskResponse) **inlined** so the emitted `.d.ts` stays valid TS.
  If a component's props change upstream, update `dtsPropsFor` to match.
- **Tailwind is JIT — no CSS ships from the app build.** We compile a standalone
  stylesheet via the repo's own tailwind:
  `node_modules/.bin/tailwindcss -c .ds-sync/tailwind.css.config.js -i src/styles/globals.css -o .design-sync/.cache/compiled.css`
  and point `cfg.cssEntry` at it. The config's `content` globs cover
  `src/components/**` and `.design-sync/previews/**`. **Recompile this CSS before
  rebuilding** if component class usage or preview wrappers change, or new utility
  classes will be missing from the shipped CSS.
- **Components are dark-themed** (`bg-fv-gray-900`/`fv-black`, white text). The preview
  card body is white, so every authored preview wraps the component in a dark
  `Frame` (inline styles, not Tailwind — so they don't depend on the compiled CSS).
- **Space Grotesk is a remote `@import`** (Google Fonts) at the top of the compiled CSS →
  `[FONT_REMOTE]`, loads at runtime, nothing to ship. It's first in `_ds_bundle.css` so
  it's a valid leading `@import`.
- **AskTheField is an overlay** (absolutely-positioned slide-out panel) →
  `cfg.overrides.AskTheField = {cardMode:'single', primaryStory:'Open', viewport:'360x540'}`,
  and its preview Frame is `position:relative`.
- **Static-only states skipped:** drag-reorder (ScheduleTable), live chat messages
  (AskTheField — `messages` is internal `useState`, can't be seeded via props), PDF
  drag-active, hover tooltips. Cards show the resting state.
- **`npm i` for converter deps must run inside `.ds-sync/`**, never the repo root (it
  pollutes the app's package.json/lock).

## Re-sync risks (what can silently go stale)

- **`dtsPropsFor` is a hand-maintained mirror** of the real component props. It does NOT
  track source edits. If someone changes `ScheduleTableProps` etc., the `.d.ts` the design
  agent codes against silently drifts. Re-check the 5 prop bodies against source on re-sync.
- **Preview data is inlined** (the 10-task remodel schedule, the 5 line items). It's
  decoupled from the app; fine, but it won't reflect real data-shape changes — re-verify
  the previews still compile and render if the `Task`/`LineItem` shapes change.
- **Compiled CSS is a point-in-time snapshot** of Tailwind output. New classes added to
  the components after the last compile won't ship until `compiled.css` is regenerated.
- **GanttBars `Default` cell** shows 9 of 10 tasks at 380px height (10th scrolls off).
  Acceptable; bump the Frame height if you want all visible.
- Toolchain assumed: Node 22, the repo's own `tailwindcss`/`react` from `./node_modules`,
  Playwright + Chromium installed under `.ds-sync/`.
