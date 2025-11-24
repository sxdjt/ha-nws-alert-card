# Changelog

All notable changes to the NWS Alert Card will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial HACS support with `hacs.json`, `info.md`, and validation workflow
- RELEASE.md documentation for the release process

## [2.0.0] - 2024-11-24

### Added
- Zone name display under card title for better context
- Alert description normalization for consistent formatting
- Alert caching mechanism to preserve toggle states across updates
- Comprehensive CLAUDE.md documentation for AI-assisted development
- Set-based alert comparison for efficient change detection
- Event delegation pattern for memory-efficient event handling
- Exponential backoff retry logic (max 3 attempts, 5s base delay)
- 10-second fetch timeout via AbortSignal
- "Show more/less" toggle for long descriptions (>200 chars)
- ARIA labels and keyboard navigation support
- Configuration constants (MAX_RETRIES, BASE_RETRY_DELAY, DESCRIPTION_THRESHOLD)

### Changed
- Improved security with email sanitization and XSS protection
- Enhanced rendering to preserve expanded/collapsed state during updates
- Better date formatting with shorter month names
- Improved error handling and validation
- Optimized re-rendering to only update when alerts change
- Updated README with comprehensive documentation

### Fixed
- Toggle state persistence across updates
- Memory leaks from repeated event listener creation
- Proper handling of "no alerts" state
- Zone format validation

### Security
- Added HTML escaping for all user-facing text (XSS protection)
- Email input sanitization prevents header injection
- External links use `rel="noopener noreferrer"`

## [1.0.0] - Initial Release

### Added
- Initial implementation of NWS Alert Card
- Real-time weather alerts from NWS API
- Severity-based color coding
- Expandable alert descriptions
- Configurable update interval
- Manual and HACS installation support

---

## Release Types

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

## Links

[Unreleased]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v2.0.0
[1.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v1.0.0
