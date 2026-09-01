# Architecture: End-to-End Automation Pipeline

## Overview

The orchestrator repo coordinates multiple sibling repos as submodules. Each repo is a node in the workflow - it receives input, performs work, and produces output for the next node.

```
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrator Repo                        │
│                                                              │
│   Coordinates sibling repos as submodules                    │
│   Passes data between nodes via shared directories           │
│                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│   │ airtable-    │   │ career-      │   │ resume-      │    │
│   │ export       │   │ agent        │   │ tailor       │    │
│   │              │   │              │   │              │    │
│   │ extracts     │   │ answers Qs   │   │ tailors      │    │
│   │ Airtable     │   │ recommends   │   │ resumes      │    │
│   │ data         │   │ searches     │   │ cover letters│    │
│   └──────┬───────┘   └──────▲───────┘   └──────▲───────┘    │
│          │                  │                  │            │
│          ▼                  │                  │            │
│   ┌─────────────┐    ┌──────┴──────┐   ┌──────┴──────┐     │
│   │ data/       │───▶│ job-matcher │   │ output/     │     │
│   │ *.json      │    │             │   │ *.json      │     │
│   └─────────────┘    └──────┬──────┘   └─────────────┘     │
│                             │                               │
│                             ▼                               │
│                      ┌─────────────┐                        │
│                      │ output/     │                        │
│                      │ matches     │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Node Topology

```
                      ┌──────────────┐
                      │   Airtable   │
                      │   (source)   │
                      └──────┬───────┘
                             │ share URLs
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    Orchestrator                          │
  │                                                         │
  │  ┌─────────────┐  feeds URLs  ┌─────────────────┐       │
  │  │ config      │─────────────▶│ airtable-export │       │
  │  │             │              │                 │       │
  │  │ - URLs      │              │ - Playwright    │       │
  │  │ - schedule  │              │ - JSON output   │       │
  │  │ - workflows │              │                 │       │
  │  └─────────────┘              └────────┬────────┘       │
  │                                        │                │
  │                               data/*.json               │
  │                                        │                │
  │          ┌─────────────────────────────┼──────────┐     │
  │          │                             │          │     │
  │          ▼                             ▼          ▼     │
  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐    │
  │  │ career-     │  │ job-        │  │ resume-      │    │
  │  │ agent       │  │ matcher     │  │ tailor       │    │
  │  │             │  │             │  │              │    │
  │  │ - Q&A       │  │ - skill     │  │ - resume     │    │
  │  │ - search    │  │   matching  │  │   tailoring  │    │
  │  │ - recommend │  │ - ranking   │  │ - cover      │    │
  │  └──────┬──────┘  └──────┬──────┘  │   letters    │    │
  │         │                │         └──────┬───────┘    │
  │         └────────┬───────┴─────────────────┘            │
  │                  ▼                                      │
  │         ┌───────────────┐                               │
  │         │ output/*.json │                               │
  │         └───────┬───────┘                               │
  │                 ▼                                       │
  │         ┌───────────────┐                               │
  │         │ notification  │                               │
  │         │ - Slack       │                               │
  │         │ - email       │                               │
  │         │ - reports     │                               │
  │         └───────────────┘                               │
  └─────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Airtable
  │
  │ share URLs
  ▼
┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│ config       │─────▶│ airtable-export│─────▶│ data/        │
│              │      │                │      │              │
│ urls.json    │      │ export.js      │      │ ctd-employer-│
│ schedule.json│      │ --output ./data│      │ partners-    │
│              │      │ --merge        │      │ apprentice-  │
│              │      │                │      │ facing.json  │
│              │      │                │      │ ctd-job-     │
│              │      │                │      │ listings-    │
│              │      │                │      │ public.json  │
└──────────────┘      └────────────────┘      └──────┬───────┘
                                                      │
                    ┌─────────────────────────────────┼────┐
                    │                                 │    │
                    ▼                                 ▼    ▼
             ┌────────────┐               ┌────────────┐ ┌────────────┐
             │ agent      │               │ matcher    │ │ tailor     │
             │            │               │            │ │            │
             │ reads      │               │ reads      │ │ reads      │
             │ data/      │               │ data/      │ │ data/      │
             │            │               │            │ │            │
             │ writes     │               │ writes     │ │ writes     │
             │ output/    │               │ output/    │ │ output/    │
             └────────────┘               └────────────┘ └────────────┘
```

---

## Orchestrator Structure

```
orchestrator/
├── package.json
├── workflows/
│   ├── export-and-match.json
│   └── full-pipeline.json
├── data/                          # shared data between nodes
│   ├── ctd-employer-partners-apprentice-facing.json
│   └── ctd-job-listings-public.json
├── output/                        # results from consumer nodes
│   ├── matches/
│   ├── recommendations/
│   └── tailored-resumes/
└── submodules/
    ├── airtable-export/           # extraction node
    ├── career-agent/              # agent node
    ├── job-matcher/               # matching node
    ├── resume-tailor/             # resume node
    └── config/                    # config node (URLs, schedules)
```

---

## Workflow Example

```
[config]
   │ urls
   ▼
[airtable-export]
   │ data/*.json
   ▼
[job-matcher]
   │ matches.json
   ├──────────────────┐
   ▼                  ▼
[resume-tailor]   [career-agent]
   │                  │
   ▼                  ▼
tailored-resumes  recommendations
   │                  │
   └────────┬─────────┘
            ▼
      [notification]
            │
            ▼
       Slack / email
```

---

## Each Repo Is a Node

| Node            | Input                     | Output                         |
| --------------- | ------------------------- | ------------------------------ |
| config          | manual edits              | urls.json, schedule.json       |
| airtable-export | share URLs                | objects/\*.json (org-prefixed) |
| career-agent    | data/\*.json + user query | recommendations.json           |
| job-matcher     | data/\*.json + skills     | matches.json                   |
| resume-tailor   | data/\*.json + resume     | tailored-resumes/\*.json       |
| notification    | output/\*.json            | Slack messages, emails         |

---

## Suggested Orchestrator npm Scripts

```json
{
  "scripts": {
    "setup": "git submodule update --init --recursive && for d in submodules/*/; do (cd \"$d\" && ./setup.sh); done",
    "export": "node submodules/airtable-export/export.js --output ./data --merge $(cat submodules/config/urls.json)",
    "match": "node submodules/job-matcher/index.js --input ./data --output ./output/matches",
    "tailor": "node submodules/resume-tailor/index.js --input ./output/matches --output ./output/tailored-resumes",
    "pipeline": "npm run export && npm run match && npm run tailor"
  }
}
```

```bash
npm run pipeline
```

---

## Merge Mode for Ongoing Sync

```
First run        data/ctd-job-listings-public.json  (520 records)
                 ──────────────────────────────────────────────
Airtable update  +3 new rows added

Second run       Merge detects 3 new _ids
                 data/ctd-job-listings-public.json  (523 records, 3 new)
                 ──────────────────────────────────────────────
Airtable update  2 rows removed, 1 added

Third run        Full refresh (no --merge) to catch deletions
                 OR merge to only track additions
```

Use `--merge` for additive tracking. Drop `--merge` for full refreshes when deletions matter.
