# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-06-21

### Fixed
- SECURITY.md: Updated repository references from anomalyco/opencode to vlgalib/hiai-bob
- CONTRIBUTING.md: Updated repository and issue tracker URLs to vlgalib/hiai-bob
- bob.env: Removed live API keys, replaced with placeholder values for security
- bob.env.example: Consistent placeholder template matching bob.env

### Security
- packages/opencode/Dockerfile: Added non-root USER directive, pinned Alpine base image to 3.21
- packages/opencode/.dockerignore: Created to exclude unnecessary files from build context

### Added
- .github/workflows/typecheck.yml: Renamed to CI, added test and build jobs
- CHANGELOG.md: Created this changelog

### Changed
- .github/ISSUE_TEMPLATE/bug-report.yml: Replaced OpenCode version field with hiai-bob version
- script/raw-changelog.ts, stats.ts, close-issues.ts: Updated default repo references to vlgalib/hiai-bob
- docs/build-release.md: Verified all URLs use vlgalib/hiai-bob (no stale references found)
