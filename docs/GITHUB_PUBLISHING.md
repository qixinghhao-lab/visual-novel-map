# GitHub Publishing Notes

This repository is prepared for an open-source GitHub release, but the remote publish step still needs a local GitHub CLI setup.

## Current blocker

- The project folder was not a Git repository when publishing preparation started.
- `gh` was not available in the local shell.
- The connected GitHub app is authenticated as `qixinghhao-lab`, but the available connector tools do not expose repository creation.

## Recommended publish flow

Install and authenticate GitHub CLI:

```powershell
winget install --id GitHub.cli
gh auth login
gh auth status
```

Initialize and publish the repository:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial open-source release"
gh repo create visual-novel-map --public --source=. --remote=origin --push
```

If the repository already exists on GitHub, use:

```powershell
git remote add origin https://github.com/qixinghhao-lab/visual-novel-map.git
git push -u origin main
```

## Release checklist

- `README.md` explains the project with screenshots.
- `LICENSE` is present.
- `package.json` is no longer private and includes a license.
- `node_modules/`, `dist/`, and local handoff notes are ignored.
- `npm run build` passes before the first push.
