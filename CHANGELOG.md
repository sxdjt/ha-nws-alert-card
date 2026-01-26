# Changelog

All notable changes to the NWS Alert Card will be documented in this file.

## [Unreleased]

## [2.5.1] - 2026-01-25

### Fixed
- Alert display order now matches official NWS priority (fixes #7, thanks @tmcb82)
  - Previously alerts were displayed in API response order rather than NWS priority
  - Now uses the same priority sorting as the alert entity integration

## [2.5.0] - 2026-01-24

### Added
- Customizable font sizes for card elements (closes #6)
  - `title_font_size` - Card title font size in pixels (default: 20)
  - `alert_title_font_size` - Alert event name font size in pixels (default: 16)
  - `meta_font_size` - Alert metadata (time range, severity/urgency) font size in pixels (default: 14)
  - `description_font_size` - Alert description font size in pixels (default: 14)
  - All font sizes accept values 8-48 pixels
  - Visual editor includes new "Font Sizes" section

## [2.4.0] - 2026-01-24

### Added
- **Alert entity integration** for automations and conditional cards (closes #2)
  - `alert_entity` configuration option to store alerts in an input_text helper
  - Alerts sorted by official NWS priority order (111 alert types, Tsunami Warning highest)
  - Data format: comma-separated `EventType:Severity` pairs
  - New [Alerts.md](Alerts.md) documentation with setup instructions and automation examples
- **Visual configuration editor** for the Home Assistant UI
  - Editor organized into 5 collapsible sections: Basic Settings, Display Options, Location, Alert Entity Integration, and Action Triggers
  - Entity pickers with domain filtering (input_text for alert entity, script/automation for actions)
  - Helper text for all configuration fields

## [2.3.1] - 2026-01-22

### Fixed
- Alert end times now display correctly using the `ends` field instead of `expires` field from NWS API. The `expires` field indicates when the alert message expires, while `ends` indicates when the weather event ends (matching NWS website display). Falls back to `expires` if `ends` is not available. Closes issue #4.

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

[Unreleased]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.5.1...HEAD
[2.5.1]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/sxdjt/ha-nws-alert-card/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v2.0.0
[1.0.0]: https://github.com/sxdjt/ha-nws-alert-card/releases/tag/v1.0.0
