# Contributing to lil image

Thanks for taking the time to contribute! This is a small project, so the process is
light.

## Getting set up

You'll need **Node ≥ 20** and **Rust** (stable). Then:

```bash
npm install
npm run tauri dev
```

The frontend also runs standalone in a browser with `npm run dev` — handy for UI work,
though background removal and upscaling need the Tauri backend.

## Before you open a PR

Run the checks the CI runs:

```bash
npx tsc --noEmit     # type-check the frontend
npm run build        # production frontend build
cd src-tauri && cargo check   # type-check the Rust backend
```

If you touched Rust that has tests:

```bash
cd src-tauri && cargo test
```

## Code style

- Match the surrounding code — naming, comment density, and idiom. Comments explain
  *why*, not *what*.
- TypeScript is strict; keep it that way. No `any` where a real type fits.
- Keep components focused; shared logic goes in `src/lib/`.

## Translations (i18n)

All user-facing text lives in [`src/lib/strings.tsx`](src/lib/strings.tsx), in two
dictionaries: `ru` and `en`. The `en` object is typed as `Dict = typeof ru`, so if you
add a key to one language the compiler will require it in the other — a missing or
renamed key is a build error, not a silent gap.

- Add new UI strings there, never inline in a component.
- Reach for `useStrings()` in a component; for code outside React (e.g. `intake.ts`),
  pass the string in from the caller.
- Adding a third language means adding another dictionary and widening the `Lang` union
  in [`src/lib/i18n.tsx`](src/lib/i18n.tsx) plus the `LanguagePicker` toggle.

## Adding a model or engine

Append an entry to `REGISTRY` in
[`src-tauri/src/models.rs`](src-tauri/src/models.rs) (id, url, size, category), and — for
upscale engines — add its models to `ENGINES` in
[`src/components/UpscalePanel.tsx`](src/components/UpscalePanel.tsx) with a label in
`strings.tsx`. Please link a direct, stable download URL and note the license.

## Commits & PRs

- Write clear commit messages; describe the *why* in the body when it isn't obvious.
- One logical change per PR where practical.
- Describe what you changed and how you tested it.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
