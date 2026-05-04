# Version Display in Toolbar

## Summary

Display the current build's git commit (short hash) and commit date in the toolbar so users can identify exactly which build of XineMap they are running. No semver — git identity only.

## User-Visible Behavior

The toolbar's right-hand area shows the version after the existing project-name slot, in the format:

```
596090e · 2026-04-27
```

- Short commit hash (7 chars) in monospace
- ISO date (`YYYY-MM-DD`) of the commit, not the build
- Muted color (`var(--c-text-4)`), small text (`text-xs`), matching the existing project-name styling
- Separator: middle dot (` · `)
- No tooltip, no link, no click behavior

## Architecture

### Build-time injection (`vite.config.ts`)

Vite's `define` option injects compile-time constants. At config load, run:

- `git rev-parse --short=7 HEAD` → commit hash
- `git log -1 --format=%cI HEAD` → ISO 8601 commit timestamp; take the date portion (`split('T')[0]`)

If either command throws (no `.git`, git not on PATH), substitute fallbacks:

- hash → `'dev'`
- date → `''`

The fallback ensures `npm run build` succeeds in environments without git history (e.g., shallow CI checkouts, source tarballs).

Defined globals:

- `__APP_COMMIT__: string`
- `__APP_COMMIT_DATE__: string`

### Type declarations (`src/vite-env.d.ts`)

Declare the two globals so TypeScript accepts them:

```ts
declare const __APP_COMMIT__: string
declare const __APP_COMMIT_DATE__: string
```

If `src/vite-env.d.ts` already exists, append; otherwise create it.

### Module (`src/version.ts`)

Single export wrapping the globals:

```ts
export const version = {
  commit: __APP_COMMIT__,
  date: __APP_COMMIT_DATE__,
}
```

Keeps the `__APP_*__` references confined to one file.

### Toolbar render (`src/components/Toolbar.tsx`)

Add a sibling span next to the existing project-name span (lines 127–132). The version span is always rendered when `version.commit` is non-empty. When a project name is also present, the two appear side-by-side separated by a thin divider (a span with `mx-2 text-[var(--c-text-4)]` containing `|`), project name first, version second.

When no project name is present, only the version shows, still right-aligned via the existing `ml-auto` on the project-name span (move `ml-auto` to a wrapping container so layout stays correct in both cases).

Render shape:

```tsx
<div className="ml-auto flex items-center text-xs text-[var(--c-text-4)]">
  {projectName && <span>{projectName}</span>}
  {projectName && version.commit && <span className="mx-2">|</span>}
  {version.commit && (
    <span>
      <span className="font-mono">{version.commit}</span>
      {version.date && <> · {version.date}</>}
    </span>
  )}
</div>
```

## Files Touched

- `vite.config.ts` — add git lookup and `define` block
- `src/vite-env.d.ts` — declare global constants (create if missing)
- `src/version.ts` — new, exports `{ commit, date }`
- `src/components/Toolbar.tsx` — render version next to project name

## Out of Scope

- Semver / `package.json` version display
- Build timestamp (only commit timestamp)
- Click-to-copy, links to GitHub commit pages
- Dirty-tree indicator (`-dirty` suffix when uncommitted changes exist at build time)
- Tooltip with full hash

## Testing

Manual verification (no automated tests for this feature):

1. `npm run dev` — toolbar shows current commit + date.
2. `npm run build && npm run preview` — same values appear in production build.
3. Change branch / make a commit, restart dev server — values update.
4. Temporarily rename `.git` → confirm `dev` fallback renders without crash, then restore.
