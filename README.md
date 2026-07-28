# Atlas Marine OS v7.0 — Atlas Cloud First

## What changed
- Atlas Cloud is now the primary document vault.
- Local IndexedDB is no longer presented as the main storage system.
- A visible four-step setup wizard guides connection, sign-in and workspace selection.
- Cloud connection status appears directly below the hero.
- Dashboard counters now read from the Supabase `documents` table.
- Nautical Publications and Nautical Charts cards open their matching cloud bucket.
- Cloud uploads refresh the live file and storage counters.
- Existing local operational modules remain available.

## First use
1. Open **Cloud Setup & Security**.
2. Enter the Supabase Project URL and publishable key.
3. Sign in with the Supabase Auth user.
4. Select the Atlas Marine Technologies workspace.
5. Open **Upload to Atlas Cloud**.

## Security
Only enter the public/publishable Supabase key.
Never enter an OpenAI key, secret key, service-role key or database password.

## GitHub update
Upload all package files to the root of the repository and replace existing files.
After deployment, close the old tab and reopen the website. Confirm `v7.0` at top right.
