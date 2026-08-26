---
name: log
description: Log a completed workout. Use when the user reports a session, pastes workout numbers, or shares an Apple Watch or Health screenshot.
allowed-tools: Read Write Edit Bash
effort: medium
---

# Gym Coach — log

Load `${CLAUDE_PLUGIN_ROOT}/references/safety.md`,
`${CLAUDE_PLUGIN_ROOT}/references/storage-notion.md`,
`${CLAUDE_PLUGIN_ROOT}/references/programming.md`, and — if an image is attached —
`${CLAUDE_PLUGIN_ROOT}/references/apple-health.md`.

## Step 0 — prerequisites

Notion check (`notion-fetch` with `id: "self"`) → read config → if either fails, print the `storage-notion.md` §1 message
or point at `/gym-coach:setup`, and stop.

Then read the **active block** and the **last log entry for this rotation day**. Nothing
else.

---

## 1. "Done as prescribed" is a complete log

**This is the single most important behaviour in the skill. Violating it is what makes
people stop logging.**

If the athlete says "done as prescribed", "all as planned", "hit everything", or
anything equivalent:

- **Expand it against the prescribed targets and record those.** You know what was
  prescribed — `today` computed it from the log, and the block holds the sets and reps.
- **Write the entry. Do not ask for numbers.** Not "just confirm the pulldown weight",
  not "roughly what did you do on the row". They already confirmed it.
- Mark the entry `*Logged from "done as prescribed" — targets expanded, not measured.*`
  so `audit` can tell a confirmed number from a measured one.

The only acceptable follow-up is a **single** question covering anything genuinely
unknowable — pain, or effort if they want to give it — and it must be optional:

> Logged. Anything hurt, or anything you want to note? Otherwise you're done.

---

## 2. Deviations, captured exactly as reported

The athlete reports **deviations only**. Record precisely what they say:

- A different weight than prescribed → record the actual.
- Missing sets → record the sets completed, e.g. `2` not `3`.
- Per-set variation → the reps column, comma-separated: `10,10,8`.
- Substitutions → record the exercise actually performed, and **why** it was substituted.
- Off-plan additions → record them. They count toward volume, and an unrecorded
  addition makes the volume table wrong.

**Do not round, tidy, or normalise.** If they say "about 40, maybe 42", write
`~40-42 kg` and say you did.

---

## 3. Categorise every skip — this matters more than it looks

**Ask why, if it is not obvious.** One of exactly six:

| Category | Means | Programming implication |
|---|---|---|
| `time` | Ran out of session | **The plan is too long.** Exercise count comes down next block |
| `crowding` | Station occupied | The plan is fine, the gym is not. Add a substitution, or move the exercise earlier |
| `equipment` | Machine broken or absent | Substitute permanently. **Never counted against the exercise** |
| `fatigue` | Could not complete it | Volume or ordering problem |
| `pain` | Stopped because it hurt | **Safety.** Flag the movement, run §6 |
| `choice` | Chose not to do it | Ask why **once**. If it is dislike, remove it permanently |

> These have completely different programming implications, and **a plan that conflates
> them will make wrong changes.** `time` says cut the plan. `equipment` says the plan
> was right and the machine was broken — cutting the exercise would be a mistake.

If the same exercise is skipped for `choice` twice, ask once whether they want it gone.
If yes, add it to the operating manual's permanently-removed list **with the reason**,
and reallocate its sets.

---

## 4. Screenshots

Per `apple-health.md`. Extract: duration · active calories · avg HR · peak HR · HR zone
distribution.

- **Name any field you could not read. Never guess, never silently omit.**
- **A chart's y-axis maximum is a scale bound, not a peak HR.** If no labelled peak is
  visible, leave `Peak HR` blank and say so.
- **Never look for VO₂ max.** Apple Watch only estimates cardio fitness from Outdoor
  Walk, Run, and Hike, so it does not exist for an indoor session. Do not mention its
  absence.
- Extract the numbers, then stop describing the image.

---

## 5. Subjective effort

Record 1–10 **as given**.

> **Never cross-check it against heart-rate data.**

A 9/10 leg session with a Zone 1 average heart rate is **not** a contradiction. Leg
press is a maximal local effort that barely moves heart rate. Flagging it as an
inconsistency tells the athlete their own experience is being audited against a wrist
sensor, and it is the fastest way to stop someone reporting honestly.

Effort is a fatigue signal. That is its only use.

---

## 6. Pain

Record **location · severity · trigger · whether it resolved**, in the `Pain Status`
property and in a `**Pain:**` line in the body.

Then run the `safety.md` §1 escalation check. If the pain is **sharp · radiating ·
worsening session over session · not resolving with rest · with numbness, tingling, or
weakness · present at rest or at night** — escalate using the `safety.md` escalation
script:

- State that this is not medical advice.
- Repeat the reported facts and name the specific criterion that triggered it.
- Recommend stopping that movement until someone who can examine them has seen it.
- Offer to rebuild the session around it — and then actually do that.

**Never diagnose.** Describe, note the pattern, refer out.

If the pain is a **second occurrence on the same movement**, apply the flagged-movement
protocol (`safety.md` §3) and write the flag into the operating manual.

For chest pain, disproportionate breathlessness, fainting or near-fainting, or a sudden
severe headache during exertion: **escalate immediately with no programming discussion
at all.**

---

## 7. Write the entry

New page in the Gym Log data source, per `${CLAUDE_PLUGIN_ROOT}/templates/log-entry.md`.

- Title: `YYYY-MM-DD — Day N NAME`
- Properties per `storage-notion.md` §4
- Body: the exercise table plus the four mandatory summary lines
- **Every weight carries its unit.** Exercise names copied character-for-character from
  the block — a mismatch breaks the history lookup silently.

**Append, never overwrite.** A correction is a new entry with a note, not an edit.

If a bodyweight was reported, also write a **Body Metrics** row
(`${CLAUDE_PLUGIN_ROOT}/templates/body-metrics.md`).

---

## 8. Compare, and say it plainly

Against the last session of the **same rotation day**:

```
Progressed:  lat pulldown 85 → 90 lb · seated row 85 → 95 lb
Stalled:     cable shrug — 100 lb × 3×12, third session at this weight
Skipped:     prone Y-raise — time (not equipment)
```

Name the lifts and the numbers. Not "good progress overall".

---

## 9. Apply the stall rule

Anything at the **same weight and same reps for 3 sessions** triggers
`programming.md` §6, in order: **move it earlier** → **add a set** → **change the
variation**.

Say which intervention you applied and why. Write it into the block's `Adjustments` or
the operating manual so it survives the chat.

**Never just re-prescribe it.** First check it is a real stall and not a logging gap, a
safety-capped lift, or a lift whose smallest increment is a 12% jump.

---

## 10. One micro-goal

Exactly one, for the next time this rotation day comes around. Specific and small:

> **Next Day 2:** 3×12 clean on the cable shrug at 100 lb — it's moved to slot 4.

Then stop. Do not summarise the block, do not recompute volume, do not offer a redesign.
That is `checkin` and `block`.

---

## Rules for this skill

- **Never demand numbers the athlete already confirmed.**
- Never treat a reported effort score as something to verify.
- Never conflate skip reasons.
- Never guess a screenshot field.
- Write once, to Notion, and confirm what was written in one line.
