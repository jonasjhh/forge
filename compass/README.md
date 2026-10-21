# Compass

Compass is an Atlassian Forge app that appears as a global page in Jira.

See [developer.atlassian.com/platform/forge/](https://developer.atlassian.com/platform/forge) for documentation and tutorials explaining Forge.

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Quick start

Install dependencies from the app root (`compass/`):

```sh
pnpm install
pnpm --dir static/hello-world install
```

Edit the frontend in `static/hello-world/src/`.

## Build, Deploy, and Upgrade

From the app root (`compass/`), build the frontend before deploying, then upgrade the existing Jira installation:

```sh
cd static/hello-world
pnpm build
cd ../..
forge deploy
forge install --upgrade
```

Select the same environment for deployment and installation, and select the Jira site where Compass is already installed when upgrading.

The frontend build writes to `static/hello-world/build`, which is the `resources` path in [manifest.yml](manifest.yml). Forge deploys those built files, so rebuild after frontend changes to avoid deploying stale assets.

The `static/hello-world` directory is a template name and should be renamed in a follow-up. When renaming it, also update the resource path in [manifest.yml](manifest.yml) and the commands above.

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

