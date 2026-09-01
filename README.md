# Airtable Public View Exporter

Extract all rows from any Airtable public shared view as JSON - no API key needed.

## How It Works

The script uses Playwright to load the Airtable share page in a headless browser, then calls Airtable's internal `readSharedViewData` API from within the browser context. This inherits the page's cookies and session state, bypassing authentication entirely. The API returns all rows in a single response (no pagination), which are parsed, mapped to column names, and saved as JSON.

## Quick Start

```bash
./setup.sh
node export.js "https://airtable.com/appXXX/shrXXX/tblXXX"
```

Output is saved to `objects/<org-abbr>-<full-title>.json`.

## Usage

```bash
node export.js [--merge] [--output <dir>] <url1> [url2] ...
```

- `--merge` - Append only new records to existing output (by `_id`)
- `--output <dir>` - Write JSON to a custom directory (default: `./objects`)

See `CHANGELOG.md` for the full list of features and recent updates.

## Features

- No API key required
- All rows at once (no pagination)
- Retry logic (3 attempts)
- Multiple URLs in one run
- Auto-named output files
- Select field resolution
- Native type preservation
- Rich text flattening
- Merge mode for incremental updates
- Custom output directory
- Source origin metadata
- Progress logging
- Per-source field exclusion via `orgs.json`
- Collapsed output objects to single lines

## Git Submodule

Use this repo as a submodule in other projects to export Airtable data directly into the parent repo:

```bash
git submodule add <this-repo-url> airtable-export
cd airtable-export && ./setup.sh && cd ..
node airtable-export/export.js --output ./data "https://airtable.com/appXXX/shrXXX/tblXXX"
```

## Output

Files are written to the `objects/` directory:

```
objects/
  ctd-employer-partners-apprentice-facing.json
  ctd-job-listings-public.json
```

Filenames are derived from the Airtable page title (all segments slugged with dashes) prefixed by the org abbreviation from `orgs.json`. The config maps Airtable app IDs to org info. Example: page title `"Airtable - Employer Partners - Apprentice Facing"` with org `CTD` produces `ctd-employer-partners-apprentice-facing.json`.

Each JSON file contains a `_meta` block with source origin info, followed by a `records` array.

## Files

| File              | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `export.js`       | Main script - accepts share URLs as CLI args                         |
| `setup.sh`        | One-command install (npm + playwright)                               |
| `ARCHITECTURE.md` | Pipeline design for orchestrator-based usage                         |
| `skill.md`        | Detailed playbook for agents on how the method works                 |
| `CHANGELOG.md`    | Version history and feature updates                                  |
| `package.json`    | Dependency declaration (Playwright)                                  |
| `orgs.json`       | Maps Airtable app IDs to org name, abbreviation, and excluded fields |
| `objects/`        | Exported JSON files (git-tracked)                                    |

## Requirements

- Node.js 18+
- Playwright Chromium browser (auto-installed via `npx playwright install chromium`)
