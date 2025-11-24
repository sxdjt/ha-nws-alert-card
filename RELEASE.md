# Release Process for HACS

This document outlines the process for creating releases of the NWS Alert Card for HACS distribution.

## Versioning Strategy

This project follows [Semantic Versioning](https://semver.org/) (SemVer):
- **MAJOR** (X.0.0): Breaking changes or major architectural changes
- **MINOR** (x.Y.0): New features, backward-compatible improvements
- **PATCH** (x.y.Z): Bug fixes, minor improvements

## Pre-Release Checklist

Before creating a release, ensure:

1. [ ] All changes are committed and pushed to the main branch
2. [ ] HACS validation workflow passes (check GitHub Actions)
3. [ ] Code has been tested locally in Home Assistant
4. [ ] README.md is up to date with new features/changes
5. [ ] CLAUDE.md is updated if architectural changes were made
6. [ ] All security considerations have been reviewed

## Creating a Release

### Step 1: Update Version References

If you maintain version numbers in your code or documentation:
1. Update any version references in comments or documentation
2. Commit these changes

### Step 2: Create Git Tag

```bash
# Create an annotated tag with version and description
git tag -a v1.0.0 -m "Release v1.0.0 - Initial HACS release"

# Push the tag to GitHub
git push origin v1.0.0
```

### Step 3: Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" in the right sidebar
3. Click "Draft a new release"
4. Configure the release:
   - **Tag**: Select the tag you just created (e.g., `v1.0.0`)
   - **Release title**: Same as tag (e.g., `v1.0.0`)
   - **Description**: Include:
     - Brief summary of changes
     - New features
     - Bug fixes
     - Breaking changes (if any)
     - Installation/upgrade notes

#### Release Description Template

```markdown
## What's New

[Brief overview of the release]

### New Features
- Feature 1 description
- Feature 2 description

### Improvements
- Improvement 1
- Improvement 2

### Bug Fixes
- Fix 1
- Fix 2

### Breaking Changes
[List any breaking changes, or remove this section if none]

## Installation

This release is available through HACS. To install or update:
1. Open HACS in Home Assistant
2. Find "US NWS Alert Card"
3. Click Install/Update

## Upgrade Notes

[Any special instructions for users upgrading from previous versions]

## Full Changelog
[Link to compare view, e.g., https://github.com/sxdjt/ha-nws-alert-card/compare/v0.9.0...v1.0.0]
```

5. Click "Publish release"

## HACS Detection

HACS automatically detects new releases via GitHub tags. Users will see update notifications in their HACS interface.

## Post-Release

1. Monitor GitHub Issues for any problems reported by users
2. Verify the release appears in HACS (may take a few hours)
3. Consider announcing the release in relevant Home Assistant communities

## Hotfix Process

For critical bugs that need immediate fixes:

1. Create a hotfix branch from the release tag
2. Make the minimal changes necessary to fix the issue
3. Follow the release process above with a patch version bump
4. Example: If v1.0.0 has a critical bug, release v1.0.1

## Version History

Track major releases here:

- **v1.0.0** (YYYY-MM-DD): Initial HACS release
  - Full feature set with security hardening
  - Exponential backoff retry logic
  - Persistent toggle states

## Testing a Release Candidate

Before tagging an official release, you can test with a pre-release:

1. Create a tag with `-rc` suffix: `v1.0.0-rc1`
2. Mark it as "Pre-release" on GitHub
3. Test thoroughly
4. If issues found, create `-rc2`, etc.
5. Once stable, create the official release tag

## Rollback Process

If a release has critical issues:

1. Create a new release with a higher version number that reverts the changes
2. Never delete or modify existing releases (breaks HACS installations)
3. Document the rollback in the new release notes
