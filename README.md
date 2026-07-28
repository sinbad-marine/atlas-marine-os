# Atlas Marine OS v6.2 — Reliable Upload Edition

## Upload fix
- Local file upload now reads each file as ArrayBuffer and stores a Blob in IndexedDB.
- Uploads have timeout handling and visible errors.
- Buttons no longer remain indefinitely on “Uploading…”.
- Safari Private Browsing limitations are detected and explained.
- Cloud upload validates connection, login and workspace first.

## Design
- Refined luxury marine background and panels
- Improved contrast, spacing, hover states and upload visibility
- New Local Vault status banner

## Installation
Replace all files in the GitHub repository root and commit.

After GitHub Pages deploys:
1. Close the old Atlas Marine OS tab.
2. Open the site again.
3. Confirm v6.2 in the top-right corner.
4. Prefer normal Safari rather than Private Browsing for local persistent files.
