# Repository Guidelines

## Project Structure & Module Organization

Source lives under `src/`. Page entry points are in `src/pages/Popup` and `src/pages/Options`; shared browser, storage, URL, and record helpers live in `src/shared`; shared types are in `src/types.ts`; global styles and static assets live in `src/styles` and `src/assets`. The extension manifest is `src/manifest.json`. Build and dev-server scripts are in `utils/`. Generated output goes to `build/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm start`: run the Webpack dev server, rebuild into `build/`, and serve hot-reload assets for extension development.
- `npm run build`: create a production bundle and a zipped package in `build/zip/`.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run prettier`: format `js`, `ts`, `tsx`, `json`, `css`, `scss`, and `md` files.

Load the unpacked extension from `build/` via `chrome://extensions` during local testing.

## Coding Style & Naming Conventions

Use TypeScript with strict typing and React function components. Follow the existing Prettier config: 2-space indentation, single quotes, trailing commas where valid, and always include arrow-function parentheses. Name React components in PascalCase (`Popup.tsx`), utilities in camelCase (`storage.ts`), and keep page-specific styles beside their page component (`Popup.css`, `Options.css`).

## Testing Guidelines

There is currently no automated test suite in this repository. Before opening a PR, run `npm run typecheck`, then validate the extension manually in Chrome: create, edit, delete, and autofill a record from the popup, and verify record management on the options page. When adding tests later, place them next to the feature or under a `src/**/__tests__/` folder and use `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

Current history uses Conventional Commit style (`feat: add password-helper-ext`). Continue with `<type>: <short summary>` such as `fix: guard empty active tab url`. PRs should describe the user-facing change, list verification steps, link related issues, and include screenshots or short recordings for popup/options UI changes.

## Security & Configuration Tips

This extension stores credentials in `chrome.storage.local` as plain text. Never commit real credentials, exported browser data, or local secrets. Treat `utils/localCA.*` and any local certificate material as development-only assets unless a change explicitly requires them.
