# Atlas Marine OS v6.0 — Atlas Cloud Control Center

Upload all 10 files to the root of the GitHub repository and replace existing files.

## New in v6.0
- Supabase Project URL + publishable-key connection
- Secure sign-in and sign-out
- Workspace selection
- Users and roles viewer
- Cloud Storage upload
- Documents, Nautical Publications and Nautical Charts
- Private signed-file opening
- AI indexing requests through `index-document`
- AI job monitor
- Security configuration check
- Existing offline Atlas Marine OS modules
- Captain Sinbad local interface

## Security
Enter only the Supabase Project URL and publishable key.
Never enter a secret key, service-role key, database password or OpenAI key.

## Current limitation
Live AI indexing requires the `index-document` Edge Function.
Live Captain Sinbad cloud chat requires the `captain-sinbad` Edge Function.
Until then, local Captain Sinbad mode remains available.
