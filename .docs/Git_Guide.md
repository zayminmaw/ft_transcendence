# Monorepo Git Workflow & Team Standards

## 1. Repository structure

One Git repository contains backend/, frontend/, docker/, .husky/, .docs/, root quality commands, and the README. Architecture and planning documents in .docs are versioned alongside code. Each application has its own package.json and package-lock.json; the root package.json orchestrates their commands and installs the Husky Git hook.

## 2. Branch and commit conventions

Use short-lived branches named <type>/<scope>/<description>. Types: feat, fix, refactor, perf, test, chore. Scopes: frontend, backend, fullstack, infra. Examples: feat/backend/parcels-dispatch-api, feat/frontend/marketing-pages, fix/fullstack/cod-reconciliation, chore/infra/docker-compose-update.

Use Conventional Commit messages: <type>(<scope>): <imperative description>. Examples: feat(parcels-api): add driver assignment; chore(frontend): initialize daisyui theme.

Release 0.1.0 establishes the initial shared scaffold on main. Use the workflow below for subsequent feature development.

## 3. Independent works

Each team member uses a separate clone and branch. A separate worktree can be used on a shared machine after the repository has an initial commit; never switch another person's active checkout to your branch.

An example ownership split is:

| Engineer | Primary area | Files normally owned |
| --- | --- | --- |
| 1 | Identity and tenant access | backend auth/rbac/organizations and membership contracts |
| 2 | Merchants and public website | frontend/backend clients and frontend marketing |
| 3 | Shipment operations | frontend/backend parcels |
| 4 | People and fleet | frontend/backend staff, drivers, and assets |
| 5 | Financial operations | frontend/backend billing and ledger services |

Agree ownership per task. This split reduces overlap; it does not remove the need to coordinate cross-domain changes. Frontend/backend developers can work on the same domain through agreed DTOs, response fields, permissions, and exports.

Keep feature code in module folders. Import other frontend modules only through their root index.ts; update a module's public contract with its owner. Share sample JSON responses before building API consumers. Never bypass security or replace a financial API with fake mutations to make a screen appear complete.

Coordinate changes to app.module.ts, app/routes.tsx, shared components/hooks/services, styles.css and the daisyUI theme, dependencies/lockfiles, Docker manifests, and migrations. Prefer one owner for an overlapping change, then integrate it before consumers continue. Avoid unrelated repository-wide formatting or dependency upgrades inside a domain feature.

Each engineer has their own ignored environment files and local database. On one machine, use distinct Compose project names and host ports for separate worktrees; root and development invocations for the same checkout must use the same project name. No secrets or shared development database credentials belong in Git.

## 4. Daily branch workflow

After the initial repository snapshot is committed and the team is authorized to use the remote:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/fullstack/parcels-dispatch
```

Keep branches focused, ideally within 24-48 hours, and under 400 lines when practical. Rebase on current main before review:

```sh
git fetch origin
git rebase origin/main
npm run format:check --prefix frontend
npm run verify
```

Do not blindly select one entire lockfile during a conflict. Resolve the application package.json dependency intent first, run npm install from that application directory to regenerate its lockfile, and review both files. Use new migration timestamps and filenames; never renumber or edit applied migrations to resolve a conflict.

## 5. Local quality gates

Run npm run verify from the root before proposing a merge. It builds/lints both applications and runs the backend HTTP security tests. Add meaningful domain tests as business behavior is introduced.

Lint does not edit source. Formatting follows .editorconfig: tabs displayed as 4 columns, with two-space YAML indentation. .gitkeep only preserves empty scaffold folders and can be removed after adding their first real file.

Prettier is installed with frontend dependencies by npm run setup. From the root, run npm run format --prefix frontend to fix formatting and npm run format:check --prefix frontend to check it. The check lists nonconforming files and exits with status 1. It is not included in npm run verify or the pre-push hook, so formatting violations alone do not automatically block commits/pushes. Check formatting before review; do not run it across another person's unrelated work.

npm run setup installs a Husky pre-push hook (.husky/pre-push) that runs npm run verify and blocks the push if it fails. No remote CI is installed, so the hook is a local check; git push --no-verify skips it and should be reserved for agreed exceptions.

## 6. Review and merge checklist

- Builds, lint, security tests, and relevant domain checks pass.
- Frontend format:check passes.
- A teammate reviews the module contract and behavior.
- Queries and mutations enforce organization scope and permissions.
- Financial mutations include ledger entries inside a transaction.
- Schema changes have a new reviewed migration and updated data dictionary.
- Dependency changes include the matching application lockfile.
- .env files, secrets, build outputs, and node_modules are excluded.
- Changes to shared integration files have an agreed owner.
- Squash merge after review to keep main history linear.
