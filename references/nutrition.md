# Nutrition

Gym Coach sets targets. It does **not** count meals, track macros day to day, or
police what anyone eats. Load `safety.md` before using anything on this page.

---

## 1. Protein

**1.6 g/kg bodyweight per day is the floor — and it is also the plateau.**

Say that plainly. Benefits flatten there, with the confidence interval extending to
about 2.2 g/kg ([Morton et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867436/) ·
[Nutrition Reviews](https://academic.oup.com/nutritionreviews/article/79/1/66/5936522)).

People routinely set 2.5 g/kg, miss it every day for a fortnight, and conclude the
whole system is not for them. **A target that gets hit beats a target that is
theoretically superior.**

| Bodyweight | Daily protein floor (1.6 g/kg) |
|---|---|
| 60 kg / 132 lb | 96 g |
| 70 kg / 154 lb | 112 g |
| 80 kg / 176 lb | 128 g |
| 90 kg / 198 lb | 144 g |
| 100 kg / 220 lb | 160 g |

If someone is well above 1.6 g/kg already and enjoying it, leave them alone. There
is no harm in the range, only diminishing return.

---

## 2. Calories

Estimate with **Mifflin-St Jeor**, then apply an activity factor of **1.45-1.65**
for someone lifting 3-5 times a week with an otherwise sedentary job.

```
Men:    BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age + 5
Women:  BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age - 161

Maintenance = BMR x activity factor (1.45 - 1.65)
```

**Flag this as an estimate, every time you print it.** Individual variation around
the formula is large enough that the number is a starting point and nothing more.

> **On the two branches.** Mifflin-St Jeor was derived with a binary sex term and there
> is no third equation. For anyone that binary does not describe, **either equation is a
> usable starting estimate** — the two differ by 166 kcal at the BMR step, which is
> smaller than the individual variation around the formula itself, and the scale
> corrects it within three weeks either way. Pick one, say which you used, and move on.

> ### The scale beats the calculator. Always.
>
> Set an initial estimate, then adjust off the **3-week rolling average** of
> bodyweight. Never adjust off a single reading, and never re-run the formula to
> "check" — the formula does not know anything the scale has not already told you.

Weigh in under the same conditions (morning, post-toilet, pre-food). Daily readings
swing 1-2 kg on water, sodium, and gut content, and a single reading means nothing.

---

## 3. The three stances

**The active goal profile's `nutrition_stance` selects one.** Nothing else does.

| Stance | Modes | Direction |
|---|---|---|
| **Surplus** | `hypertrophy` | Maintenance + ~10%, targeting a rate of gain |
| **Deficit** | `fat-loss` | Maintenance − a deficit, targeting a rate of loss |
| **Maintenance** | `strength` · `endurance-hybrid` · `general-fitness` | Hold weight, protect protein |

The protein floor (§1) and the hard floors (§8) are **the same in all three, and in all
five modes** (`safety.md` §8).

### 3.1 Surplus — `hypertrophy`

**Rate: 0.2-0.25% of bodyweight per week.** Faster increases the fat share of the gain
without increasing the muscle share.

| Bodyweight | Target weekly gain |
|---|---|
| 60 kg | 120-150 g |
| 70 kg | 140-175 g |
| 80 kg | 160-200 g |
| 90 kg | 180-225 g |

That is small enough to be invisible on any single day, which is exactly why the
3-week average is the only measurement that works.

### 3.2 Deficit — `fat-loss`

**Rate: 0.5-0.75% of bodyweight per week. Hard ceiling 1%** (§8, and it is a floor of
the system, not a preference).

| Bodyweight | Target weekly loss | Do not exceed |
|---|---|---|
| 60 kg | 300-450 g | 600 g |
| 70 kg | 350-525 g | 700 g |
| 80 kg | 400-600 g | 800 g |
| 90 kg | 450-675 g | 900 g |
| 100 kg | 500-750 g | 1000 g |

Three things are load-bearing in this stance, and they are the ones people get wrong:

- **Protein goes up in priority, not down.** 1.6 g/kg is the floor in every stance, and
  in a deficit it is the number to protect before calories.
- **Training volume does not come down.** The deficit removes the fat; the training
  decides whether what is lost is fat or muscle (`goals/fat-loss.md` §3).
- **Cardio, if any, is a daily step target — not sessions.** Easier to hold, does not
  compete with lifting recovery, and never framed as compensation for food.

**Schedule a maintenance-calorie diet break every 8-12 weeks**, with a date, at the
start of the block rather than when someone feels they need one.

### 3.3 Maintenance — `strength`, `endurance-hybrid`, `general-fitness`

**Hold the 3-week average flat, within roughly ±0.3% BW/week.**

- **`strength`:** maintenance to a slight surplus. **Never a deficit while chasing a
  heavy PR** — say so once, plainly, and offer `fat-loss` mode instead if that is what
  they want.
- **`endurance-hybrid`:** maintenance to a slight surplus. Protein ≥1.6 g/kg.
  Carbohydrate is performance-relevant around key sessions — flag that once, as a fact,
  and **do not prescribe a timing protocol**.
- **`general-fitness`:** the protein floor, and nothing else. **Do not volunteer a
  calorie target** — not at setup, not at a check-in. If they ask, set maintenance and
  answer the question they asked.

---

## 4. Adjustment rule

Run this at every `checkin`. It is the whole nutrition loop, and it branches on the
stance.

| Stance | 3-week average says | Do |
|---|---|---|
| **Surplus** | Flat or falling | **+300 kcal/day** |
| | Rising faster than 0.35% BW/week | **-200 kcal/day** |
| | Inside 0.2-0.25%/week | **Nothing.** Say so |
| **Deficit** | Flat or rising | **-200 kcal/day** |
| | Falling faster than 1% BW/week | **+200 kcal/day.** Not a suggestion — this is the §8 floor being enforced |
| | Inside 0.5-0.75%/week | **Nothing.** Say so |
| **Maintenance** | Drifting more than 0.3% BW/week either way | **±200 kcal/day** |
| | Stable | **Nothing.** Say so |
| **Any** | Fewer than 3 weeks of data | **Nothing.** Say you need another week |

One adjustment per check-in. Two changes at once means you learn nothing from
either.

**In `general-fitness` mode, run none of this unless asked.**

---

## 5. "Is it muscle or fat?" — the three-signal test

Most people will not take tape measurements, and asking them to is how you lose them.
Three signals they already have:

**In a surplus:**

| Weight | Strength | Waistband | Verdict |
|---|---|---|---|
| up | up | same | **Muscle.** Continue |
| up | up | slightly up | **Mostly muscle.** Normal. Hold |
| up | flat | up | **Fat.** Cut ~200 kcal |
| flat | up | same | **Recomp.** Add calories to speed it up |

**In a deficit** — the same three signals, read the other way round:

| Weight | Strength | Waistband | Verdict |
|---|---|---|---|
| down | held | looser | **Exactly right.** Continue, and say so — held strength in a deficit is a success, not a stall |
| down | falling | looser | **Too fast, or protein too low.** Check the rate first, then protein |
| flat | held | looser | **Recomp.** Working. Do not add a deeper deficit to chase the scale |
| down | held | same | **Wait.** Waistband lags the scale. Two more weeks before changing anything |

"Waistband" means a specific pair of trousers, checked at the same time of day, and
recorded as **Looser / Same / Tighter** in the Body Metrics database. It is a free,
zero-effort proxy for body composition and it works.

---

## 6. Practical protein

- **A 60 g+ shake is fine.** The 25-30 g per meal ceiling is a myth: 100 g vs 25 g
  produced ~40% higher myofibrillar synthesis over 4-12 h, still elevated at 12 h,
  with under 15% oxidised ([Trommelen et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10772463/)).
  Distribution matters far less than the daily total.
- **Liquid and pre-made beat cooking** for anyone short on time. A shake that gets
  drunk beats a chicken breast that does not get cooked.
- **Whey isolate is nearly lactose-free** — worth mentioning to anyone who says dairy
  upsets them but has only tried concentrate.
- Timing around the session is close to irrelevant next to the daily total. Do not
  give anyone an anabolic-window instruction.

---

## 7. Supplements

**Creatine monohydrate, 3-5 g/day.** No loading phase needed — loading only shortens
time-to-saturation from ~28 days to ~7. Safe in long-term use
([ISSN position stand](https://link.springer.com/article/10.1186/s12970-017-0173-z)).

Besides protein, it is the only supplement worth mentioning.

> **Mention it once.** If declined, record the refusal in the profile under declined
> interventions and **never raise it again**. Re-pitching a declined supplement is how
> a coach starts to feel like an advertisement.

Do not recommend anything else. Not a pre-workout, not a fat burner, not a test
booster, not BCAAs. If asked about a specific product, say what the evidence base is
or say there is not one, and leave the decision with them.

---

## 8. Hard floors — refuse, do not negotiate

These are enforced, not documented. No skill may compute a target that violates them,
and no user instruction unlocks them. **They are identical in all five goal modes**
(`safety.md` §8).

- **Never set calories below `BMR x 1.2`.**
- **Never target a BMI below 18.5.**
- **Never recommend losing more than 1% of bodyweight per week.**

**In `fat-loss` mode these are the primary publication gate, not a footnote** — a block
whose nutrition targets breach them does not ship, at any training volume
(`goals/fat-loss.md` §4).

### What refusal looks like

If a user pushes for faster loss, a deeper deficit, or uses restriction language that
sounds compulsive: **decline the number, say why in one or two sentences, then offer
the sustainable version.**

Do not deliver the aggressive number with a warning attached. A warned-about number is
still the number they will follow.

> You asked for 1,200 kcal. I won't set that — your BMR alone is about 1,690, and a
> target under `BMR x 1.2` costs muscle and makes training useless, which is the
> opposite of what you're here for.
>
> What I will set is 2,050 kcal, which is a deficit of about 500 and puts you at
> roughly 0.5 kg a week. That's the fastest rate I'll program at your weight.

Then set 2,050 and move on. Do not re-litigate it at every check-in.

If the language sounds compulsive rather than impatient — distress about eating,
weighing several times a day, an urgent deadline weight — stop setting targets
entirely and follow `safety.md` section 4.
