# Gym Coach

**An evidence-based strength coach that remembers.** A Claude Code plugin with a
Notion-backed training log, per-session progression computed from your logged history,
and weekly volume verification that blocks a plan before it ships.

> ### ⚠️ This is not medical advice
>
> Gym Coach is not a doctor, a physiotherapist, or a dietitian, and **it cannot see you
> move**. Consult a physician before starting any exercise or nutrition program. Stop
> and seek medical attention for chest pain, disproportionate breathlessness, fainting,
> or a sudden severe headache during exertion. Use at your own risk —
> see [DISCLAIMER.md](DISCLAIMER.md).

---

## Why this exists

This was built by auditing 23 real logged training sessions and finding out why they
were not working. Six failures came out of it. Each one is now a hard rule.

**A generic "act as my personal trainer" prompt has none of these.**

| Real failure observed | Rule this repo enforces |
|---|---|
| Rear delts got ~1 set/week and lower traps 0 across 21 days, while the athlete's stated goal was broader shoulders | **Weekly set volume per muscle is computed and displayed before any plan ships.** A priority muscle under 10 sets/week is a plan defect that blocks publication |
| A day was programmed with 10 exercises against a real 45-minute budget; it silently self-edited every session and always cut the same 3 lifts | **Exercise count is derived arithmetically** from the athlete's actual session length and rest times — never guessed |
| The plan said "hold 85 lb until 12 reps are clean"; nobody re-read the trigger, and 11 lifts sat stalled for 3 weeks | **Session targets are never written into the plan.** They are computed fresh from the last log entry for that exact lift |
| The coach demanded full numbers every session; the athlete reported "done as prescribed" and the coach treated it as missing data | **"Done as prescribed" is a complete log.** You report deviations only |
| The coach cross-checked subjective effort against heart-rate data and called a 9/10 leg day with a Zone 1 HR a contradiction | **Subjective effort is never validated against HR.** It is a fatigue signal, nothing else |
| Whatever was programmed last never got done — core and mobility vanished for months | **The lagging muscle goes first**, every session. Core and mobility live in the warm-up |

Every quantitative claim in the repo carries a citation. See
[`references/evidence.md`](references/evidence.md) — including an explicit list of the
things that are conventions rather than findings.

---

## What you get

| Command | What it does |
|---|---|
| `/gym-coach:setup` | Onboarding interview, then builds your entire Notion workspace for you |
| `/gym-coach:today` | Today's session, with every weight computed from your last performance of that exact lift |
| `/gym-coach:log` | Logs a session. "Done as prescribed" is a complete log |
| `/gym-coach:checkin` | Five lines and one recommendation. Every two weeks |
| `/gym-coach:block` | Rebuilds the plan from your logs. Refuses to ship a plan that starves a priority muscle |
| `/gym-coach:audit` | Diagnoses an existing training history — including one imported from a spreadsheet or another app |

---

## Prerequisite — Notion

> Gym Coach stores your training log, plans and body metrics in Notion, so they're
> reachable from your phone in the gym and from any Claude session. **You need the
> Notion connector enabled before setup.** A plugin can't install an MCP server for you.
>
> **Claude Code:** `/mcp`, then add the Notion server.
> **Cowork / Claude app:** the "+" button → Connectors → enable Notion.
>
> A free Notion account is enough. Setup creates everything else for you.

There is no local-file fallback and no degraded mode. If the connector is missing,
every command stops with the connection instructions and creates nothing. A
half-working storage layer is worse than a clear prerequisite.

---

## Install

```
/plugin install AriyanAzami/gym-coach
/gym-coach:setup
```

Or via the marketplace:

```
/plugin marketplace add AriyanAzami/gym-coach
/plugin install gym-coach@gym-coach-marketplace
```

Both routes are tested. *Setup takes about five minutes and creates three databases and
a coaching manual in your Notion workspace.*

---

## Daily use

**One chat per gym day. Two messages. Then close it.**

```
new chat  →  /gym-coach:today   →  train  →  /gym-coach:log  →  close the chat
```

Notion is the memory, so chats are disposable by design and you never hit a context
limit. Nothing is carried between sessions in the conversation — it is carried in your
workspace.

| When | Command | Model | Chat |
|---|---|---|---|
| Before training | `/gym-coach:today` | Sonnet | new chat |
| After training | `/gym-coach:log` | Sonnet | same chat, then close |
| Every 2 weeks | `/gym-coach:checkin` | Sonnet | new chat |
| Every 6–8 weeks | `/gym-coach:block` | **Opus** | new chat |
| When stuck | `/gym-coach:audit` | **Opus** | new chat |

---

## What it actually looks like

**This is real output**, captured from an end-to-end run against a live Notion
workspace during development. The athlete is fictional and the training history was
fabricated for the test — the numbers the coach produces from it were not.

### Diagnosing a broken plan

Six logged sessions were planted with two deliberate flaws: a starved priority muscle,
and a lift stalled for three sessions. `audit` was given no hint that either existed.

```
> /gym-coach:audit

ADHERENCE — graded on its own
  6 sessions in 2.7 weeks = 2.2/week against a planned 2. No gap over 4 days.
  Adherence: good. None of the findings below are caused by it.

PLAN QUALITY: poor.

PACE — this is the finding everything else follows from
  84 completed sets over 271 logged minutes = 172 s per set.
  The plan assumed 105-135 s. It was never achievable.

  45 min - 5 min warm-up = 2400 s / 172 = 14 sets = ~4.7 exercises at 3 sets
  The plan programmed 8 exercises = 23 sets.  Over-booked by 9 sets, every session.

COMPLETION — and it is always the same ones
  Lat Pulldown (wide)      slot 1    9/9    100%
  Cable Shrug              slot 4    9/9    100%
  Straight-Arm Pulldown    slot 5    0/9      0%
  Reverse Pec Deck         slot 7    3/9     33%
  Cable Rear Delt Fly      slot 7    0/9      0%
  Dead Bug / Plank         slot 8    0/6      0%   <- never once

VOLUME — completed sets/week vs >=10
  Side delts   (P1)   7.5   programmed 7.5   ⚠️
  Rear delts   (P2)   2.5   programmed 7.5   🚨
  Lats         (P3)   4.5   programmed 7.5   🚨
  Upper traps  (P4)   3.0   programmed 3.0   🚨
  Biceps              6.0   programmed 12.0  —   not a priority

  Your goal is broader shoulders. Biceps received more completed volume than
  rear delts, lats and traps.

PROGRESSION
  Cable Shrug  45 kg x 3x12  x 3 sessions  STALLED
  The plan says "hold until 3x12 is clean". It was clean on the first session.
  Nobody re-read the trigger. That is a plan defect, not an effort problem.

TOP FIX
  Cut to 5 exercises and move the rear delt fly to slot 1. You have been cutting
  the bottom three every session. This makes the cut deliberate, so the right
  things survive.
```

Both planted flaws found, plus one nobody planted: the athlete's real pace was 172
seconds per set against a plan built for 105–135, which is *why* the bottom of every
session kept disappearing.

### Rebuilding

`block` then refused to publish, because at 2 sessions a week the volume gate could not
be satisfied at all:

```
2 sessions x 14 sets = 28 sets/week
4 priority muscles at 10 direct sets = 40 needed        SHORT BY 12

No ordering fixes that. Three options:
  1. Add a third day. 42 sets/week covers all four.
  2. Cut the priority list to two, and I'll say which two dropped.
  3. Longer sessions — but your logged mean is 45 min, so I'd be building
     for a number you've never hit.
I'd take option 1. Which do you want?
```

It does not ship a quiet compromise, and it does not just refuse. The published block
contains **zero weights** — structure, sets, reps, rest and order only.

### Before training

```
> /gym-coach:today

DAY 1 — DELTS · 5 exercises · ~43 min

Non-negotiable: Cable Rear Delt Fly · Cable Lateral Raise · Reverse Pec Deck
If short on time, cut from the bottom.

Warm-up (5 min): 2-3 min bike · dead bug 2x10 · band pull-apart 2x15
  Ramp-up on lift 1 only: 50% x 8, 75% x 5

1. Cable Rear Delt Fly     3x15   --        60s   last: no logged history — start
                                                   conservative and record it
2. Cable Lateral Raise     3x15   9 kg      60s   last: 8 kg x3x15 (Aug 15)   ↑
3. Reverse Pec Deck        3x15   22.5 kg   60s   last: 20 kg x3x15 (Aug 15)  ↑
4. Dumbbell Lateral Raise  3x15   10 kg     60s   last: 9 kg x3x15 (Aug 15)   ↑
5. Cable Shrug             3x12   47.5 kg   60s   last: 45 kg x3x12 (Aug 18) — 3rd
                                                   session at this weight. The old plan
                                                   held it behind an "until 3x12 is
                                                   clean" trigger that was met on day
                                                   one. Hold removed; it goes up.
```

Line 1 is the rule that matters most: the rear delt fly has never been logged, so **no
number is invented for it**. Line 5 is the stall being broken by the rebuild.

### After training

```
> /gym-coach:log
> done as prescribed, rear delt fly at 12 kg

Logged — 2026-08-26 Day 1 DELTS, 43 min, all 5 exercises completed.
First complete session in your logged history.

Progressed:  cable lateral raise 8 → 9 kg · reverse pec deck 20 → 22.5 kg
             dumbbell lateral raise 9 → 10 kg · cable shrug 45 → 47.5 kg
Stalled:     none
Skipped:     none

Next Day 1: one increment up on the rear delt fly if 3x15 is clean.
Anything hurt? Otherwise you're done.
```

**It asked for nothing.** Four of the five loads were expanded from targets already
computed and confirmed; only the rear delt fly — which had no history — needed a number,
and the athlete volunteered it.

Running `today` again afterwards prescribes 10 kg, 25 kg, 11 kg and 50 kg, and the rear
delt fly now shows `last: 12 kg ×3×15 (Aug 26)` instead of `no logged history`. That is
the whole loop.

---

## What it will not do

- **See a form video.** It cannot assess your technique. That is the honest limitation,
  it is stated during setup, and progression steps stay small on flagged lifts because
  of it.
- **Diagnose an injury.** It describes what you reported, notes the pattern, and refers
  you to someone who can actually examine you.
- **Count your meals.** It sets protein and calorie targets and adjusts them off your
  3-week rolling weight average. It is not a food tracker.
- **Replace a doctor.** See [DISCLAIMER.md](DISCLAIMER.md).
- **Program a deficit that is too aggressive.** Calorie targets below `BMR × 1.2`, BMI
  targets below 18.5, and loss rates above 1% of bodyweight per week are refused with an
  explanation, not delivered with a warning attached.

---

## The evidence base

Every number cites a source: [`references/evidence.md`](references/evidence.md).

It also lists, separately and explicitly, the things this repo does on **judgement
rather than evidence** — the 45-second working-set constant, the 3-session stall
threshold, lagging-muscle-first ordering, the nutrition adjustment steps. If a claim is
not in that file, the coach is instructed to call it an opinion.

---

## How it is put together

```
skills/        six commands
references/    the coaching content — programming, evidence, exercises, nutrition,
               safety, storage, wearables. Shared, loaded by path, never duplicated
templates/     the shapes written into Notion
```

The interesting part is `references/`. The skills are mostly orchestration; the rules
live in the reference library, which means you can read exactly what your coach believes
and why, and change it.

---

## What has and has not been tested

Stated plainly, because a confident claim that breaks is worse than an honest gap.

**Verified against a live Notion workspace:**

- Provisioning all three databases and the manual page from the shipped schemas
- The full `today` → `log` → `today` loop, with progression firing into the next session
- `log` accepting "done as prescribed" and writing a complete entry without asking for numbers
- `block` refusing to publish under the volume gate, and publishing zero weights
- `audit` finding a planted volume gap and a planted 3-session stall
- Exactly one `Active` block enforced through archive-then-activate
- Install from a local marketplace, with all six `/gym-coach:` skills registering
- `${CLAUDE_PLUGIN_ROOT}` resolving — `references/` and `templates/` ship with the install
- Self-referencing `marketplace.json` in the same repo (both install routes work)

**Not yet verified:**

- **Cowork / Claude app.** Only tested in Claude Code CLI. Plugin skills may load
  differently there.
- **Provisioning rollback.** The unwind-on-partial-failure path is specified but no
  mid-provision failure was forced.
- **`${CLAUDE_PLUGIN_DATA}` persistence across a plugin update.** The directory is
  created lazily — it does not exist until something writes to it, which `setup`
  accounts for. Because the config is the only pointer to your data, setup also writes
  the Notion IDs into your Coach Operating Manual page as a human-readable recovery copy.

Two bugs were caught by testing rather than by reading, and both would have broken every
session: a Notion `DATE` property is not queryable by its own name (it expands to
`date:Date:start`), and the athlete's real seconds-per-set diverged from the planning
constant badly enough to invalidate the exercise count.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: **every quantitative claim needs
a citation in `evidence.md`, or an explicit label saying it is a convention.** That rule
is the whole point of the project.

## License

MIT — see [LICENSE](LICENSE).
