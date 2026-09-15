# Flousey — Spec Audit, Enrichment & Recommendations

> Companion to `Project_Spec.md`. Where the two disagree, this document records the decision taken
> for the build and why. Section numbers like §26 refer to `Project_Spec.md`.

---

## 0. Verdict

The concept is strong and well-scoped. The "start anywhere" onboarding, the difference between *money that
exists* and *money that is safe to spend*, and advice that never shames the user make it a real product,
not another budgeting spreadsheet.

The spec is a product vision, though, not yet a buildable engine definition. The formulas are sound in the
simple case but undefined in the cases users will hit in their first week:

- spending today
- paying a bill
- moving savings
- income arriving late
- protected money exceeding the balance
- a manual balance drifting from the real bank balance

Several screens also disagree with each other (month vs. cycle, categories, rules vs. settings).

The most important decisions below:

| # | Decision | Why |
|---|----------|-----|
| 1 | **Today's safe amount is fixed at the start of the day.** Spending lowers what's *left*, not the target. | Otherwise every coffee shrinks the headline number, which feels like punishment and is confusing. |
| 2 | **Rollover default = "spread"**, not 50% (§26). | Recalculation already spreads unspent money over the remaining days. A 50% rule needs a place for the other 50%. |
| 3 | **Paying a bill or moving savings is neutral to flexible money.** | Without this, every bill payment is counted twice (§12 "Bills" category + §7.3 protection). |
| 4 | **Add "Update balance" (reconcile).** | Manual apps drift. This is the #1 reason people abandon manual trackers. |
| 5 | **Handle "protected > balance" explicitly** (Scenario 3). | The spec never defines negative flexible money. |
| 6 | **Local-first (SQLite) now, Firebase later for sync/backup.** | §57 requires offline. The Firebase JS SDK has no persistent offline cache on React Native. |
| 7 | **Money stored as integer minor units** (TND = 1/1000). | Floating-point errors in money apps are unacceptable; TND has 3 decimals. |
| 8 | **Navigation: Today · Activity · Insights · Plan.** | Routines and Rules are set-and-forget and don't deserve two of four tabs. |

---

## 1. What's already strong (keep)

- **Single hero question**: "How much can I safely spend today?" It is measurable and testable.
- **Mid-cycle start without reconstructing history**: a genuine differentiator.
- **Routines are expectations, not transactions** (§11, §46). This is correct and keeps the ledger honest.
- **Deterministic engine, AI only as an explainer later** (§44–45). The right architecture for trust.
- **Non-judgmental copy** (§21). This should be a written style guide, not just a principle (see §5.6 below).
- **Validation scenarios** (§59). These become the engine's unit-test suite (done — see `src/domain/__tests__`).

---

## 2. Gaps in the financial logic (and how they're resolved)

### 2.1 What does "safe to spend today" mean once you've spent something?

The spec says `Flexible / Remaining days`, recalculated live. If computed live after each expense:

```
Morning: 590 / 16 = 36.9
Buy lunch (12): 578 / 16 = 36.1   ← the headline dropped by 0.8, not 12
```

The user can't tell how much is left today. **Resolution:**

```
flexibleNow        = balance − billsDueBeforeIncome − savingsStillToSetAside − minimumBalance
flexibleStartOfDay = flexibleNow + spentToday
daysRemaining      = max(1, nextIncomeDate − today)          // today counts; payday itself doesn't
dailyAllowance     = floor(flexibleStartOfDay / daysRemaining) // fixed for the whole day
remainingToday     = dailyAllowance − spentToday              // can go negative
upcomingPace       = flexibleNow / (daysRemaining − 1)        // "keep the next few days around X"
```

- Income received today raises today's allowance immediately (it's part of `flexibleNow`).
- Spending today never changes today's allowance. It changes tomorrow's.
- The spec's "Try keeping the next few days around 30 TND" is simply `upcomingPace`. There is one formula
  everywhere, so every piece of advice is explainable.

### 2.2 Rollover (§26) conflicts with dynamic recalculation (§9)

With recalculation, unspent money *automatically* rolls over, spread evenly across the remaining days:

```
40/day, spend 20 → 20 unspent → tomorrow = +20/15 days ≈ 41.3 (not 60, not 50)
```

- "Full rollover → tomorrow 60" would require piling all savings onto one day. That encourages exactly the
  "I didn't spend yesterday, so I can spend everything today" behaviour the spec wants to avoid.
- "50% rollover" only works if the other 50% goes somewhere: a savings cushion.

**Resolution:** the MVP ships **spread** (the natural math, clearly explained in the breakdown screen). P1 adds
an optional rule: *"Move X% of what I don't spend to savings at the end of each day/week"*. That is what 50%
rollover actually means, expressed honestly.

### 2.3 Double counting bills

The spec protects upcoming bills (§7.3) *and* lists "Bills" as an expense category (§13). If rent is protected
and the user logs rent as an expense, it is subtracted twice.

**Resolution:**
- Bills are paid through **"Pay bill"**, which creates a `bill_payment` transaction linked to that bill
  occurrence. The balance drops by 700, the protection drops by 700, and flexible money is unchanged. ✅
- "Bills" is removed from the expense category picker.
- Recurring bills generate **occurrences** per cycle (`billId + dueDate`), so a paid September rent never blocks
  October's.

### 2.4 Which bills are protected?

Undefined in the spec. **Resolution:** protect every unpaid occurrence with `cycleStart ≤ dueDate ≤ nextIncomeDate`
(inclusive), plus one-off bills with no date until paid.

- *Inclusive* is conservative: if the salary is a day late, rent due on payday is still covered.
- **A due date that has already passed is never guessed.** When a bill is added (at onboarding or later) with a
  due date before today, the app asks *"This month's payment was due Sep 5 — already paid?"*:
  - **Yes** records the payment. It is history-only if it was before you started tracking.
  - **Not yet** keeps it protected and shows it as **overdue** with a Pay button.
- Unpaid recurring occurrences from up to one month before the cycle start stay protected as overdue, so a missed
  payment carries into the next cycle instead of silently disappearing.

### 2.5 Savings: "reserve", "goal" or "transfer"?

§7.4 "monthly savings goal 300", §15 "savings I want to protect 100", and the data model's
`SavingsGoal{target,current,deadline}` are three different concepts.

**Resolution for the MVP:**
- **Savings this cycle** = an amount kept protected inside your balance.
- **"I moved it to savings"** records a `savings_transfer`. The balance drops, the reserve drops by the same
  amount, and flexible money is unchanged.
- Named goals with targets/deadlines ("Summer trip 1,500 by June") are P1, built on top of this.

### 2.6 Protected money exceeds balance (Scenario 3 — "start with very little money")

`900 − 700 rent − 300 savings − 150 buffer = −250`. The spec never says what happens.

**Resolution:** a dedicated state ("Your plan needs a small adjustment"). The copy shows the exact gap and the
levers: lower savings this cycle, lower the minimum balance, move a bill after payday. If even the bills
exceed the balance, it says that plainly. The safe amount shows 0; it never shows a negative number.

### 2.7 Income date passes and the income hasn't arrived

`daysRemaining` hits 0 and becomes a division by zero. **Resolution:**
- On/after the income date, Today shows **"Is your income here?"** with two answers:
  - **"Yes, add it"** → record income → cycle summary → start next cycle.
  - **"Not yet"** → push the expected date by 1 day (the plan re-spreads automatically).
- The engine clamps `daysRemaining ≥ 1` and extends the bill window to today.

### 2.8 Expected (not yet received) income

§7.2 lists "Freelance 300 on Sep 20" as upcoming income, but the formulas ignore it.

**Resolution:** unconfirmed income is **not** counted in safe-to-spend (being conservative is the product
promise). It can be *displayed*: "+300 expected Sep 20 — your pace rises to ~53 when it arrives" (P1).

### 2.9 Status thresholds were undefined

The spec names four statuses but gives no thresholds. Comparing spending pace with the safe pace alone isn't
enough: a pace of 3 TND/day would be "on track" as long as you spend less than 3. The color therefore also compares
the safe pace with **what a normal day costs**: your routines' average when you have routines, otherwise your own
figure (Plan → Protections), defaulting to 15 TND.

Rules are checked in this order; the first match wins (all constants live in `src/domain/engine.ts`):

| Color | Label | Rule |
|---|---|---|
| 🔴 | Plan needs adjusting | protected money > balance |
| 🔴 | Nothing left to spend | no flexible money today or for the coming days |
| 🔴 | Using protected money | today's spending went into protected money |
| 🔴 | Balance lower than tracked | untracked spending removed more than **35%** of the daily pace |
| 🔴 | May run short | recent pace > **125%** of the safe pace |
| 🔴 | Very tight | safe pace < **half a normal day** |
| 🟡 | Balance lower than tracked | untracked spending removed **10–35%** of the daily pace |
| 🟡 | Spending faster | recent pace > **105%** of the safe pace |
| 🟡 | Over today | spent more than today's amount |
| 🟡 | Almost used today | less than **20%** of today's amount left *and* less than a normal day |
| 🟡 | Over yesterday | (no pace yet) yesterday went over the pace |
| 🟡 | Tight | safe pace < a normal day |
| 🟢 | On track | safe pace ≥ a normal day |
| 🟢 | Breathing room | safe pace ≥ **1.5×** a normal day |

**Recent pace** = the average of discretionary spending over the last **7 full tracked days**, only once at least
**3** days exist. A mid-month user has no history, so the app doesn't pretend to know their pace.

### 2.10 Routines overlap

"Workday" (Mon–Fri) and "Gym day" (Mon/Wed) would double-count transport on Mondays.

**Resolution (MVP):** each weekday belongs to **at most one routine** ("day type"). Assigning Monday to Gym Day
removes it from Workday. P1: "extras" routines that add on top ("+ gym session 15").

Expected spending until payday is summed **day by day** using each weekday's routine. This is more accurate than
comparing a single "normal day" when the remaining days are mostly weekend.

### 2.11 Balance drift (missing feature, critical)

In every manual tracker, the app's balance and the bank balance diverge within a week (a forgotten taxi, cash
given to family).

**Resolution:**
- **"Update balance"**: the user types what their account actually shows, and the app records an `adjustment`
  ("Untracked spending −35").
- Adjustments are included in the monthly picture but excluded from the pace (they would spike "today").
- P1: a gentle weekly nudge: *"Does 742 TND still match your account?"*

### 2.12 Past spending entered at onboarding

Past expenses are already reflected in the balance the user typed. Rule: any expense dated **before the opening
date** is stored with `countsToBalance = false`. It feeds *Insights* ("where did my money go") but never the
balance or the pace. "Enter an approximate amount" is simply one such entry in category *Other*.

### 2.13 Irregular income (freelancers, students)

"When is your next income?" doesn't apply to them. **Resolution:** a frequency option **"No fixed income"**; the
question becomes *"Make my money last until…"*. It is the same engine with a different label. This matters in
Tunisia, where a large share of income is informal or irregular.

---

## 3. Inconsistencies in the spec

| Where | Issue | Decision |
|---|---|---|
| §27 Month vs §32 Cycle | "September" but the plan runs payday→payday (Sep 30 → Oct 30). | **Insights shows the cycle** ("Sep 14 – Sep 30"). Calendar-month view is P2. |
| §27 | The month summary has no starting balance; a mid-month user started with 900 and no income. | Summary = *Started with + Income − Spending − Bills − Moved to savings ± Adjustments = Now*. |
| §13 vs §27 vs §34 | Categories: "Entertainment" vs "Fun", "Housing" and "Small spending" appear only in examples, "Bills" is a category. | One list: Food, Coffee, Groceries, Transport, Shopping, Fun, Health, Gym, Household, Other. Bills are separate. |
| §17 vs §61 | Two heroes: "1,240 available" and "42 safe today". | **Safe/left today is the hero**; the balance is a secondary, tappable line. |
| §24–25 | "Rules" mix protections (min balance, savings), behaviours (weekend limit) and settings (rollover). | Plan tab groups them: **Protections** (feed the engine) · **Income rule** (default split for unexpected money) · **Limits** (advisory, P1). |
| §50 | 8 onboarding screens; "new cycle vs. mid-cycle" asks the same questions either way. | **5 steps**, no fork. Past spending becomes an optional card after setup. |
| §36 | `Income` and `Expense` are separate, `Rule.value: number` can't express "weekend limit", `Cycle` has no savings or state. | Unified `Transaction` ledger with `kind`; see §4. |
| §14 of the spec is numbered twice, and §55–56 are missing | Editorial only. | — |

---

## 4. Revised data model (implemented in `src/domain/types.ts`)

```ts
Settings    { currency, openingBalance, openingDate, minimumBalance, unexpectedIncomeSavePercent, onboarded }
Cycle       { id, startDate, nextIncomeDate, expectedIncome?, incomeLabel, frequency, savingsTarget, closedAt? }
Transaction { id, kind: expense|income|bill_payment|savings_transfer|adjustment,
              amount /* signed minor units: −money out, +money in */,
              category?, note?, date /* 'YYYY-MM-DD' local */, billId?, billDueDate?,
              countsToBalance, createdAt }
Bill        { id, name, emoji, amount, recurring, dueDay? /* monthly */, dueDate? /* one-off */, archived }
Routine     { id, name, emoji, weekdays: number[], items: RoutineItem[], enabled }
RoutineItem { id, name, amount, category }
```

Principles:
- **The balance is derived**, never stored: `openingBalance + Σ transactions.amount (countsToBalance)`. Editing
  or deleting any transaction stays consistent automatically.
- **Dates are local calendar strings.** A timestamp would push a 23:30 coffee into the next day in UTC.
- **Amounts are integers in minor units.** `12.500 TND` is stored as `12500`.
- `User.id` isn't needed until sync exists.

---

## 5. UX recommendations

### 5.1 Information architecture

```
┌────────────────────────────────────────────┐
│  Today  │  Activity  │  Insights  │  Plan  │
└────────────────────────────────────────────┘
```

- **Today**: the hero, status, advice, quick actions, bills due soon, routine quick-add, today's list.
- **Activity**: full history grouped by day, filterable, with edit/delete.
- **Insights**: this cycle's story: where the money went, actual vs. expected, past cycles.
- **Plan**: everything that *shapes* the number: payday, balance, bills, protections (rules), routines, settings.
- Primary actions (**Expense**, **Money**, **What if?**) sit directly under the hero. They are reachable in one
  tap and never hidden behind the tab bar.

### 5.2 Today screen: the 2-second test

1. **Hero number = "left today"** (equal to "safe today" until the first expense). Caption: "of 42 TND safe
   today" with a thin progress bar.
2. **Over today** → the number shows `0` with a warm amber line "12 TND past today's pace — the coming days adjust
   to 31". It is never red, and it never says "exceeded".
3. **Status pill + one-sentence advice**, with an optional suggestion line.
4. **Tap the hero → "How we got this number"** breakdown (balance → minus bills/savings/buffer → flexible ÷ days).
   Transparency is a stated value; this screen delivers it.
5. A context row: *16 days until payday* · *1,240 TND in account* (tap → update balance) · *Normal day 31*.

### 5.3 Make logging effortless (retention lives here)

- **Routine quick-add chips**: *"Your Workday — tap when it happens: ☕ Coffee 4 · 🍔 Lunch 12 · 🚕 Transport 8"*.
  One tap records a real expense, and an *Undo* toast appears. This is the killer link between routines and
  actual spending, and it still never deducts anything automatically. **The highest-leverage UX idea in this
  audit.**
- The Add Expense amount field autofocuses with a decimal keypad, categories are one-tap chips, and dates are
  "Today / Yesterday / Pick". Target: **< 4 seconds** from tap to saved.
- A live preview in the form: *"Left today: 24 → 9"*. Consequences are visible *before* saving (a mini what-if).
- **Undo toasts instead of confirmation dialogs** for add/delete.
- Haptic feedback on save.

### 5.4 Onboarding (5 steps, < 60 seconds)

1. **Money now**: "Cash + bank — whatever you can spend from. No need to go back to the 1st."
2. **Next income**: quick date chips + calendar, optional amount, frequency (monthly / every 2 weeks / weekly /
   no fixed income).
3. **Payments still coming before {date}**: preset chips (🏠 Rent, 💡 Electricity, 💧 Water, 🌐 Internet, 📱 Phone,
   📺 Subscriptions…). Each has an amount and an optional "every month on day __".
4. **Protect**: savings this cycle + minimum balance, with suggestion chips.
5. **Your first plan**: Available → Protected → Flexible → **Safe daily pace**, plus a status.

A **running "safe pace" preview** is pinned during steps 3–4, so the user watches their plan take shape.
Routines and past spending are deferred to friendly cards on Today ("What does a normal day cost you?").

### 5.5 Empty & edge states

- New user: never show "No data". Today says *"Nothing logged yet today. Add expenses as they happen — it takes a
  few seconds."*
- Income day: the *"Is your income here?"* banner (see 2.7).
- Protected > balance: an adjustment card with concrete levers (see 2.6).

### 5.6 Voice & copy style guide

| Avoid | Prefer |
|---|---|
| Budget exceeded! | You've gone past today's pace. The coming days adjust to 31. |
| You failed / bad spending | You're spending a bit faster than your pace. |
| You can't afford this | This would dip into your protected money. |
| Balance: 900 | You have 900. After protecting bills and savings, you can spend about 34/day. |

Rules: second person, no exclamation marks on warnings, always pair a problem with a next step, round money to
whole units in advice.

### 5.7 Visual design

- Calm, trustworthy palette with a deep green brand colour. Status colours are **green / amber / coral** and are
  never the only signal: an emoji and a label always accompany them (colour-blind safe).
- Large tabular numerals for money; dark mode from day one.
- Spacious cards and one primary action per screen.

### 5.8 Notifications (P1 — local only)

At most one notification per day, and the user chooses the time:
- **Morning**: "🟢 You can spend about 42 TND today."
- **Evening (most important for a manual app)**: "Anything to log from today?". Skipped if they logged today.
- **Bill in 3 days**: "🏠 Rent is due Thursday — already protected in your plan."
- **Income day**: "💰 Is your salary here?"

### 5.9 Privacy & trust

- The app works fully offline and the data never leaves the phone (MVP). Say so in onboarding: it's a feature.
- P1: app lock (biometrics via `expo-local-authentication`) and a "hide amounts" toggle for use in public.
- Never log amounts to analytics/crash reports.

---

## 6. Enrichment brainstorm (prioritized)

| Idea | Value | Priority |
|---|---|---|
| Routine quick-add chips | Makes logging 1-tap; ties routines to reality | **MVP (built)** |
| Update balance / reconcile | Stops drift, keeps trust | **MVP (built)** |
| "How we got this number" breakdown | Transparency | **MVP (built)** |
| Income-day flow + cycle summary | Closes the loop (§32) | **MVP (built)** |
| Unexpected-income split (save X%) | §42 | **MVP (built)** |
| Evening log reminder | Retention for manual apps | P1 |
| Named savings goals & sinking funds ("Aïd", "Rentrée scolaire", "Summer") | Tunisian seasonal spikes are predictable; protect for them monthly | P1 |
| Expected income display ("+300 on Sep 20") | §7.2 without risk | P1 |
| Weekend / category soft limits | §24 | P1 |
| Weekly check-in ("Does 742 still match?") | Drift | P1 |
| FR / Arabic (Tunisian Derja) + RTL | Local market fit; "Floussi" is a Derja name | P1 |
| Cash vs. card "pockets" | Cash-heavy economy | P2 |
| Money lent / borrowed ("Sami owes me 50") | Very common socially; affects real available money | P2 |
| Shared household plan | §53 later | P2 |
| AI explainer over engine output | §45 | P2 |
| SMS bank notification parsing (Android) | Semi-automatic logging without Open Banking | P2 |

---

## 7. Technology decision: why local-first before Firebase

You suggested **React + Firebase for simplicity**. The project is already **Expo SDK 57 / React Native**, which is
React, so the UI side matches. For data, I recommend **not** starting on Firebase:

1. **Offline is a hard requirement (§57).** The Firebase **JS SDK** on React Native has no persistent Firestore
   cache (IndexedDB isn't available). Data entered offline can be lost if the app is killed before it syncs.
   The native **React Native Firebase** SDK does persist, but adds native setup and a Google services config.
2. **Auth before value hurts onboarding.** A sign-up screen before "your safe pace is 34/day" costs conversions.
   The spec's time-to-value is the product.
3. **Privacy positioning.** "Your money data stays on your phone" is a selling point for a finance app,
   especially before you have a privacy policy/DPA in place.
4. **Cost of change is low.** Every write goes through one store (`src/store/app-store.ts`) backed by SQLite.
   Sync can be added behind it without touching screens or the engine.

**Recommended path:**
- **Now:** Expo + TypeScript + `expo-sqlite` (source of truth) + Zustand + a pure TS engine with Jest tests.
- **Phase 2 (sync/backup):** React Native Firebase: Auth (anonymous → link Google/Apple/email) + Firestore with
  native offline persistence. Treat Firestore as a replica of the local ledger (append-only transactions sync
  cleanly), Crashlytics without financial payloads.
- **Phase 3:** a Cloud Function for the AI explainer, sending engine *outputs*, not raw ledgers (§58).

---

## 8. Build status (first pass)

Implemented in this pass:
- `src/domain/`: dates, money (minor units), categories, bills (occurrences), **engine**, advice copy, what-if,
  insights. The domain is pure TypeScript, has no React imports, and is covered by Jest tests that include the
  spec's worked example (§48) and the validation scenarios (§59).
- `src/data/db.ts`: SQLite schema + migrations; `src/store/app-store.ts`: all actions.
- Screens: Onboarding (5 steps), Today, Activity, Insights, Plan, Add/Edit expense, Add money (with split and
  income-day flow), What-if, Update balance, Breakdown, Pay bill, Bill editor, Routine editor, Protections,
  Payday editor, Cycle summary → next cycle.

Next:
1. Local notifications (morning pace + evening log reminder).
2. Named savings goals / sinking funds.
3. i18n scaffolding (FR/AR), then RTL.
4. Expected income display and soft limits.
5. App lock + hide amounts.
6. Firebase sync (phase 2).

---

## 9. Open questions for you

1. **Primary market & language:** Tunisia first (TND, FR/Derja)? That affects copy, presets and the P1 i18n work.
2. **Cash:** should "money I have" explicitly separate cash and bank, or stay one pool for the MVP (current)?
3. **Salary lateness:** protect bills due *on* payday (current, conservative) or only bills due *before* it?
4. **Firebase timing:** is cloud backup needed for your own test cycle, or is local-only fine until validation?
