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

---

## Step 3 — compute every weight, fresh

**This is the core of the skill.** For each exercise in the session:

1. Find that exact lift in the last log entry for this rotation day.
2. Apply **double progression** (`programming.md` §5):
   - Hit the top of the rep range on **all** prescribed sets → **add the smallest
     available increment**, and mark it `↑`.
   - Otherwise → **same weight**, rebuild reps.
3. Check the stall rule: same weight *and* same reps for 3 sessions → apply the
   `programming.md` §6 intervention and say which one you applied and why.
4. Check `safety.md` §3: on a flagged movement, the smallest increment only, and only
   after two clean sessions at the current step.

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

---

## Step 4 — output

**Dense, scannable, no preamble.** This exact shape:

```
DAY 2 — BACK · 7 exercises · ~46 min

Non-negotiable: Lat Pulldown · Rear Delt Fly · Shrug
If short on time, cut from the bottom.

Warm-up (5 min): 2-3 min bike · 10 scapular pulldowns
  Ramp-up on lift 1 only: 50% × 8, 75% × 5

1. Lat Pulldown (wide)     3×10   90 lb    90s   last: 85 lb ×3×10 (Aug 19)  ↑
2. Seated Cable Row        3×10   95 lb    90s   last: 85 lb ×3×10 (Aug 19)  ↑
3. Rear Delt Fly           3×12   85 lb    60s   last: 85 lb ×3×10 (Aug 15)
4. Cable Shrug             3×12   100 lb   60s   last: 100 lb ×3×12 (Aug 19) — 3rd session at this weight, moved up from slot 6
5. Chest-Supported Row     3×12   70 lb    60s   last: 70 lb ×3×11 (Aug 19)
6. Prone Y-Raise           3×15   10 lb    60s   last: no logged history — start conservative and record it
7. Hammer Curl             3×12   30 lb    60s   last: 30 lb ×3×12 (Aug 19)  ↑

⚠️ Left shoulder: flagged on chest fly at 100 lb. Nothing today touches it.
```

### Rules for the output

- **The `last:` column is mandatory on every line.** It is what makes progression
  visible in the moment, and it is the thing that makes people trust the number above it.
- **Mark increases with `↑`.**
- **Every weight carries its unit.**
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
- Do not write anything to Notion. `today` is read-only.

---

## After printing

One line, then stop:

```
Log it with /gym-coach:log when you're done — "done as prescribed" is enough.
```
