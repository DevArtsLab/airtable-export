const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SHARE_URL = process.argv[2];
const OUTPUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (!SHARE_URL) {
  console.error("Usage: node export.js <airtable-share-url>");
  console.error(
    "Example: node export.js https://airtable.com/appXXX/shrXXX/tblXXX",
  );
  process.exit(1);
}

async function exportAirtable() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept the readSharedViewData request to capture the full URL (with access policy)
  let capturedUrl = null;
  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("readSharedViewData") &&
      !url.includes("allowMsgpackOfResult")
    ) {
      capturedUrl = url;
    }
  });

  console.log("Navigating to Airtable shared view...");
  await page.goto(SHARE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);

  if (!capturedUrl) {
    console.error("Failed to capture readSharedViewData request URL");
    await browser.close();
    process.exit(1);
  }

  console.log("Captured API URL with access policy");

  // Extract app ID from the URL for the header
  const appIdMatch = capturedUrl.match(
    /applicationId%22%3A%22(app[A-Za-z0-9]+)/,
  );
  const appId = appIdMatch ? appIdMatch[1] : "";

  console.log("Fetching data via internal API...");
  const result = await page.evaluate(
    async ({ url, appId }) => {
      const resp = await fetch(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "x-airtable-application-id": appId,
          "x-airtable-accept-msgpack": "true",
          "x-user-locale": "en",
          "x-airtable-inter-service-client": "webClient",
          "x-time-zone": "America/New_York",
        },
        credentials: "include",
      });

      if (!resp.ok) {
        return { error: `HTTP ${resp.status}` };
      }

      const data = await resp.json();
      const table = data.data.table;

      // Build column ID -> name map
      const colMap = {};
      for (const col of table.columns) {
        colMap[col.id] = col.name;
      }

      // Build select option ID -> name map
      const selectOptions = {};
      for (const col of table.columns) {
        if (col.typeOptions && col.typeOptions.choices) {
          const choices = col.typeOptions.choices;
          if (Array.isArray(choices)) {
            for (const choice of choices) {
              selectOptions[choice.id] = choice.name;
            }
          } else if (typeof choices === "object") {
            for (const choiceId of Object.keys(choices)) {
              const choice = choices[choiceId];
              selectOptions[choiceId] = choice.name || choice;
            }
          }
        }
      }

      // Convert rows to objects with column names
      const records = [];
      for (const row of table.rows) {
        const record = { _id: row.id, _createdTime: row.createdTime };
        const cells = row.cellValuesByColumnId || {};
        for (const colId of Object.keys(cells)) {
          const colName = colMap[colId] || colId;
          let value = cells[colId];

          if (typeof value === "string" && selectOptions[value]) {
            value = selectOptions[value];
          } else if (Array.isArray(value)) {
            value = value
              .map((v) => {
                if (typeof v === "string" && selectOptions[v])
                  return selectOptions[v];
                return typeof v === "object" ? JSON.stringify(v) : String(v);
              })
              .join(", ");
          } else if (typeof value === "object" && value !== null) {
            value = JSON.stringify(value);
          }

          if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            value = value.split("T")[0];
          }

          record[colName] = value;
        }
        records.push(record);
      }

      return { records };
    },
    { url: capturedUrl, appId },
  );

  if (result.error) {
    console.error("Failed to fetch data:", result.error);
    await browser.close();
    process.exit(1);
  }

  const records = result.records;
  console.log(
    `Extracted ${records.length} records with ${Object.keys(records[0]).length} columns`,
  );

  // Derive output filename from page title
  const pageTitle = await page.title();
  const baseName = pageTitle
    .replace(/^Airtable - /, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const outputName = `${baseName}-${records.length}-rows`;

  // Save JSON
  const jsonPath = path.join(OUTPUT_DIR, `${outputName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  console.log(`JSON saved to: ${jsonPath}`);

  await browser.close();
  console.log("Done!");
}

exportAirtable().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
