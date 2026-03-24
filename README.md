<img src="src/assets/img/icon-128.png" width="64" alt="Dev Password Helper icon" />

# Dev Password Helper

This repo is now a focused Manifest V3 Chrome extension for a simple, personal use case:

- save credentials for different development environments
- match them to the current page by host or wildcard pattern
- autofill username/password fields on demand from the popup
- manage records from a dedicated options page

## What changed

The original repository still contained most of the default extension boilerplate: new tab, devtools, panel, background samples, and CDP-specific template injection code. That has been removed so the project is centered on two pages only:

- `popup`: quick record lookup, copy actions, and autofill for the active tab
- `options`: create, edit, and delete saved password records

Autofill now uses `activeTab` + `scripting`, so the extension only touches the current page when you trigger it from the popup.

## Security note

This is intentionally simple. Passwords are stored in `chrome.storage.local` in plain text inside your local Chrome profile.

That is acceptable for a private development helper if you understand the tradeoff, but it is not equivalent to Bitwarden or other encrypted password managers.

## Data model

Each saved record contains:

- `name`
- `sitePattern`
- `username`
- `password`
- optional `usernameSelector`
- optional `passwordSelector`
- optional `notes`

`sitePattern` supports plain substring matching like `staging.example.com` and wildcard matching like `*.internal`.

## Development

1. Install dependencies:

```bash
npm install
```

2. Start the dev build:

```bash
npm start
```

3. Load the extension:

```text
chrome://extensions -> Developer mode -> Load unpacked -> build/
```

## Build

```bash
npm run build
```

Useful maintenance commands:

```bash
npm run typecheck
npm run prettier
```

## Project structure

```text
src/
  assets/
  pages/
    Options/
    Popup/
  shared/
  styles/
  manifest.json
```

## Next steps

Reasonable follow-up improvements if you want to keep evolving this:

- add import/export for records
- add optional per-record submit-button selectors
- encrypt records with a local master password
- support one-click record creation from the active tab
