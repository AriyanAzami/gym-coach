---
name: today
description: Get today's workout. Use when the user says give me today's plan, I'm at the gym, what am I training today, or similar. Fast — the athlete is standing in the gym.
allowed-tools: Read Bash
effort: medium
---

# Gym Coach — today

**Optimise for speed. The user is standing in a gym holding their phone.**

No preamble, no restating the plan philosophy, no asking how they feel. Print the
session.

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md` and
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`.

---

## Step 0 — prerequisites

1. **Notion check** (`notion-fetch` with `id: "self"`). If the connector is absent, print the `storage-notion.md` §1
   message and stop.
2. **Read the config.** If missing, say *"Run `/gym-coach:setup` first — I don't know
   where your log lives yet"* and stop. **Never search Notion for the databases.**
3. **Read `config.goalMode` and load
   `${CLAUDE_PLUGIN_ROOT}/references/goals/<mode>.md`.** A config with no `goalMode`
   is `hypertrophy` (`storage-notion.md` §2.1) — read it that way, silently, and change
   nothing about the output.
4. **Read `config.equipmentTier`.** Missing means `full-gym`. In the `bodyweight` and
   `minimal` tiers, load `${CLAUDE_PLUGIN_ROOT}/references/exercise-library.md` §10 —
   the progression variable is not a load and the output shape changes.

**`today` writes nothing, so it does not migrate the config.** It reads a v1 config as
v2 defaults and leaves the file alone.

---

## Step 1 — read exactly three things

**Read discipline is what keeps this fast.** Pull only:

1. The **active block** (`Status = Active` in the Training Blocks data source).
2. The **most recent log entry** — to determine where the rotation is.
3. The **last log entry for the rotation day about to be run** — to compute weights.

The last two are often different pages. Query for the page, then `notion-fetch` that one
page for its body. **Do not read the whole history.** That is `audit`'s job.

---

## Step 2 — determine which session

**The session to run is the next in rotation. The cycle advances by session, never by
calendar date.**

- Last logged session was Day 2 → today is Day 3. It does not matter that four days
  passed or that today is a Tuesday.
- **Calendar gaps are rest days.** Do not restructure for a gap.
- **A gap over 7 days is the one exception:** flag it, and scale the first session back
  — drop the optional slot and hold the previous weights rather than progressing.
- **An incomplete session does not advance the rotation.** If the last entry skipped
  three of seven exercises for `time` or `fatigue`, the next session is that same day
  again. Say so in one line.
- **An `Endurance` entry does not advance the rotation** (`endurance-hybrid` mode). It
  is context. Skip past it to the last lifting entry.

### `endurance-hybrid` only — the interference check

Before printing, check the block's schedule against the profile's interference rule. If
today's session is hard lower-body work inside 24 h of a hard or long endurance session
the athlete has logged or scheduled, **say so in one line at the top and offer the
upper-body day instead.** One line. Do not rebuild the week — that is `block`.

---

## Step 3 — compute every weight, fresh

**This is the core of the skill.** For each exercise in the session:

1. Find that exact lift in the last log entry for this rotation day.
2. **Apply the active profile's `progression_scheme`.**

   | Mode | Scheme |
   |---|---|
   | `hypertrophy` · `fat-loss` · `general-fitness` | Double progression — top of the range on **all** prescribed sets → smallest available increment, marked `↑`. Otherwise same weight, rebuild reps |
   | `strength` | **Main lifts:** add the smallest increment if all reps were hit at or under target RPE; repeat the load on a miss; **~10% reset after two consecutive misses**. **Accessories:** double progression |
   | `endurance-hybrid` | Double progression on lifts. A held load during a rising endurance block is expected — do not intervene |

3. **Check the profile's `stall_rule`** and apply its intervention list in order. Say
   which one you applied and why. The trigger differs by mode — 3 held sessions in
   `hypertrophy`, 2 missed sessions in `strength`, 3 *declining* sessions in `fat-loss`,
   4 in `general-fitness`. Apply the mode's, not the default.
   - **`fat-loss`:** a held load while the 3-week weight average is falling on schedule
     is **`retained`, not stalled**. Print it that way and do not intervene.
4. Check `safety.md` §3: on a flagged movement, the smallest increment only, and only
   after two clean sessions at the current step. **This is identical in all five modes**
   (`safety.md` §8).

> **Never read a weight out of the block. The block does not contain weights.** If you
> find one there, the block is malformed — use the log and say the block needs
> rebuilding.

**If a lift has no history:**

```
no logged history — start conservative and record it
```

**Never invent a number.** Not an estimate, not a percentage of another lift, not a
"most people at your bodyweight" figure. The whole system depends on every printed
weight tracing to something the athlete actually lifted.

### Bodyweight and minimal tiers — the progression variable

In these tiers there is no load to add. **The weight column shows the progression
variable instead** — reps, tempo, leverage step, or a unilateral step — and double
progression applies to that variable exactly as it applies to a weight
(`exercise-library.md` §10, `programming.md` §4).

> **Never print an empty column.** A blank where a number should be is what makes
> someone stop trusting the sheet.

```
3. Push-Up (feet elevated)   3×12   +1 rep    60s   last: 3×11 (Sep 2)  ↑
4. Pike Push-Up              3×8    3-0-1     90s   last: 3×8 @ 2-0-1 (Sep 2)  ↑ tempo
```

---

## Step 4 — output

**Dense, scannable, no preamble.** This exact shape:

```
DAY 2 — BACK · 7 exercises · ~46 min · hypertrophy

Non-negotiable: Cable Rear Delt Fly · Lat Pulldown (wide) · Cable Shrug
If short on time, cut from the bottom.

Warm-up (5 min): 2-3 min bike · dead bug 2×10 · band pull-apart 2×15
  Ramp-up on lift 1 only: 50% × 8, 75% × 5

1. Cable Rear Delt Fly       3×15   16 kg    60s   last: 14 kg ×3×15 (Aug 19)  ↑
2. Lat Pulldown (wide)       3×10   41 kg    90s   last: 39 kg ×3×10 (Aug 19)  ↑
3. Seated Cable Row          3×10   43 kg    90s   last: 43 kg ×3×10,10,8 (Aug 19)
4. Cable Shrug               3×12   45 kg    60s   last: 45 kg ×3×12 (Aug 19) — 3rd session at this weight, moved up from slot 6
5. Chest-Supported Row       3×12   32 kg    60s   last: 30 kg ×3×12 (Aug 19)  ↑
6. Prone Y-Raise             3×15   —        60s   last: no logged history — start conservative and record it
7. Hammer Curl               3×12   14 kg    60s   last: 14 kg ×3×12 (Aug 19)  ↑

⚠️ Left shoulder: flagged on cable chest fly. Nothing today touches it.
```

*(Fabricated example. The athlete, the lifts and the loads are invented.)*

### The header line

`DAY N — NAME · <count> exercises · ~<minutes> min · <goalMode>`

**The mode goes in the header, every time.** It is one word, it costs nothing, and it
is how someone notices they are still in the mode they set up in eight months ago.

### `strength` mode — a different output shape

The main lift gets its own treatment: its own rest, a top-set target, and the e1RM
shown beside `last:`.

```
DAY 2 — SQUAT · 4 exercises · ~44 min · strength

Non-negotiable: Back Squat · Romanian Deadlift · Leg Press

Warm-up (5 min): 2-3 min bike · dead bug 2×10 · 90/90 hip 2×5/side
  Ramp-up on the squat: 50% × 5, 70% × 3, 85% × 1   (~4 min, budgeted)

1. Back Squat          4×4    102.5 kg   240s   last: 100 kg 4×4 @RPE7 (Sep 2)  ↑
                              top set @RPE 8            e1RM 116 kg → 119 kg
2. Romanian Deadlift   3×8     80 kg     120s   last: 77.5 kg 3×8 (Sep 2)       ↑
3. Leg Press           3×10   160 kg      90s   last: 160 kg 3×9 (Sep 2)
4. Standing Calf Raise 3×12    60 kg      90s   last: 57.5 kg 3×12 (Sep 2)      ↑

Four exercises, not seven. 4 sets × 240 s rest on the squat is 16 min of the 44.
e1RM is Epley from the top logged set — a trend, not a max to attempt.
```

*(Fabricated example.)*

Rules specific to this variant:

- **The main lift is slot 1.** If it is not, the block is wrong — say so.
- **Show the e1RM transition** (`116 kg → 119 kg`) on the main lift line, and name Epley
  once per session.
- **Never print a suggested max, a percentage of an untested 1RM, or an attempt.**
- The last line of the arithmetic — *"four exercises, not seven"* — stays. It is the
  line that stops someone adding three more.

### Rules for the output

- **The `last:` column is mandatory on every line.** It is what makes progression
  visible in the moment, and it is the thing that makes people trust the number above it.
- **Mark increases with `↑`.**
- **Every weight carries its unit.**
- **Never an empty weight column.** No history prints the no-history line; a
  bodyweight/minimal tier prints the progression variable.
- Show the date of the last performance — it tells the athlete at a glance whether the
  comparison is fresh.
- Name the **non-negotiable top three** and say to cut from the bottom. This is what
  stops the same three lifts being silently dropped every week.
- One line, at most, for any active pain flag — what it is and whether today touches it.
- Warm-up includes the core and mobility work. It is not decoration; it is where that
  volume lives.

### Do not

- Do not explain the programming philosophy. It is in the operating manual.
- Do not ask how they are feeling, or whether they want to modify anything.
- Do not add motivational text.
- Do not print the volume table. That is `block` and `checkin`.
- Do not print target progress. That is `checkin`.
- Do not write anything to Notion. `today` is read-only.
- Do not mention the goal mode beyond the one word in the header, unless a mode-specific
  rule fired and needs one line to explain itself.

---

## After printing

One line, then stop:

```
Log it with /gym-coach:log when you're done — "done as prescribed" is enough.
```
