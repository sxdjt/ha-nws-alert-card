# Changelog

All notable changes to the NWS Alert Card will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2026-01-07

### Added
- Severity-based action triggers to execute scripts/automations on alerts
- `minor_action`, `moderate_action`, `severe_action`, `extreme_action` configuration options
- Actions trigger when new alerts appear or severity increases
- Only highest severity action triggers (not all levels)
- `alert_trigger_cooldown` configuration option (default: 60 minutes)
- Cooldown protection prevents repeated triggers on page reload
- localStorage-based cooldown tracking persists across browser sessions
- Per-zone cooldown tracking for multi-card support
- Queue management prevents concurrent action execution
- Comprehensive logging for trigger decisions and cooldown status
- Closes issue #3

## [2.2.0] - 2026-01-06

### Added
- `show_expanded` configuration option to display alert descriptions expanded by default (thanks to @christopherdopp for the idea)
- Support for individual alert toggling regardless of default expanded state
- `_collapsedAlerts` state tracking for expanded-by-default mode

## [2.1.0] - 2026-01-06

### Added
- Dynamic location support with automatic geolocation for mobile devices
- `latitude` and `longitude` configuration options (number or entity ID)
- `mobile_latitude` and `mobile_longitude` configuration options for mobile-specific locations
- Automatic coordinate-to-zone conversion using NWS Points API
- Entity-based location tracking (device_tracker support)
- Mobile device detection (Home Assistant Companion app, mobile user agents, screen width)
- 24-hour coordinate-to-zone caching with LRU eviction (10 entry limit)
- Debounced zone re-resolution (5-second delay) for entity state changes
- Configuration precedence system: mobile lat/lon > base lat/lon > nws_zone fallback

### Changed
- `nws_zone` is now optional if lat/lon coordinates are provided
- `nws_zone` now acts as a fallback when coordinate resolution fails
- Improved configuration validation for mixed zone/coordinate configurations

## [2.0.1] - 2025-12-22

### Fixed
- Alert description text wrapping for natural flow - NWS API returns descriptions with hard line breaks every 67-69 characters; updated text normalization to convert single line breaks to spaces while preserving paragraph separators (double line breaks), allowing text to wrap naturally at card width

### Changed
- Updated CSS white-space property from pre-wrap to pre-line to support natural text wrapping

## [2.0.0] - 2024-11-24

### Added
- Initial HACS support with `hacs.json`, `info.md`, and validation workflow
- RELEASE.md documentation for the release process

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

[Unreleased]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v2.0.0
[1.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v1.0.0
