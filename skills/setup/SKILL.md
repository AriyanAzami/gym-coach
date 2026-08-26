---
name: setup
description: First-run setup for Gym Coach — onboarding interview, storage provisioning, and your first training block. Use when the user says set up gym coach, start gym coach, or has no existing gym-coach config.
argument-hint: "[repair]"
allowed-tools: Read Write Edit Bash
effort: high
---

# Gym Coach — setup

Before anything else, load:

- `${CLAUDE_PLUGIN_ROOT}/references/safety.md`
- `${CLAUDE_PLUGIN_ROOT}/references/storage-notion.md`
- `${CLAUDE_PLUGIN_ROOT}/references/programming.md`

---

## Step 0 — the Notion prerequisite check

**Run this first. If it fails, stop here and do nothing else.**

Call `notion-fetch` with `id: "self"` — it returns the workspace identity and the
connector's tool-access map in one call.
If the Notion tools are absent from the session, or the call fails, print this
**verbatim** and stop:

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
Do not run the interview. Do not write a file. Stop.

---

## Step 0.5 — idempotency

Read `${CLAUDE_PLUGIN_DATA}/gym-coach.config.json` (fallback `~/.gym-coach/config.json`).

**If a config already exists, say so and offer exactly three choices. Never clobber.**

```
You already have Gym Coach set up — your workspace is at <link>, created 2026-08-21.

  1. Update your profile      — change goals, schedule, equipment, constraints
  2. Repair a broken link     — re-find the databases under your parent page
  3. Start fresh somewhere new — build a second workspace in a different Notion page

Which one? (Nothing is deleted in any case.)
```

- **Update the profile** — re-run only the relevant interview rounds, rewrite the
  operating manual, leave all IDs and all data untouched.
- **Repair** — read the Recovery block on the Coach Operating Manual page for the IDs.
  If that page is gone, list the databases directly under `parentPageId`, match them by
  name **and by schema shape**, and confirm each match with the user before writing it
  to the config. Never accept a fuzzy search result silently.
- **Start fresh** — require explicit confirmation, then provision a new workspace.
  **Never delete the old one.** Say plainly that the old workspace and all its history
  are still in Notion and are the user's to remove if they want to.

If no config exists, continue.

---

## The onboarding interview

**Five rounds, batched. Ask several questions per message, not one at a time.** An
interview that takes twenty messages does not get finished.

Open by saying what this will take (about five minutes) and what it produces (three
Notion databases and a coaching manual, built automatically).

### Round 1 — basics

Name or what to call them · age · height · weight · **metric or imperial** · when they
started training, or "beginner".

> If age is under 18: do not refuse. State that this programming assumes an adult,
> recommend involving a parent or guardian plus a coach or physician, and keep loads
> conservative throughout. No calorie deficits. (`safety.md` §4.)

### Round 2 — goal, then a ranking

Ask the goal in their own words first. Then **force a ranking of priority muscles.**

> "Broad shoulders" is not a program. `side delts > rear delts > traps > lats` is.

If they cannot rank, force a choice: *"If only one of these grew this year, which one?"*
Then build the rest of the order around it.

**Store the ranking. It drives exercise ordering forever**, until they change it.

### Round 3 — schedule and time budget

**These four numbers determine exercise count arithmetically** (`programming.md` §1).
Ask all four, and get real answers:

1. **Days per week they will realistically hit in a _bad_ week** — not an ideal one.
   Say why you are asking it that way: a plan built for the good week fails every other
   week.
2. Which weekdays.
3. Typical session length in minutes — **door to door, actually**, not aspirationally.
4. Rest between sets, if they know it. Default 90 s compounds / 60 s isolation.

Then **show them the arithmetic** and the exercise count it produces. It builds trust
in the number, and it heads off "why only 7 exercises?" three weeks later.

### Round 4 — equipment

Gym type. Then specifically:

- **Machines known absent.**
- **Anything they have tried and cannot access in practice** — the single squat rack
  that is always occupied is functionally absent.

**Ask about the usual gaps by name**, because people do not volunteer a missing machine,
they just skip the exercise: standing calf raise · reverse hyper · seated back extension ·
hack squat · cable crossover · machine pullover.

### Round 5 — constraints

**This is the round that decides whether this thing gets used.**

- Injuries or pain patterns. **Run the `safety.md` §1 escalation check on every answer**
  — if anything sounds acute, escalate now, before programming anything.
- Banned movement patterns (clinician-imposed or self-imposed).
- Dietary constraints, cooking capacity on a weekday, current supplements.
- And ask this directly:

> **"Anything you'd quietly skip because it feels awkward, embarrassing, or you just
> hate it? Naming it now is cheaper than programming it four times."**

An exercise someone finds embarrassing will be silently skipped forever and quietly
poison the volume math. Record every answer in the profile's **disliked exercises**
list. Do not argue with any of them, and do not program them again.

### Also in round 5 — state the limitation

Say plainly: **the coach cannot see you move.** Written cues and conservative loading
are the only form tools available. Offer, **once**, a session with a trainer or filming
a set for self-review. If declined, record it under declined interventions, accept it,
and never raise it again — but keep progression steps small on flagged and complex
lifts. (`safety.md` §5.)

Mention creatine **once** here if nutrition is in scope. Same rule: declined means never
again. (`nutrition.md` §7.)

---

## Step 6 — pick a Notion home

Ask which Notion page to build under. Offer to **create a new top-level "Gym Coach"
page** if they would rather not pick one — most people would.

Use `notion-search` to find the page they name, and **confirm the exact page with them
by title and URL before creating anything under it.**

---

## Step 7 — provision

Create, in this order, under the chosen parent page, with schemas from
`storage-notion.md` §4:

1. **Gym Log** database → record `gymLogDataSourceId`
2. **Training Blocks** database → record `blocksDataSourceId`
3. **Body Metrics** database → record `bodyMetricsDataSourceId`
4. **Coach Operating Manual** page → record `operatingManualPageId`

Write all five IDs (including `parentPageId`) to the config, plus `version`, `units`,
`createdAt`.

**Create the config directory first.** `~/.claude/plugins/data/` does not exist until
something writes to it — `mkdir -p` the path before writing, or the write fails on a
clean install.

> ### If provisioning fails partway, unwind.
>
> Track every object created, in order. On any error: archive/delete each created
> object in reverse order, write no config, and report the failure plainly with what
> was rolled back. **A half-provisioned workspace is the worst outcome** — worse than
> nothing, because the next run finds some of it and assumes the rest.

---

## Step 8 — write the operating manual

Generate the Coach Operating Manual page from
`${CLAUDE_PLUGIN_ROOT}/templates/operating-manual.md`, filled with **this athlete's**
specifics — not the template's example values.

**It must include, in full:**

- The complete profile (per `${CLAUDE_PLUGIN_ROOT}/templates/profile.md`)
- The **Recovery** block with all five Notion IDs in plain text
- The escalation rules from `safety.md`, reproduced verbatim — so they survive even if
  the plugin is deleted
- Progression rules, session design rules, warm-up, nutrition targets, log format, tone

Set nutrition targets now, enforcing the `nutrition.md` §8 floors. **If a floor would be
violated, refuse the number, explain in one or two sentences, and set the sustainable
one.**

---

## Step 9 — first block

Offer `/gym-coach:block` to build the first block.

**If they have existing training history elsewhere — a spreadsheet, another app, a
notes file — offer `/gym-coach:audit` first.** An audit of real history makes the first
block dramatically better, and it is the single most convincing thing this system does.

---

## Step 10 — what to do next

Print a short orientation. No more than this:

```
Done. Your workspace: <link to the parent page>

  /gym-coach:today     before training — your session, with weights computed
                       from last time
  /gym-coach:log       after training — "done as prescribed" is a complete log
  /gym-coach:checkin   every 2 weeks — five lines and one recommendation
  /gym-coach:block     every 6-8 weeks — rebuild the plan from your logs (use Opus)
  /gym-coach:audit     when stuck — find what's actually blocking progress (use Opus)

One chat per gym day: /gym-coach:today, train, /gym-coach:log, close the chat.
Notion is the memory, so nothing is lost when a chat ends.

This isn't medical advice and I can't see you move — see DISCLAIMER.md.
```

---

## Rules for this skill

- **Never improvise an ID.** Every ID comes from a provisioning call's return value.
- **Never delete a user's existing workspace**, under any branch.
- Batch the questions. Five messages, not twenty.
- Record refusals as durable facts, not as gaps to re-ask later.
- If the user goes quiet mid-interview, write nothing. A partial profile is worse than
  no profile — the next block would treat its gaps as answers.
