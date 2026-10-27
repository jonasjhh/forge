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

The backend compiler configuration must allow JavaScript output because Forge's bundler uses `ts-loader` to compile the resolver. Keep `noEmit` out of the root configuration; `pnpm typecheck` passes `--noEmit` explicitly for validation without writing files. The frontend can retain `noEmit: true` because CRA handles its bundling separately.

Vis Network is pinned to `9.1.13` because the tested 10.x releases publish source maps referencing TypeScript files missing from the package. This version includes complete source maps and supports the app's graph API. Keep the pin until a fixed release is verified; application source maps remain enabled.

The graph library injects CSS at runtime, so Forge's Custom UI manifest allows `unsafe-inline` for styles. This applies only to the iframe's style policy; inline scripts and `eval` are not enabled. Deploy manifest changes and refresh the Jira app for the updated policy to take effect.

## Groups, Goals, and Metrics

The default List view shows groups, goals, sub-goals, and metrics in one hierarchical table, with assignees, grouping, parent goals, and metric counts. There is no group sidebar. Groups are list-only grouping rows identified by a group icon. Goals, nested sub-goals, and metrics are indented beneath their parents, and branches can be expanded or collapsed.

Shared goals appear beneath each of their parents, but every occurrence edits the same saved goal. Searching and filtering retain matching entries' ancestors as context. Large expanded lists load additional rows through Show more.

Search and filter controls are available in List, Graph, and Tree. Search matches item names, descriptions, goal categories, assignees, and assigned label names. The type filter is a checkbox dropdown with independently selectable Groups, Decision, Capability, Delivery, and Metrics. Goal categories match with OR; all types are selected initially. The All types checkbox selects or clears every option, with a mixed state for partial selections. Clearing every option shows no matches. Matching entries retain their ancestor context.

The Labels tab manages shared workspace labels with editable names and colors. The color control offers 16 presets and a Custom option that opens the color picker. Create a label from the Labels tab or directly in an item's edit panel; the latter saves the label definition and assignment together. Assign labels to any group, goal, or metric from its create or detail form. Labels appear as colored chips in the list and details panel. The label filter matches entries with any selected label (OR) and combines with the other filters; matching entries retain their ancestors. Removing a label also removes its assignments from every entry when the label changes are saved.

The Assignees filter selects one or more people already assigned in the workspace. It matches entries assigned to any selected account (OR), then retains every parent goal and group ancestor as context, including multiple parent chains. Unrelated siblings and unassigned descendants are not included unless they match. Search and type filters apply alongside the assignee selection; Clear all removes the assignee restriction.

Drag an entry by its grip to rearrange it. The upper and lower drop indicators place it before or after a sibling; the center of a compatible group or goal moves it inside. Moving a shared goal changes only the dragged parent relationship, preserving its other parents and metrics. Root and child ordering are persisted. Invalid hierarchy changes and drops outside the list do not save changes. Drag handles support pointer/touch input and keyboard pickup, arrow-key movement, drop, and cancellation.

Drag an entry by its link icon and drop it on another row to add it beneath that row without removing any existing parent connections. Alternatively, drag with the normal grip and drop on the destination's link icon. Link targets highlight compatible parents; duplicate connections, cycles, and incompatible entry types are rejected. Metrics can be linked under goals but cannot contain children. The add-goal and delete buttons are in the rightmost actions column.

Goals are a single object type with a Decision, Capability, or Delivery category. New goals default to Delivery, and existing goals without a category are read as Delivery without an automatic storage write. Change the category in the create or detail form; the list shows a category-specific icon and label. A sub-goal is simply a goal linked to another goal; it can have several parent goals and nested goals of its own. Create goals without a group or parent, link existing goals through the detail panel, or add a new sub-goal directly. Each goal has zero or more metrics. Metrics are leaves with an optional current value, target value, and unit. All entries have a name and optional description; goals and metrics have Jira-user assignee lists.

Group membership is shown by the hierarchy rather than a separate table column. Change a goal's Group field in its detail form and save, or drag the entry into or out of a group. Moving groups does not change goal-parent links or metrics. Groups can contain nested groups, and grouping is independent of the goal hierarchy. Self-connections, cycles, and incompatible parent/child types are rejected. Deleting an entry removes its connections but preserves its contents.

Every entry requires an explicit `group`, `goal`, or `metric` type. Loading validates the stored graph without modifying storage; only explicit saves write changes.

In Tree, selecting a goal or metric focuses the view on every directly or indirectly connected goal and metric within the active filters. Connections are followed in both directions, including shared parents; group membership does not connect otherwise separate trees. Click empty canvas space or use Show full tree to clear the focus. Focus only changes the view, not stored data, and does not affect Graph or List.

Graph and Tree focus on goal-to-goal and goal-to-metric relationships, hiding groups entirely. A goal with multiple parents keeps all parent edges in both layouts. Goal nodes use their category label and color; metric nodes show their current and target values. Assigned labels appear on nodes, and hovering reveals descriptions, assignees, and all labels. Search and filters narrow both views while keeping matching entries' ancestors visible. Graph uses a force-directed layout; Tree arranges the same relationship network from top to bottom. Both support selection, zoom, and fit-to-view. The detail panel provides editing and relationship management without using the canvas.

All signed-in users of the same Jira installation share one workspace stored in Forge Key-Value Storage. Forge isolates storage between installations and environments. Every signed-in user with access to Compass can view and edit it. Workspaces support up to 100 entries, 300 connections, and 200 KB of saved data. Names are limited to 200 characters, descriptions to 500, metric units to 40, and each goal or metric to 20 assignees.

The app requires the `storage:app` and `read:jira-user` scopes. Deploy and run `forge install --upgrade` after permission changes, including the approved avatar image hosts. User search runs as the current Jira user and requires Jira's Browse users and groups permission. Assignees appear as Jira-style avatar-and-name chips in the list, picker, and selected values. Saved assignees retain their account ID, display-name snapshot, and optional approved avatar URL. In Jira, avatars are refreshed through the user API even when a saved URL exists, preserving the exact current image and initials color. Requests are shared per account for the page session; saved URLs are fallbacks when the API is unavailable, and failed images fall back to initials. Assignment does not grant or restrict access to the workspace.

Refresh the workspace to load other users' changes; updates are not pushed live. Saves replace the shared workspace, so simultaneous edits by different users or tabs are last-save-wins. The latest editor's account ID is stored with the save timestamp.

Export downloads the entire loaded workspace as a JSON file containing `items` and `labels`, regardless of active filters or collapsed branches. IDs, child ordering, shared parent connections, assignees, goal categories, and metric values are preserved. Import accepts the same format, validates fields and relationships, and asks for confirmation before replacing all current entries, connections, and labels in a single save. Invalid files and canceled imports do not write data. Import uses the normal workspace limits and rejects files larger than 1 MB; export a backup before replacing shared data. Save timestamps and editor metadata are regenerated on import.

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

To deploy specifically to production, configure the site once in the git-ignored `.forge/production.json`. Copy the format from `production.site.example.json` and replace the hostname with your Jira site. This local config is not committed.

For a production site where Compass is already installed, run:

```sh
pnpm run deploy:production
```

This reads the site from `.forge/production.json`, type-checks and builds, deploys to Forge's `production` environment, then upgrades the Jira installation on that site.

For the first production installation, use the one-time command:

```sh
pnpm run deploy:production:first-install
```

It uses the same config, deploys to production, and installs the app without `--upgrade`. Subsequent production releases use `pnpm run deploy:production`.

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
