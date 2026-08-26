# Storage — Notion

**All Gym Coach state lives in Notion. There is no local fallback and no degraded
mode.** The point of the system is that the log is reachable from a phone in the gym,
a laptop at home, and any Claude surface. A local file cannot do that.

---

## 1. The prerequisite check

**Every skill runs this first, before anything else.**

1. Call `notion-fetch` with `id: "self"`. It returns the workspace name, the user
   identity, and a `current_tool_access` map — everything needed to decide whether the
   connector is usable, in one call. **This is the probe to use.**
2. If the Notion tools are absent from the session, or the call fails with an auth or
   connection error, print the message below **verbatim** and **stop**.

`current_tool_access` is worth reading rather than ignoring. On free and Plus plans
`query_data_sources` comes back as `available_with_limit` — SQL still works, but it is
subject to a shared workspace usage limit and **cannot query multiple data sources in
one call**. Query one data source at a time (this repo never needs more), and if SQL is
refused outright, fall back to `notion-fetch` on the database and read its rows from the
returned page. Do not tell the user to upgrade Notion — the system works on the free
plan.

```
Gym Coach stores everything in Notion, and the Notion connector isn't
connected to this session yet.

To connect it:
  Claude Code  →  /mcp, then add the Notion server
  Cowork/app   →  the "+" button → Connectors → enable Notion

You'll be asked to authorise access to your Notion workspace.
Once it's connected, run /gym-coach:setup again and I'll build
everything for you.
```

**No workaround. No partial setup. No offering to "just plan something for now".**
Do not create files, do not draft a block, do not ask follow-up questions. Stop.

> For skills other than `setup`, the last line reads *"Once it's connected, run this
> command again."* Everything else is identical.

---

## 2. The config file

One file: `${CLAUDE_PLUGIN_DATA}/gym-coach.config.json`.

`${CLAUDE_PLUGIN_DATA}` resolves to a per-plugin directory under
`~/.claude/plugins/data/` that persists across plugin updates. If it does not resolve
in the current environment, fall back to `~/.gym-coach/config.json` and say which path
was used.

> **The directory does not exist until something writes to it.** `~/.claude/plugins/data/`
> is created lazily, so `setup` must create the path (`mkdir -p`) before writing the
> config. Verified on a clean install: the directory was absent.

```json
{
  "version": 1,
  "units": "metric",
  "createdAt": "2026-08-21",
  "notion": {
    "parentPageId": "…",
    "gymLogDataSourceId": "…",
    "blocksDataSourceId": "…",
    "bodyMetricsDataSourceId": "…",
    "operatingManualPageId": "…"
  }
}
```

It stores **pointers and preferences only**. No training data, no personal facts.
Everything about the athlete lives in Notion.

`units` is `metric` or `imperial` and controls display everywhere.

> **Store the unit alongside every number. Never write a bare figure.** `90 lb`, not
> `90`. A weight without a unit in a log is unrecoverable a year later.

### The rule every skill obeys

**Check Notion → read the config → if the config is missing, tell the user to run
`/gym-coach:setup` and stop.**

> **Never improvise an ID. Never re-derive IDs by searching Notion at runtime.**
> Notion search is fuzzy. Given two workspaces, an old archived copy, or a
> similarly-named page, it will eventually write a session into the wrong database and
> nobody will notice for a month.

**Recovery copy.** Because the config is the only pointer to the data, `setup` also
writes all five IDs in plain text into the **Coach Operating Manual** page, under a
"Recovery" heading. If the config is ever lost, the user can find that page by hand
and `setup`'s repair path can rebuild the config from it.

---

## 3. What setup provisions

Under a parent page the user picks: **three databases and one page.**

| Object | Type | Purpose |
|---|---|---|
| Gym Log | Database | One page per session. The exercise table lives in the page body |
| Training Blocks | Database | One page per block. The plan lives in the page body |
| Body Metrics | Database | One row per weigh-in |
| Coach Operating Manual | Plain page | Profile, rules, medical status, recovery IDs |

Every returned data-source ID goes straight into the config.

> **If provisioning fails partway, delete what was created and report the failure.**
> A half-provisioned workspace is the worst outcome — worse than no workspace, because
> the next run will find some of it and assume the rest exists. Track every object you
> create in the order you create it, and unwind in reverse on any error.

---

## 4. Schemas

`notion-create-database` takes SQL DDL. Create each database with `parent` set to the
user's chosen page.

### Gym Log

```sql
CREATE TABLE (
  "Session" TITLE,
  "Date" DATE,
  "Session Type" SELECT('Upper':blue, 'Lower':orange, 'Full Body':green, 'Other':gray),
  "Duration (min)" NUMBER,
  "Calories" NUMBER,
  "Avg HR" NUMBER,
  "Peak HR" NUMBER,
  "Effort (1-10)" NUMBER,
  "Pain Status" RICH_TEXT,
  "Coach Notes" RICH_TEXT
)
```

**The exercise table goes in the page body, not in properties.** Notion properties
cannot represent a variable-length list of exercises, and trying to force it produces
a schema nobody can read.

### Training Blocks

```sql
CREATE TABLE (
  "Block" TITLE,
  "Status" SELECT('Active':green, 'Planned':blue, 'Archived':gray),
  "Start Date" DATE,
  "Adjustments" RICH_TEXT
)
```

`Start Date` is a date range — set the end date to the planned end of the block.
The full plan lives in the page body.

> **Exactly one block may be `Active` at a time.** `Planned` exists so a future block
> can be drafted without competing with the active one. Before setting a block Active,
> query for any existing Active block and set it to Archived in the same operation.

### Body Metrics

```sql
CREATE TABLE (
  "Entry" TITLE,
  "Date" DATE,
  "Weight" NUMBER,
  "Photos Taken" CHECKBOX,
  "Waistband Check" SELECT('Looser':green, 'Same':gray, 'Tighter':orange, 'Not checked':default),
  "Notes" RICH_TEXT
)
```

### Coach Operating Manual

A plain page, not a database. Created with `notion-create-pages` using a `page_id`
parent and a `title` property.

---

## 5. Gym Log page-body format

**Specify this precisely, because reading it back is how progression works.** A
session written in a different shape is a session `today` cannot compute from.

```markdown
| Exercise | Sets | Reps | Weight | Notes |
|---|---|---|---|---|
| Lat Pulldown (wide) | 3 | 10 | 90 lb | ↑ from 85 |
| Seated Cable Row | 3 | 10 | 95 lb | ↑ from 85 |

**Progressed:** lat pulldown 85→90, seated row 85→95
**Stalled:** none
**Skipped:** shrug — machine occupied (equipment, not fatigue)
**Micro-goal:** get the shrug in next Day 2
```

### Invariants

- **Dates are ISO** — `2026-08-19`, never `19/08` or `Aug 19`.
- **Every weight carries its unit.** `90 lb` or `41 kg`. Never a bare number.
- **The exercise name is written identically every time.** `Lat Pulldown (wide)` is a
  different lift from `Lat Pulldown` for progression purposes, and inconsistent naming
  silently breaks the history lookup. Copy the name from the block, character for
  character.
- **The skip reason is always categorised** as one of: `time` · `crowding` ·
  `equipment` · `fatigue` · `pain` · `choice`. The category goes in parentheses.
- Per-set variation goes in the Notes column: `3 | 10,10,8 | 90 lb | last set short`.
- The four summary lines — **Progressed / Stalled / Skipped / Micro-goal** — are
  mandatory. They are what `checkin` and `audit` read first.

`Session` (the title) is formatted `YYYY-MM-DD — Day N NAME`, e.g.
`2026-08-19 — Day 2 BACK`. That makes the rotation day recoverable from the title
alone, which is what lets `today` find "the last time I did this day" cheaply.

---

## 6. Querying

Use `notion-query-data-sources` in SQL mode. Table names are the data source URLs,
`collection://<data_source_id>`, built from the IDs in the config.

> ## 🚨 A date property is not queryable by its own name
>
> A `DATE` property called `Date` **does not exist as a column called `"Date"`.** It
> expands into three columns:
>
> ```
> "date:Date:start"        TEXT   ISO-8601 date or datetime
> "date:Date:end"          TEXT   NULL unless it is a range
> "date:Date:is_datetime"  INTEGER
> ```
>
> `ORDER BY date("Date")` fails outright:
> `no such column: "Date" - should this be a string literal in single-quotes?`
>
> **Always use `"date:Date:start"`.** The same applies to `"date:Start Date:start"` on
> the Training Blocks database. This is verified behaviour, not a guess — the naive form
> was tested and it errors every time.

**Most recent session:**

```sql
SELECT "Session", "date:Date:start", "Duration (min)"
FROM "collection://<gymLogDataSourceId>"
ORDER BY date("date:Date:start") DESC
LIMIT 1
```

**Last session for a specific rotation day** — how `today` finds the history it needs.
This is why the title carries `Day N`:

```sql
SELECT "Session", "date:Date:start"
FROM "collection://<gymLogDataSourceId>"
WHERE "Session" LIKE ?
ORDER BY date("date:Date:start") DESC
LIMIT 1
```
with `params: ["%Day 2%"]`.

**The active block:**

```sql
SELECT "Block", "Status", "date:Start Date:start"
FROM "collection://<blocksDataSourceId>"
WHERE "Status" = ?
LIMIT 1
```
with `params: ["Active"]`.

**Trailing 4 weeks, for `block` and `audit`:**

```sql
SELECT * FROM "collection://<gymLogDataSourceId>"
WHERE date("date:Date:start") >= date(?)
ORDER BY date("date:Date:start") DESC
```
with `params: ["2026-07-25"]`.

**Body metrics for the rolling average:**

```sql
SELECT "date:Date:start", "Weight", "Waistband Check"
FROM "collection://<bodyMetricsDataSourceId>"
ORDER BY date("date:Date:start") DESC
LIMIT 30
```

**Query one data source per call.** Multi-source queries are unavailable on free and
Plus plans, and nothing in this repo needs them.

The `url` column returned by every query is the page URL — pass it to `notion-fetch` to
read that page's body.

### Read discipline

| Skill | Reads |
|---|---|
| `today` | The active block, the most recent entry, and the last entry for this rotation day. **Nothing else.** |
| `log` | The active block, and the last entry for this rotation day |
| `checkin` | The trailing ~4 weeks, plus recent body metrics |
| `block` | Everything since the last block |
| `audit` | Everything |

**`today` must stay fast — the athlete is standing in a gym.** Pulling the whole
history there is the single easiest way to make this system annoying enough to abandon.

Queries return properties. **The exercise tables are in page bodies**, so fetch the
specific page with `notion-fetch` to read the exercise rows. Query first to find
*which* page, then fetch exactly that one.

---

## 7. Writing

**Property values follow the same expanded naming as queries**, and two types need a
specific form:

| Property type | Write it as |
|---|---|
| Date | `"date:Date:start": "2026-08-26"` — and `"date:Date:end"` only for a range |
| Checkbox | `"Photos Taken": "__YES__"` or `"__NO__"` — not `true`/`false` |
| Number | a JSON number, not a string |
| Select | the exact option name, e.g. `"Session Type": "Upper"` |

- **New session:** `notion-create-pages` with `parent: { data_source_id: <gymLogDataSourceId> }`,
  properties per the schema, and the section-5 body as `content`.
- **New block:** same, with `parent: { data_source_id: <blocksDataSourceId> }`.
- **Archiving a block:** `notion-update-page` to set `Status` to `Archived`. **Never
  delete a block.** History is the entire product.
- **Body metrics:** `notion-create-pages` against the body metrics data source.
- **Operating manual edits:** `notion-update-page` on `operatingManualPageId`.

Page content is **Notion-flavoured Markdown**. If you are unsure of the syntax for a
construct, read the MCP resource `notion://docs/enhanced-markdown-spec` rather than
guessing — a malformed body is a session that cannot be read back.

**Append, never overwrite.** A log entry is a new page every time. The only thing ever
updated in place is the operating manual and a block's `Status`.

---

## 8. Tool-name drift

The Notion connector's tool names have moved before and may move again. The names used
here — `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-create-database`,
`notion-update-page`, `notion-query-data-sources`, `notion-get-users` — are the current
ones.

If a name does not resolve, **look at the Notion tools actually available in the
session and use the equivalent**. Do not fall back to a local file, and do not invent
an ID. If no Notion tool can create a database, that is the section-1 failure case:
print the connection message and stop.
