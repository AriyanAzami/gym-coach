# Body metrics entry — template

One row in the **Body Metrics** database per weigh-in. Written by `/gym-coach:log` when
the athlete reports a weight, and read by `/gym-coach:checkin` for the rolling average.

All example values are **fabricated**.

---

## Properties

| Property | Type | Example | Notes |
|---|---|---|---|
| `Entry` | Title | `2026-08-26 weigh-in` | |
| `Date` | Date | `2026-08-26` | ISO |
| `Weight` | Number | `79.8` | **Unit lives in the config (`units`), and is printed with every displayed figure.** Store the bare number here so the rolling average is computable |
| `Photos Taken` | Checkbox | ☐ | Monthly is enough |
| `Waistband Check` | Select | `Same` | Looser · Same · Tighter · Not checked |
| `Notes` | Rich text | `Ate late, high sodium` | Anything that explains an outlier |

> `Weight` is the one place a bare number is stored, because a rolling average has to
> do arithmetic on it. **Everywhere it is displayed, the unit is printed** — `79.8 kg`.
> The unit comes from the config, not from the row.

---

## Measurement protocol

State this once at setup and never nag about it again.

- **Same conditions every time**: morning, after using the toilet, before eating or
  drinking, minimal clothing.
- **Daily is best, weekly is fine, sporadic is nearly useless.** The average is the
  measurement; a single reading is noise.
- **Daily readings swing 1–2 kg** on water, sodium, carbohydrate intake, and gut
  content. That swing is not fat, and it is not worth a comment.
- **Waistband check**: the same pair of trousers, at the same time of day. It is a free
  body-composition proxy for people who will not take tape measurements — which is most
  people.
- **Photos**: monthly, same lighting, same pose, same time of day. Front, side, back.
  Nobody sees them but the athlete; they are not uploaded anywhere.

---

## What `checkin` computes from this

**The 3-week rolling average.** Nothing else drives a nutrition change.

```
Week of 2026-08-05    79.2 kg  (4 readings)
Week of 2026-08-12    79.5 kg  (5 readings)
Week of 2026-08-19    79.8 kg  (3 readings)

3-week average trend  +0.3 kg/week = +0.38% BW/week
Target                +0.16 to +0.20 kg/week (0.2-0.25% BW)

Rising faster than 0.35% BW/week  ->  -200 kcal/day
```

**With fewer than 3 weeks of data, compute nothing and say so.** "I need another week
before I'd change anything" is a real answer and a better one than a change based on
noise.

---

## The three-signal read

Presented at every check-in alongside the number, per `nutrition.md` §5:

| Weight | Strength | Waistband | Verdict |
|---|---|---|---|
| up | up | same | **Muscle.** Continue |
| up | up | slightly up | **Mostly muscle.** Normal. Hold |
| up | flat | up | **Fat.** Cut ~200 kcal |
| flat | up | same | **Recomp.** Add calories to speed it up |

"Strength" here means the logged progression trend across the block, not a one-rep max
and not a feeling.

---

## Compliance, and how to handle it

Photo and weigh-in compliance is reported as a fact, once, without pressure:

> Weigh-ins: 12 of the last 21 days. Photos: none since 2026-07-19.
> That's enough weigh-ins for the average to mean something. The photos are yours to
> use or skip.

**Do not chase it.** If someone has declined photos, that goes in the profile's
declined-interventions list and is never raised again (`safety.md` §5). If weigh-ins
drop below roughly two a week, say only that the average is no longer reliable — and
then stop making nutrition recommendations from it, rather than nagging for data.
