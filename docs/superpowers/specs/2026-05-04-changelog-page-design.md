# In-App Changelog Page

## Summary

Add a "Changelog" link to the toolbar that opens a full-page view of `CHANGELOG.md` rendered as Markdown. The changelog is handwritten and bundled at build time.

## User-Visible Behavior

- A new **Changelog** button appears in the toolbar (alongside Theme toggle), with an icon + label matching existing toolbar style.
- Clicking it replaces the editor/diagram split with a full-area Changelog page.
- The page has a header row: **← Back** on the left, "Changelog" title, and the version label (`hash · date`) echoed on the right.
- The body shows `CHANGELOG.md` rendered as Markdown in a centered, readable column (~720 px max width), scrollable.
- Clicking **← Back** returns to the main editor/diagram view, leaving editor and diagram state untouched.

## Architecture

### Source & loading

- `CHANGELOG.md` lives at the repo root.
- Imported into the bundle via Vite's raw import: `import changelogText from '../../CHANGELOG.md?raw'`. No runtime fetch; the file ships inside the JS bundle.
- A `vite-env.d.ts` declaration is added for the `?raw` import (handled automatically by `vite/client` if referenced; otherwise add a one-line module declaration).

### Page-state store (`src/store/useUiStore.ts`)

A new minimal Zustand store, since no other UI-route state exists today:

```ts
type Page = 'main' | 'changelog'
interface UiState {
  activePage: Page
  setPage: (p: Page) => void
}
```

Single source of truth for which top-level view is active. Lives outside `useEditorStore` and `useDiagramStore` so editor/diagram state is unaffected by navigation.

### App-level switch (`src/App.tsx`)

`App.tsx` reads `activePage`. When `'changelog'`, the existing main content (`Toolbar` + Allotment split) is replaced by `<Toolbar />` + `<ChangelogPage />`. Toolbar always renders so the user can navigate; the Changelog button itself just toggles the page back to `'main'` if already on the changelog (or hides — see decision below).

### Changelog page (`src/components/ChangelogPage.tsx`)

```tsx
export function ChangelogPage() {
  return (
    <div className="flex-1 overflow-auto bg-[var(--c-bg-2)]">
      <div className="max-w-3xl mx-auto px-8 py-8">
        <button onClick={() => useUiStore.getState().setPage('main')}
                className="text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] mb-6">
          ← Back
        </button>
        <article className="prose-changelog">
          <ReactMarkdown>{changelogText}</ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
```

### Markdown rendering

- Library: `react-markdown` (added to `dependencies`).
- No remark/rehype plugins for now — defaults handle headings, lists, links, code, blockquotes, horizontal rules.
- Styling: a small set of CSS rules under a `prose-changelog` class added to `src/index.css`, theme-aware via existing CSS variables. Covers `h1/h2/h3` sizes, list bullets, inline `code`, links (`var(--c-accent)`), and paragraph spacing. Avoids pulling in `@tailwindcss/typography` to keep the dependency surface small.

### Toolbar entry point (`src/components/Toolbar.tsx`)

A new button placed next to the Theme toggle:

```tsx
<button onClick={() => useUiStore.getState().setPage('changelog')} className={btnClass}>
  <svg .../>  {/* document icon */}
  Changelog
</button>
```

## Initial `CHANGELOG.md`

```markdown
# Changelog

## 2026-05-04

- Toolbar now displays the current build's commit hash and date.
```

Future entries appended above older ones (newest first), grouped by date.

## Files Touched

- `CHANGELOG.md` (new, repo root)
- `src/store/useUiStore.ts` (new)
- `src/components/ChangelogPage.tsx` (new)
- `src/components/Toolbar.tsx` — add Changelog button
- `src/App.tsx` — branch on `activePage`
- `src/index.css` — add `prose-changelog` styles
- `package.json` — add `react-markdown`

## Out of Scope

- URL routing / deep links (no router exists; not introducing one for one page)
- Per-version anchors, search, filtering
- In-app editing of the changelog
- RSS/Atom feeds
- Auto-generation from commits

## Testing

Manual verification:

1. `npm run dev` — click Changelog, page renders today's entry; ← Back returns to editor.
2. Toggle theme on the changelog page — colors update.
3. Editor content is preserved across navigation (open changelog, type in editor first, navigate away, navigate back).
4. `npm run build && npm run preview` — same behavior in production build.
