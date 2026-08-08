# DREAMSheet AI authentication email templates

These files are reference templates only. They are not deployed by the application or migrations.

Copy them manually into **Supabase Dashboard → Authentication → Email Templates**:

- `confirmation.html` → Confirm signup
- `password-reset.html` → Reset password

Keep Supabase's `{{ .ConfirmationURL }}` variable intact. Before production cutover, confirm the Supabase Site URL and allowed redirect URLs, then send a test confirmation and password-reset email from the Preview environment.

The templates currently use a live-text `DREAMSheet AI` header because the repository does not contain an approved mark-only asset. Replace the TODO in both templates only when the brand owner supplies the corrected production mark.
