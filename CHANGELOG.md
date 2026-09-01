# Changelog

## [1.2.0] - 2026-08-31

- Added `--merge` flag to append only new records to existing output (by `_id` comparison)
- Added `_meta` block to output JSON (sourceUrl, exportedAt, rowCount, columnCount)
- Added retry logic (3 attempts with 3s delay)
- Added support for multiple URLs in a single run
- Added progress logging during parsing
- Preserved native JSON types (arrays, objects) instead of stringifying
- Added summary output showing per-table results and new record counts

## [1.1.0] - 2026-08-31

- Made script fully generic - accepts any share URL as CLI argument
- Auto-captures access policy via network request interception (no more hardcoded URLs)
- Auto-names output files based on Airtable page title + row count
- Added `output/` subdirectory to separate exports from app files
- Removed CSV output (JSON only)
- Added `skill.md` playbook for agents

## [1.0.0] - 2026-08-31

- Initial working version
- Extracts all rows from Airtable public shared views via internal `readSharedViewData` API
- Uses Playwright to load page and fetch from browser context (bypasses authentication)
- Maps cell values to column names, resolves select field IDs to text
- Outputs JSON and CSV
