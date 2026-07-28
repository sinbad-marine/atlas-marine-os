# Atlas Marine OS v8.0 — Professional Rebuild

This is a clean Sprint 1 rebuild. It is not a patch over the previous application.

## Verified Sprint 1 scope

- Professional responsive dashboard
- Supabase Project URL + publishable key connection
- Supabase Authentication sign-in/sign-out
- Authorized workspace selection
- Private cloud file upload
- Documents metadata insertion
- Cloud file listing
- Private signed-file opening
- File download
- File rename
- File deletion
- Cloud document counters
- Nautical Publications bucket shortcut
- Nautical Charts bucket shortcut
- Route library preservation

## Intentionally not active yet

- Captain Sinbad live AI
- Crew cloud synchronization
- AI document indexing
- Admin user invitation
- Automated security scanning

These are deferred until Sprint 1 passes live testing.

## Installation

Upload all files from the ZIP to the root of the GitHub repository and replace the current files.

After GitHub Pages deploys:

1. Close all old Atlas Marine OS tabs.
2. Open the site again.
3. Confirm `v8.0` in the top-right corner.
4. Open **Atlas Cloud**.
5. Enter the Supabase Project URL and publishable key.
6. Sign in.
7. Select the workspace.
8. Test with one small PDF first.

## Security

Never enter:

- Supabase secret key
- service-role key
- database password
- OpenAI API key

The browser app uses only the publishable key. Supabase RLS enforces access.
