# ULima++ Backend Specs

Specs in this folder are the source of truth for backend behavior when using Tessl Spec Driven Development.

## Current Context

- PostgreSQL definitive schema already exists and is modeled in `src/db/schema/schema.ts`.
- Do not create tables, run migrations, run seeds, or insert mock data unless explicitly approved.
- Frontend JSON files are disposable mocks and must not be imported into PostgreSQL.
- Every API change must update `docs/specs/api-contracts.md`.
- Implement only after the feature spec is approved.

Conventions:

- One feature folder per product feature.
- Spec files end with `.spec.md`.
- Each spec has YAML frontmatter with `name`, `description`, and `targets`.
- `targets` must point to real backend files or globs.
- Feature module targets should assume the current `routes -> controller -> service -> repository` structure.
- Include `src/shared/**` or `src/events/**` in `targets` only when the feature changes shared code or observers.
- Include `src/db/schema/schema.ts` only for an approved database model change.
- Add `[@test]` links only after the referenced test files exist.

Current feature folders:

- `auth`
- `academic-profile`
- `curriculum`
- `grades`
- `schedule`
- `course-detail`
- `alerts`
- `section-management`
- `networking`
