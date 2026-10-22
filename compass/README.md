# Compass

Compass is an Atlassian Forge app that appears as a global page in Jira.

The global page uses `layout: blank` to remove Jira's default page-title header. Compass renders its own header; Jira's main navigation remains unchanged. Manifest layout changes take effect after deployment.

See [developer.atlassian.com/platform/forge/](https://developer.atlassian.com/platform/forge) for documentation and tutorials explaining Forge.

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Quick start

Install dependencies from the app root (`compass/`):

```sh
pnpm install
pnpm --dir static/application install
```

Edit the frontend in `static/application/src/`.

## Source Structure

Application source and tests use strict TypeScript. The Forge handler remains `index.handler`; its implementation is now `src/index.ts`.

```text
shared/workspace.ts                 Shared data and resolver contracts
src/index.ts                        Forge resolver adapter
src/domain/                         Backend validation, ownership, and tests
static/application/src/
	app/                              App state, composition, and layout styles
	components/ui/                    Reusable buttons and control styles
	components/assignees/              Reusable avatar, chip, picker, and filter
	features/workspace/components/     Entry forms, hierarchy list, drag rows, graph
	features/workspace/model/          Typed hierarchy, filtering, and move rules
	features/workspace/__tests__/      Workspace behavior regressions
	services/                         Forge/preview transport and Jira user access
	styles/                           Global foundation and design tokens
	types/                            Type-only exports of the shared contracts
```

Reusable controls do not own workspace state. Workspace components receive typed data and callbacks; platform requests live in services. Shared contracts are imported as types, not frontend runtime dependencies. Backend validation still accepts `unknown` and validates it before saving.

The frontend uses TypeScript 4.9 to match Create React App 5's supported compiler range; the backend uses TypeScript 5.9. Keep the compilers package-local. Backend tests run through `tsx`, and frontend tests remain on the existing CRA/Jest runner.

Vis Network is pinned to `9.1.13` because the tested 10.x releases publish source maps referencing TypeScript files missing from the package. This version includes complete source maps and supports the app's graph API. Keep the pin until a fixed release is verified; application source maps remain enabled.

## Folders, Goals, and Metrics

The default List view shows folders, goals, sub-goals, and metrics in one hierarchical table, with assignees, folder grouping, parent goals, and metric counts. There is no folder sidebar. Folders are list-only grouping rows identified by a folder icon. Goals, nested sub-goals, and metrics are indented beneath their parents, and branches can be expanded or collapsed.

Shared goals appear beneath each of their parents, but every occurrence edits the same saved goal. Searching and filtering retain matching entries' ancestors as context. Large expanded lists load additional rows through Show more.

The Assignees filter selects one or more people already assigned in the workspace. It matches entries assigned to any selected account (OR), then retains every parent goal and folder ancestor as context, including multiple parent chains. Unrelated siblings and unassigned descendants are not included unless they match. Search and type filters apply alongside the assignee selection; Clear all removes the assignee restriction.

Drag an entry by its grip to rearrange it. The upper and lower drop indicators place it before or after a sibling; the center of a compatible folder or goal moves it inside. Moving a shared goal changes only the dragged parent relationship, preserving its other parents and metrics. Root and child ordering are persisted. Invalid hierarchy changes and drops outside the list do not save changes. Drag handles support pointer/touch input and keyboard pickup, arrow-key movement, drop, and cancellation.

Goals are a single object type. A sub-goal is simply a goal linked to another goal; it can have several parent goals and nested goals of its own. Create goals without a folder or parent, link existing goals through the detail panel, or add a new sub-goal directly. Each goal has zero or more metrics. Metrics are leaves with an optional current value, target value, and unit. All entries have a name and optional description; goals and metrics have Jira-user assignee lists.

Folder grouping is shown by the hierarchy rather than a separate table column. Change a goal's Folder field in its detail form and save, or drag the entry into or out of a folder. Moving folders does not change goal-parent links or metrics. Folders can contain nested folders, and folder grouping is independent of the goal hierarchy. Self-connections, cycles, and incompatible parent/child types are rejected. Deleting an entry removes its connections but preserves its contents. Existing untyped entries are treated as folders.

Graph and Tree focus on goal-to-goal and goal-to-metric relationships, hiding folders entirely. A goal with multiple parents keeps all parent edges in both layouts. Graph uses a force-directed layout; Tree arranges the same relationship network from top to bottom. Both support selection, zoom, and fit-to-view. List search includes assignee names, and a type filter narrows goals versus metrics. The detail panel provides editing and relationship management without using the canvas.

All signed-in users of the same Jira installation share one workspace stored in Forge Key-Value Storage. Forge isolates storage between installations and environments. Every signed-in user with access to Compass can view and edit it. Workspaces support up to 100 entries, 300 connections, and 200 KB of saved data. Names are limited to 80 characters, descriptions to 500, metric units to 40, and each goal or metric to 20 assignees.

The app requires the `storage:app` and `read:jira-user` scopes. Deploy and run `forge install --upgrade` after permission changes, including the approved avatar image hosts. User search runs as the current Jira user and requires Jira's Browse users and groups permission. Assignees appear as Jira-style avatar-and-name chips in the list, picker, and selected values. Saved assignees retain their account ID, display-name snapshot, and optional approved avatar URL. Existing assignments can load their avatar through Jira's user API; unavailable images fall back to initials. Assignment does not grant or restrict access to the workspace.

Refresh the workspace to load other users' changes; updates are not pushed live. Saves replace the shared workspace, so simultaneous edits by different users or tabs are last-save-wins. The latest editor's account ID is stored with the save timestamp.

## Local Development

From `compass/`:

```sh
pnpm --dir static/application start
```

On `localhost` or `127.0.0.1`, the app runs in preview mode using browser local storage and sample users Alex Morgan, Sam Taylor, and Robin Chen. Preview data is local to that browser and separate from Jira data; it does not simulate sharing between users. Hosted in Jira, the app uses Forge resolvers, shared storage, and real Jira user search instead.

Run backend hierarchy, assignee, metric, and shared-workspace tests:

```sh
pnpm test
```

## Code Quality

Run these commands from `compass/`. Type checking covers backend, shared contracts, frontend, and tests. ESLint covers TypeScript and tooling configuration; Prettier covers source, configuration, and documentation. Generated builds, dependencies, coverage, and lockfiles are excluded where applicable.

```sh
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format:check
pnpm format
```

## Build, Deploy, and Upgrade

Run the full workflow from the app root (`compass/`):

```sh
pnpm run deploy
```

This type-checks both packages, builds the frontend, deploys the app with `MAJOR_VERSION_RULE` approval, and upgrades the existing installation. Each step runs only if the previous step succeeds. Forge prompts for deployment and installation options.

From the app root (`compass/`), build the frontend before deploying, then upgrade the existing Jira installation:

```sh
cd static/application
pnpm build
cd ../..
forge deploy
forge install --upgrade
```

Select the same environment for deployment and installation, and select the Jira site where Compass is already installed when upgrading.

The frontend build writes to `static/application/build`, which is the `resources` path in [manifest.yml](manifest.yml). Forge deploys those built files, so rebuild after frontend changes to avoid deploying stale assets.

For a first installation on a new site, use this after deploying instead of `forge install --upgrade`:

```sh
forge install
```

### Notes

- Use the `forge deploy` command when you want to persist code changes.
- Use the `forge install` command when you want to install the app on a new site.
- Routine code-only deployments are picked up by existing installations without an upgrade. Use `forge install --upgrade` when installation changes require it, such as updated scopes or permissions.

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.
