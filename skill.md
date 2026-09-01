# Scrape Airtable Public Shared View

Scrape all rows from an Airtable public share link (no API key needed) by calling Airtable's internal `readSharedViewData` API from within a Playwright browser context.

## When to Use

- You have an Airtable public share link (URL containing `/shr` in the path)
- You need all rows exported as JSON
- No API key is available
- The view may have hundreds of rows that need robust extraction

## Prerequisites

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

## Steps

### 1. Identify the share link components

From the share URL, extract:

- **Application ID**: `appXXXXXXXXXXXXXX` (from the URL path)
- **Share ID**: `shrXXXXXXXXXXXXXX` (from the URL path)
- **Table ID**: `tblXXXXXXXXXXXXXX` (from the URL path)

Example URL:

```
https://airtable.com/appXXXXXXXXXXXXXX/shrXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX
```

### 2. Navigate to the page with Playwright

Use Playwright to load the share URL in a headless browser. This establishes all cookies and session state automatically.

```javascript
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto(SHARE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000); // let JS hydrate the page
```

### 3. Extract the view ID and access policy from the page

The view ID (`viwXXXXXXXXXXXXXX`) and the access policy JSON (containing `allowedActions`, `shareId`, `applicationId`, `generationNumber`, `expires`, `signature`) are embedded in the page's HTML/JS. You can either:

- Parse them from the page's script tags / `__INITIAL_STATE__`
- Or hardcode them if you are scraping a known link (simpler, but the signature may eventually expire)

To extract dynamically, run in `page.evaluate()`:

```javascript
// The access policy is typically in a script tag or window state
// Look for readSharedViewData in the page source
const html = document.documentElement.outerHTML;
// Search for the accessPolicy JSON and view ID in the HTML
```

### 4. Call the internal API from within the browser

Use `page.evaluate()` to run a `fetch()` inside the browser context. This is the critical step - the request inherits all cookies and session state.

```javascript
const result = await page.evaluate(async () => {
  const url =
    "https://airtable.com/v0.3/view/{VIEW_ID}/readSharedViewData" +
    "?stringifiedObjectParams=%7B%22shouldUseNestedResponseFormat%22%3Atrue%7D" +
    "&requestId=reqPlaceholder" +
    "&accessPolicy={URL_ENCODED_ACCESS_POLICY_JSON}";

  const resp = await fetch(url, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "x-airtable-application-id": "{APP_ID}",
      "x-airtable-accept-msgpack": "true",
      "x-user-locale": "en",
      "x-airtable-inter-service-client": "webClient",
      "x-time-zone": "America/New_York", // REQUIRED - without this, 400 error
    },
    credentials: "include",
  });

  const data = await resp.json();
  return data;
});
```

**Critical headers** (all required):

- `x-airtable-application-id` - the app ID from the URL
- `x-time-zone` - any valid timezone string (e.g., `America/New_York`)
- `x-airtable-inter-service-client` - must be `webClient`
- `x-user-locale` - `en`
- `X-Requested-With` - `XMLHttpRequest`
- `credentials: 'include'` - sends cookies with the request

### 5. Parse the response

The response structure is:

```
data.data.table.columns  -> array of column definitions
data.data.table.rows     -> array of row objects
```

Each column has:

- `id` - column ID (used in row cell values)
- `name` - human-readable column name
- `type` - field type (text, select, date, etc.)
- `typeOptions.choices` - for select fields, maps option IDs to names (may be array or object)

Each row has:

- `id` - record ID
- `createdTime` - creation timestamp
- `cellValuesByColumnId` - object mapping column IDs to cell values

### 6. Map cell values to column names

```javascript
// Build column ID -> name map
const colMap = {};
for (const col of table.columns) {
  colMap[col.id] = col.name;
}

// Build select option ID -> name map
const selectOptions = {};
for (const col of table.columns) {
  if (col.typeOptions?.choices) {
    const choices = col.typeOptions.choices;
    if (Array.isArray(choices)) {
      choices.forEach((c) => (selectOptions[c.id] = c.name));
    } else {
      Object.keys(choices).forEach(
        (id) => (selectOptions[id] = choices[id].name || choices[id]),
      );
    }
  }
}

// Convert rows
const records = table.rows.map((row) => {
  const record = { _id: row.id, _createdTime: row.createdTime };
  const cells = row.cellValuesByColumnId || {};
  for (const [colId, value] of Object.entries(cells)) {
    let val = value;
    if (typeof val === "string" && selectOptions[val]) {
      val = selectOptions[val];
    } else if (Array.isArray(val)) {
      val = val
        .map(
          (v) =>
            selectOptions[v] ||
            (typeof v === "object" ? JSON.stringify(v) : String(v)),
        )
        .join(", ");
    } else if (typeof val === "object" && val !== null) {
      val = JSON.stringify(val);
    }
    record[colMap[colId] || colId] = val;
  }
  return record;
});
```

### 7. Export to JSON

```javascript
const fs = require("fs");
fs.writeFileSync("export.json", JSON.stringify(records, null, 2));
```

## Why This Method Works

1. **No API key needed** - the public share link contains a signed access policy with an embedded signature that grants read access
2. **No authentication headaches** - Playwright loads the real page, establishing cookies and session state. The `fetch()` call runs inside the browser, inheriting all of this
3. **All rows at once** - `readSharedViewData` returns the complete dataset, not just the visible page. No pagination needed
4. **JSON response** - despite `x-airtable-accept-msgpack: true` header, the browser's fetch negotiates a JSON response (msgpack is only used when the request comes from Airtable's own XHR interceptor)
5. **Select fields resolved** - the column definitions include choice mappings, so select field IDs can be converted to human-readable text

## Common Pitfalls

- **Missing `x-time-zone` header** -> 400 BAD_REQUEST. Always include it.
- **Fetching from Node.js directly** -> 401 Unauthorized. Must fetch from within the browser context.
- **Msgpack decoding** -> unnecessary complexity. The browser fetch returns JSON directly.
- **`typeOptions.choices` format** -> can be either an array or an object. Handle both.
- **Access policy signature expiry** -> the signature has an `expires` field. If it expires, re-navigate to the share URL to get a fresh one.

## Reference Script

A complete working script (`export.js`) was developed alongside this skill. It accepts any Airtable share URL as a CLI argument and auto-names output files based on the page title. Outputs are written to an `output/` subdirectory to keep them separate from core app files.

Usage:

```bash
node export.js "https://airtable.com/appXXX/shrXXX/tblXXX"
```
