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
- `${CLAUDE_PLUGIN_ROOT}/references/goals/README.md` — the five modes and the contract
  between them. **The specific profile is loaded in Round 2, once the mode is known.**

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

**A `version: 1` config is not a problem and is not mentioned.** Read it as
`goalMode: "hypertrophy"`, `equipmentTier: "full-gym"` per `storage-notion.md` §2.1, and
rewrite it as version 2 on the next write. No prompt, no announcement.

**If a config already exists, say so and offer exactly four choices. Never clobber.**

```
You already have Gym Coach set up — your workspace is at <link>, created 2026-08-21.

  1. Update your profile       — change schedule, equipment, constraints, targets
  2. Change your training goal — switch between muscle / strength / fat loss /
                                 general fitness / endurance hybrid
  3. Repair a broken link      — re-find the databases under your parent page
  4. Start fresh somewhere new — build a second workspace in a different Notion page

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

### Option 2 — change your training goal

**Every log entry, every database, and every ID survives this. Nothing is re-created.**

1. Run **Round 2** again (goal mode) and **Round 2b** (the mode's ranking — muscles,
   lifts, patterns, or the protected quality). Run **Round 6** again too if the targets
   no longer fit the new mode.
2. Set `goalMode` and stamp `goalModeSetAt` with today's date. Bump the config to
   version 2 if it was not already.
3. **Rewrite the operating manual's goal-mode, ranking, `will_not_do` and targets
   sections.** Leave every other section alone.
4. **Say plainly what changes**, in the mode's own terms, before doing it:

   ```
   Switching hypertrophy -> strength changes four things:
     • Slot 1 goes to your main lift instead of your lagging muscle
     • Rests go to ~240 s on main work, so a 45-min session holds 4 exercises, not 7
     • Progress is measured as e1RM per lift, not sets per muscle per week
     • No deficit while you're chasing a heavy PR

   Your log, your workspace and every session you've recorded stay exactly as
   they are. Nothing is deleted or reinterpreted.
   ```

5. **A goal-mode change requires a `/gym-coach:block` rebuild.** The active block was
   built for the old mode's ordering, rests and gate; leaving it live means running a
   hypertrophy block while being graded as a strength athlete. **Say so, and offer to
   run it immediately.**

   ```
   Your active block was built for hypertrophy and won't pass the strength gate —
   it has no main lift in slot 1 and rests are set for 90 s. Want me to run
   /gym-coach:block now? It takes a couple of minutes and I'd use Opus for it.
   ```

> **Never reinterpret existing history under the new mode's rules retroactively.**
>
> The mode change is **dated** in `goalModeSetAt`. Sessions logged before it were done
> under the old rules and are graded under the old rules. `audit` reports across the
> boundary by naming it and splitting the segments (`skills/audit` §0.5) — it never
> averages a volume number across a mode change, and it never tells someone their
> hypertrophy block was a bad strength block.

If no config exists, continue.

---

## The onboarding interview

**Six rounds, batched. Ask several questions per message, not one at a time.** An
interview that takes twenty messages does not get finished.

Open by saying what this will take (about five minutes) and what it produces (three
Notion databases and a coaching manual, built automatically).

### Round 1 — basics

Name or what to call them · age · height · weight · **metric or imperial** · when they
started training, or "beginner".

> If age is under 18: do not refuse. State that this programming assumes an adult,
> recommend involving a parent or guardian plus a coach or physician, and keep loads
> conservative throughout. No calorie deficits. (`safety.md` §4.)

### Round 2 — the goal mode

**This round comes before everything about muscles, because it decides what the next
question even is.**

**Ask the goal in their own words first.** Not from a menu — people describe what they
want far better than they pick from a list, and the words they use are worth recording.

Then present the five, one line each:

```
  Muscle              size in the muscles you name. 10+ sets each a week
  Strength            load on the lifts you name. Main lift first, long rests
  Fat loss            weight down, muscle and strength kept
  General fitness     health and consistency. Every movement pattern, twice a week
  Endurance hybrid    lifting alongside running, cycling, swimming or a sport
```

**Map their words to a mode, and confirm the mapping out loud** — say which one you
picked, why, and what it changes:

> That's the **fat-loss** profile. Here's what it means in practice: the training
> barely changes — you keep the same rep ranges and the same lifts — but holding a
> weight gets reported as a success rather than a stall while the scale is moving, and
> I'll refuse to cut your training volume to "burn more", because that's the thing
> protecting the muscle you're trying to keep. Sound right?

**Wait for the confirmation.** A mode chosen for someone rather than with them is the
mode they will be arguing with in three weeks.

#### Mixed goals

Almost everyone has one. **Choose a primary, record the secondary, and say which rules
the primary decides.**

> You want to be stronger and leaner. Those pull in opposite directions on food, so
> one of them has to own the calorie number.
>
> I'd make **strength** the primary — it decides slot 1, your rests, and how progress
> gets measured — and record fat loss as secondary, which means maintenance calories
> rather than a surplus, and we revisit it at the end of the block. The alternative is
> fat-loss primary, and then I'd expect your top-end lifts to hold rather than climb.
>
> Which of those two do you want to be true?

Record both in the operating manual. **Never quietly run two modes at once** — that is
how someone ends up with a plan that serves neither.

Set `goalMode` and `goalModeSetAt` in the config.

**Then read `${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md` and use it for the rest
of the interview.** Its `will_not_do` list goes into the operating manual in Step 8, and
it is worth stating the one or two most surprising items now rather than at the moment
someone hits them.

### Round 2b — the ranking, which depends on the mode

**Load the chosen profile and ask its questions, not a fixed list.**

| Mode | What gets ranked |
|---|---|
| `hypertrophy` · `fat-loss` | **Muscles.** `side delts > rear delts > traps > lats` |
| `strength` | **Lifts.** `squat > bench > deadlift`. Not muscles — the unit is the lift |
| `general-fitness` | **Nothing.** It covers all eight movement patterns. Say so, and move on — do not invent a ranking to fill the field |
| `endurance-hybrid` | **Which quality is being protected** — the endurance goal, or strength — plus which of their sessions are the hard/long ones |

**Force a ranking where the mode needs one.** "Broad shoulders" is not a program;
`side delts > rear delts > traps > lats` is. "Getting stronger" is not a program;
`squat > bench > deadlift` is.

If they cannot rank, force a choice: *"If only one of these moved this year, which
one?"* Then build the rest of the order around it.

**Store the ranking. It drives exercise ordering forever**, until they change it.

In `endurance-hybrid`, also record **which endurance plan they are already following**,
and say plainly that this coach does not write it — it manages the interaction with it
(`goals/endurance-hybrid.md`).

### Round 3 — schedule and time budget

**These four numbers determine exercise count arithmetically** (`programming.md` §1).
Ask all four, and get real answers:

1. **Days per week they will realistically hit in a _bad_ week** — not an ideal one.
   Say why you are asking it that way: a plan built for the good week fails every other
   week.
2. Which weekdays.
3. Typical session length in minutes — **door to door, actually**, not aspirationally.
4. Rest between sets, if they know it. **Default to the mode's `rest_defaults`** — 90/60
   in `hypertrophy` and `fat-loss`, 240/120/90 in `strength`, 60–90 in
   `general-fitness`, 120/90 in `endurance-hybrid`.

Then **show them the arithmetic** and the exercise count it produces. It builds trust
in the number, and it heads off "why only 7 exercises?" three weeks later.

> **In `strength` mode, show it early and show it fully.** Four exercises in 45 minutes
> is the output people refuse to believe, and the arithmetic is the entire answer:
>
> ```
> 45 min = 2700 s, minus 5 min warm-up = 2400 s
> Back squat, 4 sets x (45 s work + 240 s rest) = 1140 s — 19 min on one lift
> That leaves 1260 s: one secondary at 3x165 s, two accessories at 3x135 s.
> Four exercises. The rests your goal needs are what spend the time.
> ```
>
> In `endurance-hybrid`, say the opposite thing just as plainly: a 30–40 minute lifting
> session is normal and correct here, not a compromise.

In `endurance-hybrid`, also ask **when their hard and long endurance sessions fall**.
That schedule, not the lifting one, is what the week gets built around.

### Round 4 — equipment tier first, then the gaps

**Ask the tier before anything else.** It makes most of the "which machines are
missing" questions unnecessary, and it is the difference between a library that fits
their kit and one that keeps prescribing a cable station they do not have.

```
Which of these describes what you actually train with?

  full-gym         commercial gym: racks, cables, machines, full dumbbell range
  barbell-home     barbell, plates, rack, bench, maybe a pull-up bar. No cables
  dumbbell-home    adjustable dumbbells, a bench, bands. No barbell
  minimal          bands and a pull-up bar
  bodyweight       nothing but the floor
```

Set `equipmentTier` in the config. Then load `exercise-library.md` §10 and **say what
the tier can and cannot reach**, honestly, before they discover it themselves:

> `dumbbell-home` covers almost everything well. The honest gaps are heavy hinge work
> — no barbell means RDLs cap out at whatever dumbbells you own — and lats, where a
> pull-up bar makes a real difference if you can add one. Everything else is covered.

**In the `minimal` and `bodyweight` tiers, say now that progression moves from load to
reps, tempo, leverage and unilateral work** — and that `today` will print that variable
where a weight would normally go. It is a surprise if it arrives unannounced in week
one.

#### Then the gap questions, scoped to the tier

- **In `full-gym`: ask about the usual missing machines by name**, because people do not
  volunteer a missing machine, they just skip the exercise: standing calf raise ·
  reverse hyper · seated back extension · hack squat · cable crossover · machine
  pullover.
- **In `barbell-home` and `dumbbell-home`:** ask what they actually own — dumbbell range
  and increment, whether the rack has a pull-up bar, whether there are bands, whether
  the bench inclines. The increment matters: 5 kg jumps on a fixed dumbbell set is a
  progression problem to plan around, not a surprise to discover.
- **In `minimal` and `bodyweight`:** ask what anchor points exist (a bar, a door anchor,
  a sturdy table) and what band strengths they have.
- **In every tier: anything they have tried and cannot access in practice.** The single
  squat rack that is always occupied is functionally absent, and so is the barbell in
  the garage that is under the car.

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

> **`general-fitness`: nutrition is not in scope unless they raise it.** Set the protein
> floor and stop. **Do not volunteer a calorie target** — not here, not later
> (`goals/general-fitness.md` §13).
>
> **`fat-loss`: run `safety.md` §8.1 on every answer in this round**, the same way §1 is
> run on the injury answers. If anything in how they describe eating meets the signals
> there, stop setting a calorie target and refer out — before provisioning, not after.

### Round 6 — targets

**One to three measurable outcomes with a date.** This is what turns "your lat pulldown
went up" into "you are on pace, here is the date".

Ask it as a question about the finish line, not about metrics:

> Is there something specific you want to be true by a particular date? A weight on a
> lift, a number on the scale, a number of weeks trained without missing? It's fine if
> there isn't — I'd rather record none than invent one.

Each target needs: `name` · `metric` · `start_value` (with today's date) ·
`target_value` · `target_date` · `source`. Write them into the **Targets** section of
the operating manual in the exact shape in `storage-notion.md` §8, and set
`targetsReviewedAt` in the config.

Good targets, by mode:

| Mode | Example |
|---|---|
| `hypertrophy` | Lateral raise 3×15 at 14 kg by 2027-02-01 |
| `strength` | Squat e1RM 140 kg by 2027-03-15 |
| `fat-loss` | 78 kg at ≤0.75%/week |
| `general-fitness` | 3 sessions/week for 12 consecutive weeks |
| `endurance-hybrid` | Hold squat e1RM through a 16-week build |

**`source` must be one of three**, and it decides who owns the number:

- `log` — a lift's e1RM or working load. The coach updates it.
- `body-metrics` — bodyweight, from the 3-week rolling average. The coach updates it.
- `manual` — anything the coach cannot observe: a photo goal, a clothing fit, a race
  time. **Labelled self-reported everywhere it appears**, and after four weeks without
  an update it gets one reminder and then goes quiet.

> ### If they have no target in mind, do not force one.
>
> **Record "no target set" and offer again at the first check-in.** A fabricated target
> is worse than none — it becomes a number the coach reports against for months, and
> nobody ever cared about it.
>
> Write the line into the Targets section anyway, so a later run can tell "declined"
> from "never asked".

**Sanity-check every target against the mode and the floors before writing it:**

- A target that contradicts the mode is worth one sentence now, not a surprise at the
  first check-in. *"That's a fat-loss target and we've set you up in strength mode —
  do you want me to switch, or keep strength and treat the weight as secondary?"*
- **A weight target below BMI 18.5, or one requiring more than 1% BW/week, is refused**
  — the number, not the goal. Offer the sustainable version and the date it implies
  (`safety.md` §6). This is identical in all five modes.
- A target with no plausible route in the athlete's stated schedule gets said out loud
  now, with the arithmetic, and a revised date offered.

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

Write all five IDs (including `parentPageId`) to the config, plus `version: 2`, `units`,
`createdAt`, `goalMode`, `equipmentTier`, `goalModeSetAt`, and `targetsReviewedAt`
(`storage-notion.md` §2).

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
- **The active goal mode, and why it was chosen** — in the athlete's own words from
  Round 2, plus the secondary goal if there was one and which rules the primary decides
- **The mode's `will_not_do` list, copied in full** — not referenced. It must survive
  the plugin being uninstalled, because it is the list of things the athlete was told
  this coach would refuse
- **The equipment tier**, and the honest gaps for it from `exercise-library.md` §10
- **The Targets section**, in the exact shape in `storage-notion.md` §8 — including the
  "no target set" line if that is the answer
- The **Recovery** block with all five Notion IDs in plain text
- The escalation rules from `safety.md`, reproduced verbatim — so they survive even if
  the plugin is deleted
- Progression rules, session design rules, warm-up, nutrition targets, log format, tone

**The progression, session-design and nutrition sections are written in the active
mode's terms** — the mode's rest defaults, its slot-1 rule, its stall trigger, its
deload cadence, its stance. A manual that describes double progression and
lagging-muscle-first to a strength athlete is wrong on the page they will actually
re-read.

Set nutrition targets now, per the mode's `nutrition_stance`, enforcing the
`nutrition.md` §8 floors. **If a floor would be violated, refuse the number, explain in
one or two sentences, and set the sustainable one.** The floors are identical in all
five modes (`safety.md` §8).

> **In `general-fitness`, set the protein floor and nothing else.** No calorie line in
> the manual unless they asked for one.

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
- Batch the questions. Six messages, not twenty.
- **Confirm the goal-mode mapping out loud and wait for the answer.** A mode chosen for
  someone is the mode they argue with later.
- **Ask the equipment tier before the equipment gaps.** The tier answers most of them.
- **Never fabricate a target.** "No target set" is a complete answer, recorded as one.
- **A goal-mode change preserves every log entry and every ID**, is dated, requires a
  `/gym-coach:block` rebuild, and never reinterprets past history.
- Record refusals as durable facts, not as gaps to re-ask later.
- If the user goes quiet mid-interview, write nothing. A partial profile is worse than
  no profile — the next block would treat its gaps as answers.
