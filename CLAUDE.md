# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- `npm install` — install dependencies.
- `npm start` — start the extension dev build. This runs `utils/webserver.js`, writes assets to `build/`, serves them from a local HTTPS webpack dev server, and enables hot reload for the React pages.
- `npm run build` — create the production extension bundle and zip package at `build/zip/password-helper-ext-<version>.zip`.
- `npm run typecheck` — run strict TypeScript checks with `tsc --noEmit`.
- `npm run prettier` — format JS/TS/TSX/JSON/CSS/SCSS/MD files.

## Testing and validation

- There is currently no automated test suite and no single-test command.
- Primary verification flow is manual in Chrome via `chrome://extensions` -> Developer mode -> Load unpacked -> `build/`.
- Before finishing changes, at minimum run `npm run typecheck` and validate the affected popup/options flows in the unpacked extension.

## High-level architecture

This repo is a Manifest V3 Chrome extension with only two user-facing entry points:

- `src/pages/Popup` — the popup UI used for quick autofill, in-popup record creation, record search, copy actions, and launching the options page.
- `src/pages/Options` — the full record-management UI for create/edit/delete/export workflows.

Webpack has exactly two TSX entries in `webpack.config.js`:

- `src/pages/Popup/index.tsx` -> `popup.html`
- `src/pages/Options/index.tsx` -> `options.html`

There is no background service worker, content script, devtools page, or new-tab page. Interaction with the active page happens only when the popup explicitly calls `chrome.scripting.executeScript`.

## Core data flow

- `src/types.ts` defines the shared record model. A `PasswordRecord` includes `name`, `sitePattern`, `reference`, `username`, `password`, optional selectors, notes, and `updatedAt`.
- `src/shared/storage.ts` is the storage boundary. Records are stored in `chrome.storage.local` under the `password-records` key, normalized on read/write, and sorted by `updatedAt` descending.
- `src/shared/url.ts` handles record matching for the active tab URL. Plain patterns use case-insensitive substring matching; patterns containing `*` are converted into regex-style wildcard matching.
- `src/shared/records.ts` contains UI-level record helpers such as text search across multiple fields and duplicate-record draft creation.
- `src/shared/csv.ts` exports the current records to a UTF-8 BOM CSV from the options page.

## Autofill architecture

Autofill is split across two layers:

- `src/shared/chrome.ts` wraps Chrome APIs (`tabs.query`, `runtime.openOptionsPage`, `scripting.executeScript`) in Promises for the React UI.
- `src/shared/autofill.ts` contains the functions injected into the active page. It finds visible editable username/password inputs, applies values through the native input setter, and dispatches `input`/`change` events so framework-controlled forms react correctly.

Selector detection also lives in `src/shared/autofill.ts`. The popup can inspect the current page, derive candidate selectors, and prefill them into the draft record.

## Permissions and security model

`src/manifest.json` keeps permissions intentionally small:

- `storage` for local record persistence
- `activeTab` and `scripting` for on-demand page inspection/autofill from the popup

Important repo constraint from the product behavior:

- Passwords are intentionally stored in plain text inside `chrome.storage.local` for a private development helper. Do not describe this as secure storage, and be careful not to add guidance that implies vault-grade protection already exists.

## Build/config details that matter

- `webpack.config.js` copies `src/manifest.json` and injects `package.json` description/version into the built manifest.
- The dev server in `utils/webserver.js` expects local certificates at `utils/localCA.cer` and `utils/localCA.key` and serves the extension build over HTTPS.
- Production packaging is handled by `utils/build.js`, which appends `zip-webpack-plugin` to the webpack config.
- TypeScript is strict (`tsconfig.json`), but webpack dev mode uses `ts-loader` with `transpileOnly`, so `npm run typecheck` is the real type-safety check.

## Style and repo-specific conventions

- React code is function-component based.
- Prettier settings are 2-space indentation, single quotes, trailing commas where valid, and always include arrow-function parentheses.
- Existing UI copy is primarily Chinese; preserve that tone and language when editing popup/options text unless the user asks otherwise.
- `build/` is generated output; edit source files under `src/` and `utils/` instead.
