# Apple Health and Apple Watch screenshots

Athletes often paste a workout summary screenshot instead of typing numbers. That is
a good trade — it takes them two seconds and it is more accurate than recall. This
page defines exactly what to take from it.

---

## 1. What is extractable

From an Apple Watch / Fitness workout summary:

| Field | Maps to | Notes |
|---|---|---|
| **Workout duration** | `Duration (min)` | Use the workout duration, not the elapsed wall-clock time, if both are shown |
| **Active calories** | `Calories` | Prefer active over total. If only total is visible, record it and **say which one it is** |
| **Total calories** | `Calories` | Only if active is not shown |
| **Average heart rate** | `Avg HR` | |
| **Peak / max heart rate** | `Peak HR` | Only if explicitly labelled. See section 3 |
| **Heart-rate zone distribution** | `Coach Notes` | Record as given, e.g. `Z1 22m / Z2 14m / Z3 5m` |
| **Rings** (Move / Exercise / Stand) | `Coach Notes` | Context only. Not a training metric |
| **Workout type** | Sanity check | If it says Outdoor Run and the athlete reported a leg day, ask |

Calories from a wrist device during resistance training are a rough estimate. Record
them because the trend is mildly interesting; never use them for a nutrition
calculation.

---

## 2. Never look for VO₂ max

**Apple Watch estimates cardio fitness only from Outdoor Walk, Outdoor Run, and
Outdoor Hike** ([Apple Support](https://support.apple.com/en-us/108790)).

Indoor workouts, gym equipment workouts, and Traditional Strength Training do not
contribute to it. **It will never appear on a lifting summary.**

Do not look for it. Do not ask for it. Do not add a field for it. Do not tell the
athlete their VO₂ max is missing — nothing is missing.

---

## 3. A chart axis is not a peak

The y-axis maximum on a heart-rate graph is a **scale bound**, chosen to make the
chart fit. It is not a measured value.

Reading `180` off the top of the axis and recording it as peak HR fabricates data that
then propagates into every check-in and audit that follows.

**If no labelled peak or max is visible, leave `Peak HR` blank and say so.**

---

## 4. Report what you could not read

> **Name any field you could not read. Never guess, never silently omit.**

A screenshot can be cropped, low-resolution, glare-washed, or in a locale that formats
numbers differently. All of those are fine — what is not fine is quietly filling a
number in.

After extracting, say plainly:

> From the screenshot: 47 min, 312 active kcal, avg HR 118.
> I couldn't read the peak HR — the zone chart is cut off at the bottom. Leaving it
> blank; tell me if you want it in.

Then write the entry with `Peak HR` empty.

---

## 5. Heart rate is never a check on effort

**Do not cross-validate the athlete's reported effort against their heart-rate data.
Ever.**

A 9/10 leg session with a Zone 1 average heart rate is not a contradiction and is not
worth a comment. Heavy leg press is a maximal local effort that barely moves heart
rate — high force, short duration, long rests, small cardiovascular demand. The same
is true of most heavy compound work.

Treating that as an inconsistency tells the athlete their own reported experience is
being audited against a wrist sensor, which is both wrong and the fastest way to stop
someone reporting honestly.

**Subjective effort is a fatigue signal. It is recorded as given, and nothing else is
done with it.**

Heart rate has exactly one legitimate use here: a **trend across comparable sessions**.
If the same session at the same loads shows a steadily rising average heart rate over
several weeks, that is worth one sentence at check-in as a possible recovery signal.
That is all.

---

## 6. Health data hygiene

- Extract the numbers, then **do not describe the image further**. A workout screenshot
  can contain a name, a date, a location, or another person in a shared activity feed.
- Never write anything from a screenshot into the log except the fields in section 1.
- If an image contains something that looks like medical data — an ECG, a blood-oxygen
  reading, a medication list, a health record — **do not transcribe it, do not interpret
  it, and say why**. That is a clinician's territory (`safety.md`).
- If a screenshot is of a third party's data, do not record it.
