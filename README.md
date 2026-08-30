# Gym Coach

**A training coach that remembers.** A Claude plugin that keeps your plan, your log and
your body metrics in Notion, computes every session's weights from what you actually
lifted last time, and refuses to ship a plan that does not serve the goal you stated.

Pick your goal — muscle, strength, fat loss, general fitness, or lifting alongside
endurance — and the rules change with it. Not the tone. The rules.

> ### ⚠️ This is not medical advice
>
> Gym Coach is not a doctor, a physiotherapist, or a dietitian, and **it cannot see you
> move**. Consult a physician before starting any exercise or nutrition program. Stop
> and seek medical attention for chest pain, disproportionate breathlessness, fainting,
> or a sudden severe headache during exertion. Use at your own risk —
> see [DISCLAIMER.md](DISCLAIMER.md).

---

## Quick start

```
1.  Enable the Notion connector          (see Prerequisite, below)
2.  /plugin install AriyanAzami/gym-coach
3.  /gym-coach:setup                     ~5 minutes, one interview
4.  /gym-coach:today                     before you train
5.  /gym-coach:log                       after you train
```

Setup asks about your goal, your schedule, your equipment and your constraints, then
builds three Notion databases and a coaching manual for you. You do not create anything
by hand.

---

## Why this exists

Most AI training advice fails the same way: it is excellent once and then forgets. The
plan drifts from what you actually did, nobody re-reads the rule that was supposed to
trigger a weight increase, and the last three exercises of every session quietly stop
happening.

This repo was built by auditing a real training history and finding out why it was not
working. Six failures came out of it. Each one is now a rule the coach cannot break.

| Failure observed in a real log | Rule this repo enforces |
|---|---|
| A priority muscle got ~1 set a week for three weeks, while the athlete's stated goal depended on it | **Weekly volume is computed and printed before any plan ships.** A priority muscle under its target is a defect that blocks publication |
| A session was programmed with 10 exercises against a real 45-minute budget; it self-edited every week and always cut the same three lifts | **Exercise count is arithmetic**, derived from your session length, your rest times and your observed pace — never guessed |
| The plan said "hold this weight until 12 reps are clean". Nobody re-read the trigger. Eleven lifts sat stalled for three weeks | **Weights are never written into a plan.** Every target is computed fresh from your last logged entry for that exact lift |
| The coach demanded full numbers every session; the athlete reported "done as prescribed" and it was treated as missing data | **"Done as prescribed" is a complete log.** You report deviations only |
| The coach called a 9/10 effort with a Zone 1 heart rate a contradiction | **Subjective effort is never validated against heart rate.** It is a fatigue signal, nothing else |
| Core and mobility were always programmed last, and vanished for months | **Whatever is last does not get done.** Core and mobility live in the warm-up, and the top three lifts are marked non-negotiable |

Every quantitative claim in the repo carries a citation, or is explicitly listed as a
convention rather than a finding. See [`references/evidence.md`](references/evidence.md).

---

## Pick your goal

Setup asks what you are training for, and loads one of five rule profiles. They share
one engine — the log is the source of truth, the arithmetic is the same, safety is
identical — and disagree about everything else.

| Mode | Progress means | Slot 1 goes to | The gate that blocks a plan |
|---|---|---|---|
| **Hypertrophy** | Size in your ranked priority muscles | Your lagging muscle | A priority muscle under 10 direct sets/week |
| **Strength** | Estimated 1RM on your priority lifts | The main lift, always | A priority lift under 2 exposures or 4 heavy sets/week |
| **Fat loss** | Weight down, load and muscle retained | Your lagging muscle | Training volume cut during the deficit, or a rate above the safe band |
| **General fitness** | Sessions completed, consistently | The hardest compound | A movement pattern missing from the week |
| **Endurance hybrid** | Endurance volume up, strength held | The goal-limiting quality, first in the week | Lower-body lifting inside 24 h of a hard endurance session |

The differences are real, not cosmetic. In strength mode a 45-minute session holds
**one main lift and three accessories** — because 240-second rests are what the
arithmetic says — and the coach shows you that arithmetic rather than pretending seven
exercises fit. In fat-loss mode, **holding a weight is reported as a success**, not a
stall, while your 3-week average is falling on schedule. In general-fitness mode the
check-in leads with sessions completed and never volunteers a calorie target.

Changed your mind? `/gym-coach:setup` → *change your training goal*. Every log entry
and every workspace ID survives it.

---

## What you get

| Command | What it does |
|---|---|
| `/gym-coach:setup` | Onboarding interview, then builds your whole Notion workspace |
| `/gym-coach:today` | Today's session, every weight computed from your last performance of that exact lift |
| `/gym-coach:log` | Logs a session. "Done as prescribed" is a complete log |
| `/gym-coach:checkin` | Five lines, your target progress, and one recommendation. Every two weeks |
| `/gym-coach:block` | Rebuilds the plan from your logs. Refuses to ship a plan that fails your mode's gate |
| `/gym-coach:audit` | Diagnoses a training history — including one imported from a spreadsheet or another app |

---

## Targets, and knowing whether you are on pace

At setup you can name up to three measurable outcomes with a date — an e1RM, a working
weight, a bodyweight, a number of weeks trained consistently. Every check-in reports
where you are against them:

```
TARGET — Squat e1RM 140 kg by Mar 15
  Start 112 kg (Aug 30) → now 121 kg → target 140 kg     47% there
  Observed rate 2.2 kg/week over 4 weeks → projected 138 kg by Mar 15
  Slightly behind. One more heavy exposure a week closes it.
```

Two rules keep this honest. **It will not project from fewer than three data points
spanning three weeks** — below that it says so and prints nothing else. And when a
target is missed, it says so once, plainly, and offers a revised date rather than
quietly shrinking the goal.

If you have no target in mind, do not invent one. Setup records that and asks again at
your first check-in.

---

## Whatever equipment you actually have

Setup asks which tier describes your training, and the exercise library answers
accordingly:

`full-gym` · `barbell-home` · `dumbbell-home` · `minimal` (bands and a bar) ·
`bodyweight`

In the lower tiers, progression moves from load to reps, tempo, leverage and unilateral
work — and the same double-progression logic applies to those variables, so `today`
still prints an exact target instead of an empty weight column. Where a tier genuinely
cannot train something well, the library says so rather than substituting an exercise
that does not do the job.

---

## Prerequisite — Notion

> Gym Coach stores your log, plans and body metrics in Notion, so they are reachable
> from your phone in the gym and from any Claude session. **You need the Notion
> connector enabled before setup.** A plugin cannot install an MCP server for you.
>
> **Claude Code:** `/mcp`, then add the Notion server.
> **Claude app / Cowork:** the "+" button → Connectors → enable Notion.
>
> A free Notion account is enough. Setup creates everything else.

There is no local-file fallback and no degraded mode. If the connector is missing, every
command stops with the connection instructions and creates nothing. A half-working
storage layer is worse than a clear prerequisite.

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

*Setup takes about five minutes and creates three databases and a coaching manual in
your Notion workspace. Nothing is created until you have picked the page it goes under.*

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

*The athlete below is fictional and the training history was fabricated for testing.
The numbers the coach derives from that history are not — they are what it produced.*

### Before training — hypertrophy mode

```
> /gym-coach:today

DAY 1 — DELTS · 5 exercises · ~43 min · hypertrophy

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

Line 1 is the rule that matters most: that lift has never been logged, so **no number is
invented for it**. Line 5 is a stall being broken.

### Before training — strength mode, same 45 minutes

*This block illustrates the format the spec calls for. Unlike the hypertrophy examples
above, it is not captured output from a run.*

```
> /gym-coach:today

DAY 2 — SQUAT · 4 exercises · ~44 min · strength

1. Back Squat        4x4    102.5 kg   240s   last: 100 kg 4x4 @RPE7 (Sep 2)  ↑
                                              e1RM 116 kg → 119 kg
2. Romanian Deadlift 3x8     80 kg     120s   last: 77.5 kg 3x8 (Sep 2)       ↑
3. Leg Press         3x10   160 kg      90s   last: 160 kg 3x9 (Sep 2)
4. Standing Calf     3x12    60 kg      90s   last: 57.5 kg 3x12 (Sep 2)      ↑

Four exercises, not seven. 4 sets x 240 s rest on the squat is 16 min of the 44.
```

Same athlete, same time budget, a completely different session — because the rest times
the goal demands are what the arithmetic runs on.

### After training

```
> /gym-coach:log
> done as prescribed, rear delt fly at 12 kg

Logged — Day 1 DELTS, 43 min, all 5 exercises completed.

Progressed:  cable lateral raise 8 → 9 kg · reverse pec deck 20 → 22.5 kg
             dumbbell lateral raise 9 → 10 kg · cable shrug 45 → 47.5 kg
Stalled:     none
Skipped:     none

Next Day 1: one increment up on the rear delt fly if 3x15 is clean.
Anything hurt? Otherwise you're done.
```

**It asked for nothing.** Four of the five loads were expanded from targets already
computed and confirmed. Only the lift with no history needed a number, and the athlete
volunteered it.

### Diagnosing a plan that is not working

Six logged sessions were planted with two deliberate flaws: a starved priority muscle
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
  Cable Lateral Raise      slot 1    9/9    100%
  Cable Shrug              slot 4    9/9    100%
  Straight-Arm Pulldown    slot 5    0/9      0%
  Cable Rear Delt Fly      slot 7    0/9      0%
  Dead Bug / Plank         slot 8    0/6      0%   <- never once

VOLUME — completed sets/week vs >=10
  Side delts   (P1)   7.5   programmed 7.5   ⚠️
  Rear delts   (P2)   2.5   programmed 7.5   🚨
  Lats         (P3)   4.5   programmed 7.5   🚨
  Biceps              6.0   programmed 12.0  —   not a priority

  Biceps received more completed volume than rear delts or lats, neither of
  which is what you said you were training for.

TOP FIX
  Cut to 5 exercises and move the rear delt fly to slot 1. You have been cutting
  the bottom three every session. This makes the cut deliberate, so the right
  things survive.
```

Both planted flaws found, plus one nobody planted: the athlete's real pace was 172
seconds per set against a plan built for 105–135, which is *why* the bottom of every
session kept disappearing.

`block` then refused to publish, because at two sessions a week the volume gate could
not be met at all:

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

It does not ship a quiet compromise, and it does not just refuse.

---

## What it will not do

- **See you move.** It cannot assess your technique. That is stated during setup, and
  progression steps stay small on flagged lifts because of it.
- **Diagnose an injury.** It describes what you reported, notes the pattern, and refers
  you to someone who can examine you. Sharp, radiating, worsening or non-resolving pain
  gets a referral, not a workaround.
- **Count your meals.** It sets protein and calorie targets and adjusts them off your
  3-week rolling weight average. It is not a food tracker.
- **Program an aggressive deficit.** Calorie targets below `BMR × 1.2`, BMI targets
  below 18.5, and loss rates above 1% of bodyweight per week are refused with an
  explanation — in every mode.
- **Program a max single, or peak you for a meet.** Strength mode builds e1RM. Attempt
  selection needs a human in the room.
- **Write your endurance program.** Hybrid mode manages the interaction between lifting
  and the endurance plan you are already following. It does not replace it.
- **Replace a doctor.** See [DISCLAIMER.md](DISCLAIMER.md).

---

## The evidence base

Every number cites a source: [`references/evidence.md`](references/evidence.md).

It also lists, separately and by mode, the things this repo does on **judgement rather
than evidence** — the 45-second working-set constant, the stall thresholds, the 24-hour
interference window, the Epley formula, the nutrition adjustment steps. If a claim is
not in that file, the coach is instructed to call it an opinion.

That list is long on purpose. A coaching system with no conventions in it is lying about
something.

---

## How it is put together

```
skills/            six commands — mostly orchestration
references/goals/  the five goal profiles, and the contract they implement
references/        the shared content — programming arithmetic, evidence, exercises,
                   nutrition, safety, storage. Loaded by path, never duplicated
templates/         the shapes written into Notion
```

The interesting part is `references/`. The skills are thin; the rules live in the
reference library, which means you can read exactly what your coach believes, and change
it.

**Adding a sixth goal profile is a single file.** `references/goals/README.md` defines
thirteen fields — what progress means, the volume rule, the gate, rep ranges, intensity
cue, progression scheme, rests, ordering, stall rule, deload, nutrition stance, plus the
report shape and an explicit list of what the mode refuses to do. Fill them all and the
engine runs your methodology. See [CONTRIBUTING.md](CONTRIBUTING.md) §8.

---

## What has and has not been tested

Stated plainly, because a confident claim that breaks is worse than an honest gap.

**Verified against a live Notion workspace, on the v0.1.0 hypertrophy path:**

- Provisioning all three databases and the manual page from the shipped schemas
- The full `today` → `log` → `today` loop, with progression firing into the next session
- `log` accepting "done as prescribed" and writing a complete entry without asking for numbers
- `block` refusing to publish under the volume gate, and publishing zero weights
- `audit` finding a planted volume gap and a planted 3-session stall
- Exactly one `Active` block enforced through archive-then-activate
- Install from a local marketplace, with all six `/gym-coach:` skills registering
- `${CLAUDE_PLUGIN_ROOT}` resolving — `references/` and `templates/` ship with the install
- Self-referencing `marketplace.json` in the same repo (both install routes work)

**Verified for v0.2.0:**

- `claude plugin validate .` passes on the updated manifests
- Every skill's frontmatter parses, and all six skills still declare a name and description

**Not yet verified — including everything the goal-mode rebuild added:**

- **The four new goal modes end to end.** `strength`, `fat-loss`, `general-fitness` and
  `endurance-hybrid` are specified against the same engine the hypertrophy path was
  tested on, but none has been run against a live Notion workspace. The mode-specific
  gates, the strength `today` output shape and the e1RM path are unrun.
- **The v1 → v2 config migration.** Specified to be silent and to change nothing for an
  existing hypertrophy user; not executed against a real v1 config.
- **Targets and the projection guard.** The three-points-over-three-weeks refusal is
  specified but has not been run against real check-in data.
- **The equipment tiers**, including whether `today` prints a progression variable
  rather than an empty column in the bodyweight tier.
- **The goal-mode change branch** in `setup`, and `audit`'s segmenting across a mode
  boundary.
- **Claude app / Cowork.** Only tested in Claude Code CLI. Plugin skills may load
  differently there.
- **Provisioning rollback.** The unwind-on-partial-failure path is specified but no
  mid-provision failure was forced.
- **`${CLAUDE_PLUGIN_DATA}` persistence across a plugin update.** Because the config is
  the only pointer to your data, setup also writes your Notion IDs into your Coach
  Operating Manual page as a human-readable recovery copy.

Two bugs were caught by testing rather than by reading, and both would have broken every
session: a Notion `DATE` property is not queryable by its own name (it expands to
`date:Date:start`), and the athlete's real seconds-per-set diverged from the planning
constant badly enough to invalidate the exercise count.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: **every quantitative claim needs a
citation in `evidence.md`, or an explicit label saying it is a convention.** A new goal
profile must fill all thirteen fields — a partial profile is a broken mode, not a draft.

## License

MIT — see [LICENSE](LICENSE).
