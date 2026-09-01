# Airtable Public View Exporter

Extract all rows from any Airtable public shared view as JSON - no API key needed.

## How It Works

The script uses Playwright to load the Airtable share page in a headless browser, then calls Airtable's internal `readSharedViewData` API from within the browser context. This inherits the page's cookies and session state, bypassing authentication entirely. The API returns all rows in a single response (no pagination), which are parsed, mapped to column names, and saved as JSON.

## Quick Start

```bash
npm install
npx playwright install chromium
node export.js "https://airtable.com/appXXX/shrXXX/tblXXX"
```

Output is saved to `output/<table-name>-<row-count>-rows.json`.

## Usage

### Single table

```bash
node export.js "https://airtable.com/appXXX/shrXXX/tblXXX"
```

### Multiple tables in one run

```bash
node export.js "https://airtable.com/appXXX/shrXXX/tblXXX" "https://airtable.com/appYYY/shrYYY/tblYYY"
```

Each table is exported sequentially with a summary at the end:

```
=== Summary ===
  OK   https://airtable.com/appXXX/shrXXX/tblXXX -> 520 records
  OK   https://airtable.com/appYYY/shrYYY/tblYYY -> 25 records
```

## Features

- **No API key required** - works with any public share link
- **All rows at once** - no pagination, no clicking through pages
- **Retry logic** - automatically retries up to 3 times on failure
- **Multiple URLs** - batch export several tables in one command
- **Auto-named output** - filenames derived from the Airtable page title and row count
- **Select field resolution** - dropdown/select field IDs are mapped to their human-readable text values
- **Native type preservation** - numbers, booleans, arrays, and objects keep their native JSON types

## Output

Files are written to the `output/` directory (gitignored):

```
output/
  employer-partners-25-rows.json
  job-listings-520-rows.json
```

Each JSON file is an array of record objects with column names as keys:

```json
[
  {
    "_id": "recXXXXX",
    "_createdTime": "2026-08-28",
    "Company Name": "Acme Corp",
    "Status": "Available",
    "Tech Stack": ["Python", "React", "AWS"]
  }
]
```

## Files

| File           | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `export.js`    | Main script - accepts share URLs as CLI args         |
| `skill.md`     | Detailed playbook for agents on how the method works |
| `package.json` | Dependency declaration (Playwright)                  |
| `output/`      | Exported JSON files (gitignored)                     |

## Requirements

- Node.js 18+
- Playwright Chromium browser (auto-installed via `npx playwright install chromium`)
