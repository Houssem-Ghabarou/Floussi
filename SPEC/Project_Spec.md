# Money Coach — MVP Product Specification

## 1. Product Overview

### Working concept

A simple personal money-management app that answers one main question:

> "Given the money I have right now, my upcoming bills, my savings goals, my normal routines, and the days until my next income, how much can I safely spend?"

The app is NOT a bank.

It does not move money.

It does not automatically deduct money.

For the MVP, everything is entered manually.

The app acts as a personal money coach:

- User tells the app what money they have.
- User tells the app what money is coming.
- User tells the app what bills are coming.
- User tells the app what they want to save.
- User creates normal spending routines.
- User manually records what they actually spend.
- The app continuously recalculates their situation.
- The app advises the user how much they can reasonably spend.

---

# 2. Core Problem

People often don't know where their money goes.

The real problem is not necessarily:

> "I need a complicated budgeting system."

It is:

> "I have money right now, I spend money every day, I have bills coming, and I don't know if I'm spending too much to make it until payday."

The app should therefore focus on:

- What do I have now?
- What do I need to keep?
- What bills are coming?
- How much do I want to save?
- How much can I safely spend?
- Am I spending too quickly?
- Where is my money going?
- Can I afford this purchase?
- Will I make it to my next income?

---

# 3. Core Product Promise

## Main promise

> Know what you can spend today and make your money last until your next income.

Alternative positioning:

> Make your money last until payday.

The app should feel like:

> "Someone is helping me manage my month."

Not:

> "I'm filling out accounting spreadsheets."

---

# 4. Product Philosophy

The app should be:

- Simple
- Fast
- Personal
- Non-judgmental
- Transparent
- Practical
- Flexible
- Manual-first
- Advice-oriented

The app should NOT tell users:

> "You are not allowed to spend this."

Instead:

> "Based on your current situation, spending this much would make the rest of the month tighter."

The user always remains in control.

---

# 5. Important MVP Principle

## Users do NOT have to start on the first day of the month.

This is critical.

A user can download the app on:

- September 3
- September 14
- September 22
- Any day

They may have already spent a lot of money.

Example:

Today is September 14.

The user says:

```text
Money I have now:
900 TND

Next salary:
September 30

Bills remaining:
150 TND

Savings I want to protect:
100 TND

Minimum balance:
100 TND
```

The app starts from that situation.

It does NOT require the user to reconstruct everything they spent since September 1.

The user may optionally enter previous spending, but it is not required.

6. Core User Model

The app needs to understand five main things:

Money available now
Money coming later
Money that must be protected
Normal spending behavior
Actual spending

From these, it calculates:

Safe spending pace

7. Main Financial Concepts
   7.1 Current Money

The amount the user says they currently have available.

Example:

Current money:
1,240 TND
7.2 Upcoming Income

Money expected later.

Examples:

Salary:
2,500 TND
September 30

or:

Freelance:
300 TND
September 20

The app supports multiple income sources.

7.3 Bills

Money that the user needs to pay.

Examples:

Rent:
700 TND

Internet:
50 TND

Electricity:
80 TND

Phone:
30 TND

Bills can be:

One-time
Recurring
Fixed
Variable
7.4 Savings

Money the user wants to protect.

Example:

Monthly savings goal:
300 TND

The app treats this as protected money.

7.5 Minimum Balance

The user can define a minimum amount they never want to fall below.

Example:

Minimum balance:
150 TND

The app should reserve this amount in calculations.

7.6 Flexible Money

Flexible money is what remains after protecting:

Upcoming bills
Savings
Minimum balance

Example:

Current money: 1,240
Bills: -300
Savings: -200
Minimum balance: -150

---

Flexible money: 590 8. Safe Daily Spending

Basic calculation:

Flexible Money / Remaining Days

Example:

Flexible money:
590 TND

Days until next income:
16

590 / 16 = 36.87

The app displays:

SAFE TO SPEND TODAY
37 TND

This is the basic calculation.

But the final recommendation can also consider:

Actual spending pace
Expected routine spending
Upcoming bills
User rules
Upcoming income
Rollover preference 9. The App Must Be Dynamic

The daily amount should NOT stay fixed.

Example:

Monday:

Safe:
40 TND

Spent:
20 TND

Tuesday might become:

Safe:
42 TND

If the user spends:

60 TND

the app recalculates.

Instead of saying:

"Budget exceeded."

It says:

"You're spending faster than your sustainable pace. Keeping the next few days around 30 TND should bring you back on track."

10. Routines

Routines are one of the important differentiators of the product.

The user can tell the app what a normal day looks like.

Example:

Workday
Coffee:
4 TND

Lunch:
12 TND

Transport:
8 TND

Normal workday:

24 TND
Weekend
Restaurant:
30 TND

Coffee:
5 TND

Normal weekend:

35 TND
Gym Day
Transport:
8 TND

Food:
15 TND

Normal gym day:

23 TND 11. Important Routine Rule

Routines are NOT automatic expenses.

If the user says:

Coffee = 4 TND every workday

the app does NOT automatically subtract 4 TND.

Instead it says:

Your normal workday usually costs around 24 TND.

If the user actually buys coffee:

-4 TND
Coffee

they manually record it.

This keeps the MVP simple and prevents fake transactions.

12. Actual Expenses

The user manually records what they really spend.

Example:

- Add Expense

Amount:
15 TND

Category:
Food

Optional note:
Lunch

SAVE

After saving:

Current balance decreases by 15 TND.

Daily recommendation recalculates. 13. Expense Categories

Default categories:

Food
Coffee
Transport
Shopping
Entertainment
Health
Gym
Household
Bills
Other

Users can eventually create custom categories.

14. Add Income

The user can add any money they receive.

Examples:

Salary
Freelance
Side job
Sold item
Gift
Bonus
Reimbursement
Someone paid them back
Other

Example:

- Add Money

Amount:
300 TND

Source:
Freelance

Date:
Today

SAVE

The app recalculates immediately.

Example:

Before:

Safe daily:
37 TND

After adding 300 TND:

Safe daily:
55 TND

The app can say:

You added 300 TND. Your safe spending pace increased from 37 TND to 55 TND.

15. Mid-Month Onboarding

This is a major part of the MVP.

First question:

Where are you starting from?

Options:

Start of a new month

or

I'm already in the middle of my month
Mid-Month Flow
Step 1

How much money do you have right now?

900 TND
Step 2

When is your next income?

September 30
Step 3

What important payments are still coming?

Internet:
50

Other:
100
Step 4

How much do you want to protect?

Savings:
100

Emergency/minimum:
100
Optional

Do you want to tell us what you've already spent this month?

Options:

Enter expenses individually

or:

Enter an approximate amount

or:

Skip

The user can immediately start using the app.

16. Why Previous Spending Is Optional

If the user has:

900 TND

right now, the most important information is:

They have 900 TND now.

It is not necessary to know every expense from the previous two weeks to calculate their future situation.

Previous spending becomes useful for:

Monthly history
Spending analysis
Routine learning
Understanding where money went

But it should never block onboarding.

17. Home Screen

The Home screen is the most important screen.

The user should understand their situation within 2 seconds.

Example:

---

        SEPTEMBER 14

        1,240 TND
        available

       SAFE TO SPEND

           42 TND
           TODAY

       🟢 You're on track

---

16 days until payday

Your normal day 31 TND
Spent today 18 TND
Remaining today 24 TND

---

TODAY

🍔 Lunch 12 TND
☕ Coffee 4 TND
🚕 Transport 8 TND

---

        + ADD EXPENSE

---

The hero element is:

SAFE TO SPEND TODAY

18. Home Screen Information Hierarchy

Priority:

1. Safe spending number
   42 TND
2. Status
   You're on track
3. Days until income
   16 days until payday
4. Today's actual spending
   Spent today:
   18 TND
5. Routine comparison
   Normal day:
   31 TND
6. Transactions

Show today's expenses.

19. Status System

The app uses simple statuses.

Green
🟢 You're on track

User's spending pace is sustainable.

Yellow
🟡 You're spending faster than usual

User is spending more than the sustainable pace but can recover.

Red
🔴 You may run short

At the current pace, the user may exhaust flexible money before their next income.

Comfortable
🟢 You have breathing room

User is spending significantly below their sustainable pace.

20. Advice

Advice should be short and understandable.

Example:

🟢 You're doing fine.

Your normal day costs around 31 TND.
Your safe pace is 42 TND.

You have around 11 TND/day of flexibility.

Yellow example:

🟡 You're spending faster than your normal pace.

Your average is 47 TND/day.
Your sustainable pace is 38 TND/day.

Try keeping the next few days around 30 TND.

Red example:

🔴 You may run short.

At your current spending pace,
you may use your flexible money
before your next income.

Recommended pace:
27 TND/day. 21. The App Should Not Shame Users

Avoid:

You failed.
Bad spending.
Budget exceeded!

Prefer:

You're spending faster than your sustainable pace.

You can recover by slowing down slightly
over the next few days.

The app should feel supportive.

22. What-If Feature

The user can ask:

Can I afford this?

This does NOT record an expense.

Example:

WHAT IF?

I spend:

180 TND

Current safe pace:
42 TND/day

After purchase:
31 TND/day

Result:

🟡 Possible, but it will make the
rest of the month tighter.

Your bills and savings would
still be protected.

Buttons:

CANCEL
RECORD PURCHASE

If the user records it, then it becomes an actual expense.

23. What-If Examples

User:

I want to spend 50 TND.

App:

🟢 Looks comfortable.

Your safe pace would remain
around 40 TND/day.

User:

I want to spend 250 TND.

App:

🔴 This would significantly reduce
your daily flexibility.

Safe pace:
42 → 26 TND/day

This gives the user useful context before spending.

24. Rules

Users can define personal financial rules.

Examples:

Always keep at least 200 TND.

Save 300 TND every month.

Protect my rent money.

Save 50% of unexpected income.

Keep weekends under 100 TND.

Only 50% of unused daily allowance rolls over.

The MVP can provide predefined rule types.

A full custom rule programming system is unnecessary.

25. Example Rules
    Minimum Balance
    Never go below:
    200 TND
    Savings
    Save:
    300 TND
    Unexpected Income
    Save:
    50%
    Weekend Limit
    Maximum:
    100 TND
    Rollover
    50% of unused daily amount rolls over
26. Rollover

Example:

Daily safe amount:

40 TND

User spends:

20 TND

Unused:

20 TND

Possible rollover modes:

No rollover

Tomorrow:

40 TND
Full rollover

Tomorrow:

60 TND
Partial rollover

50% rollover:

50 TND

Recommended MVP default:

50% rollover

This rewards good spending without making the user think:

"I didn't spend yesterday, so I can spend everything today."

27. Month Screen

The Month screen shows where the money went.

Example:

SEPTEMBER

Income
+2,800 TND

Actual spending
-1,460 TND

Bills
-830 TND

Savings
-300 TND

Remaining
210 TND

Then:

WHERE YOUR MONEY WENT

🍔 Food 420
🏠 Housing 830
🚕 Transport 110
☕ Small spending 65
🛍 Shopping 35 28. Actual vs Expected

This is an important part of the product.

Example:

FOOD

Expected:
380 TND

Actual:
420 TND

Difference:
+40 TND

Another:

TRANSPORT

Expected:
130 TND

Actual:
110 TND

Difference:
-20 TND

The app can tell the user:

You spent 40 TND more on food than your normal routine predicted.

29. Routine Screen

Navigation:

Today
Month
Routine
Rules

Routine screen:

MY ROUTINES

☀️ Workday

Coffee 4 TND
Lunch 12 TND
Transport 8 TND

Normal total:
24 TND

🏠 Weekend

Food 30 TND
Coffee 5 TND

Normal total:
35 TND

🏋️ Gym Day

Transport 8 TND
Food 15 TND

Normal total:
23 TND

Actions:

- Add Routine
  Edit
  Duplicate
  Disable

30. Rules Screen
    MY RULES

🛟 Minimum balance
150 TND

💰 Savings goal
300 TND

🏠 Protect rent
700 TND

🔄 Rollover
50%

- Add Rule

31. Transaction History
    SEPTEMBER 14

-12 🍔 Lunch
-4 ☕ Coffee
-8 🚕 Transport

SEPTEMBER 13

-30 🍔 Dinner
-5 ☕ Coffee
+300 💻 Freelance

Transactions can be:

Edited
Deleted
Categorized
Reassigned 32. End-of-Cycle Summary

When the next income arrives:

YOUR MONTH

Income:
2,800 TND

Spent:
2,190 TND

Saved:
610 TND

Finished with:
210 TND

Then:

YOUR NORMAL DAY

Expected:
31 TND

Actual:
34 TND

Then:

BIGGEST CATEGORY

Food:
520 TND

Then:

You spent 80 TND more on food
than your normal routine predicted.

Finally:

START NEXT CYCLE

The user keeps their routines and rules.

33. Main Navigation

Recommended MVP:

┌───────────────────────────────────┐
│ │
│ CURRENT SCREEN │
│ │
│ │
├───────────────────────────────────┤
│ Today │ Month │ Routine │ Rules │
└───────────────────────────────────┘

There should be one obvious action:

- Add

Which opens:

Add Expense
Add Money 34. Add Expense UX

The fastest possible flow:

ADD EXPENSE

Amount

      15.00 TND

Category

🍔 Food
☕ Coffee
🚕 Transport
🛍 Shopping
🎮 Fun
🏋️ Gym
🏠 Bills
Other

Optional note

[ SAVE ]

The user should be able to enter an expense in seconds.

35. Add Money UX
    ADD MONEY

Amount

      +300 TND

Source

💼 Salary
💻 Freelance
💰 Sold something
🎁 Gift
↩️ Reimbursement
Other

Date

Today

Optional:
Move part to savings

[ ADD ] 36. Data Model
User
User {
id: string
currency: string
createdAt: Date
}
Income
Income {
id: string
amount: number
source: string
date: Date
notes?: string
}
Expense
Expense {
id: string
amount: number
categoryId: string
date: Date
notes?: string
}
Bill
Bill {
id: string
name: string
amount: number
dueDate: Date
recurring: boolean
protected: boolean
}
SavingsGoal
SavingsGoal {
id: string
name: string
targetAmount: number
currentAmount: number
deadline?: Date
}
Routine
Routine {
id: string
name: string
days: number[]
items: RoutineItem[]
expectedTotal: number
}
RoutineItem
RoutineItem {
id: string
name: string
amount: number
categoryId: string
}
Rule
Rule {
id: string
type: RuleType
value: number
enabled: boolean
}
Cycle
Cycle {
id: string
startDate: Date
nextIncomeDate: Date
expectedIncome: number
} 37. Financial Engine

The financial engine must be independent from the UI.

Input:

FinancialInput {
currentBalance
upcomingBills
savingsTarget
minimumBuffer
daysUntilIncome
actualExpenses
expectedRoutineSpending
upcomingIncome
rules
}

Output:

FinancialStatus {
flexibleMoney
safeDailySpend
expectedDailySpend
currentDailyPace
remainingDays
projectedEndBalance
riskLevel
advice
}

Main function:

calculateFinancialStatus(input)

The financial engine should be deterministic.

38. Calculation Logic

Basic model:

Flexible Money =
Current Balance

- Upcoming Bills
- Savings Reserve
- Minimum Buffer

Then:

Base Daily Allowance =
Flexible Money / Remaining Days

The system then compares this with:

Expected Daily Spending

from routines.

Example:

Safe pace:
42 TND/day

Normal routine:
31 TND/day

Result:

You have approximately
11 TND/day of breathing room. 39. Current Spending Pace

The app also calculates actual pace.

Example:

Spent during current cycle:
235 TND

Days elapsed:
5

Current average:
47 TND/day

Compare:

Normal routine:
31 TND/day

Safe pace:
38 TND/day

Actual:
47 TND/day

Result:

🟡 Spending faster than sustainable. 40. Forecast

The app should answer:

"What happens if I continue like this?"

Example:

Flexible money:
590 TND

Days remaining:
16

Current spending pace:
45 TND/day

Projected remaining spending:
720 TND

Expected flexible money:
590 TND

Projected shortfall:
130 TND

Advice:

At your current pace, you may use
around 130 TND more than your flexible
budget before payday.

Try keeping the next few days
around 30 TND/day. 41. Important Financial Logic Rule

The app should distinguish between:

Money that exists

and

Money that is safe to spend.

Example:

Bank balance:
1,240 TND

Does NOT mean:

Safe to spend:
1,240 TND

If:

Upcoming rent:
700

Savings:
200

Buffer:
150

then:

Flexible:
190 TND

This is one of the core values of the app.

42. Unexpected Income

When the user receives unexpected money:

+300 TND

The app can ask:

What do you want to do with it?

Options:

Use it for this month
Save it
Split it

Example split:

150 TND → flexible spending
150 TND → savings

This should be optional.

43. Notifications

Notifications should be useful and limited.

Examples:

Daily
🟢 You're on track.

You can safely spend around
42 TND today.
Warning
🟡 Your spending pace increased.

Try keeping today around
30 TND to stay on track.
Income
💰 You have income coming in
tomorrow.

Your month is looking comfortable.
Bill
🏠 Rent is due in 3 days.

The amount is already protected
in your plan.

No excessive notifications.

44. AI
    MVP: No AI required.

The core system should use normal programming.

AI is NOT responsible for:

Calculating balances
Calculating daily allowance
Determining bills
Calculating savings
Forecasting money
Deciding whether the user can afford something

These must be deterministic.

45. Future AI Layer

AI can later provide natural-language interaction.

Example:

User:

"I made 300 TND from freelance today and I want to buy a 150 TND jacket. Is that okay?"

AI should:

Understand the question.
Send the relevant information to the financial engine.
Receive the verified calculation.
Explain it naturally.

Architecture:

User
↓
AI / Natural Language Layer
↓
Financial Engine
↓
Verified Result
↓
AI Explanation

The financial engine remains the source of truth.

46. No Automatic Money Deduction in MVP

The app NEVER automatically removes money because of a routine.

Example:

Routine:

Coffee:
4 TND

The app does NOT do:

Balance -4

unless the user actually records:

Coffee -4

The routine is only an expectation.

This distinction must be extremely clear.

47. No Automatic Bank Connection in MVP

No:

Bank API
Open Banking
Plaid
Automatic transaction sync
Automatic card tracking

MVP is:

Manual input + financial intelligence.

This keeps the product simple and lets you validate the actual concept first.

48. UX Example — Complete Mid-Month User

Today:

September 14

User installs app.

They have:

900 TND

Next salary:

September 30

Bills:

Internet:
50

Other:
100

Savings:

100

Minimum buffer:

100

Calculation:

900
-150 bills
-100 savings
-100 buffer

---

550 flexible

Days:

16

Safe pace:

550 / 16
≈34 TND/day

Home:

900 TND
available

SAFE TODAY

34 TND

🟢 You're starting comfortably.

16 days until payday.

User spends:

Lunch:
12

Coffee:
4

Taxi:
8

Total:

24

App:

You've spent 24 TND today.

You're still within your
recommended pace.

You have roughly 10 TND
of today's pace remaining.

Next day:

Expense:
55 TND

App:

🟡 You spent more than your
sustainable pace yesterday.

No problem.

Try keeping the next few days
around 30 TND.

Then:

+300 TND freelance

App:

💰 Nice.

You added 300 TND.

Your safe daily pace increased
from 34 TND to approximately 53 TND.

User considers:

120 TND purchase

What-if:

After purchase:

Safe pace:
53 → 44 TND/day

🟢 You can afford it while
keeping your bills, savings,
and minimum balance protected.

User records it.

The cycle continues.

49. Empty State

A new user should NOT see:

No expenses yet.
No data.

Instead:

Let's figure out your money.

Tell us:

💰 What you have now
📅 When you get paid
🏠 What you need to pay
💰 What you want to save

We'll calculate your safe pace.

This gives the user immediate value.

50. First-Run UX

Screen 1:

MAKE YOUR MONEY LAST

Know what you can safely spend
every day until your next income.

[ GET STARTED ]

Screen 2:

Where are you starting?

○ New income cycle

○ I'm already in the middle of it

Screen 3:

How much money do you have now?

[ 900 TND ]

Screen 4:

When is your next income?

[ September 30 ]

Screen 5:

What important payments
are still coming?

Rent
Bills
Subscriptions
Other

Screen 6:

What do you want to protect?

Savings:
[ 100 ]

Minimum balance:
[ 100 ]

Screen 7:

What does a normal day cost you?

You can add routines now
or do it later.

[ CREATE ROUTINE ]

[ SKIP ]

Screen 8:

YOUR FIRST PLAN

Available:
900 TND

Protected:
350 TND

Flexible:
550 TND

Safe daily pace:
34 TND

[ START ] 51. Core UX Principle

Every important screen should answer:

"So what does this mean for me?"

Bad:

You spent 1,420 TND.

Better:

You've spent 1,420 TND.

You're still on track to reach
your next income with your
current spending pace.

Bad:

Balance:
900 TND

Better:

You have 900 TND.

After protecting your bills,
savings and minimum balance:

You can safely spend around
34 TND/day. 52. Product Differentiation

The product should NOT differentiate itself by saying:

"We have a daily budget."

Many apps already do this.

The differentiation is the combination of:

1. Start anywhere

The user can install the app halfway through the month.

2. Personal routines

The app understands the user's normal daily life.

3. Personal rules

The user decides what must be protected.

4. Continuous advice

The app tells the user how they are doing.

5. What-if decisions

The user can test purchases before making them.

6. Any income

Salary is not the only source of money.

7. Actual vs expected

The app learns the difference between the user's normal routine and real behavior.

8. "Where did my money go?"

The user can understand the month without needing complicated accounting.

53. What the MVP Is NOT

It is not:

A bank
A payment app
A stock/investment app
An accounting system
A spreadsheet
A traditional envelope-budgeting app
An AI chatbot
A financial advisor
An automatic transaction tracker

It is:

A manual personal money coach that continuously calculates a safe spending pace.

54. MVP Screens

Minimum screens:

1. Welcome
2. Initial Setup
3. Today
4. Add Expense
5. Add Income
6. Transaction History
7. Month
8. Routine
9. Rules
10. What-If
11. Edit Financial Settings
12. Cycle Summary
13. MVP Feature Priority
    P0 — Must Have
    Current balance
    Next income date
    Income
    Expenses
    Bills
    Savings target
    Minimum balance
    Safe daily spending
    Dynamic recalculation
    Today dashboard
    Mid-month onboarding
    Transaction history
    P1 — Important
    Routines
    Personal rules
    What-if
    Actual vs expected
    Cycle summary
    Forecast
    Notifications
    P2 — Later
    AI
    Bank connection
    Automatic transactions
    Receipt scanning
    Smart categorization
    Automatic routine learning
    Multiple accounts
    Shared finances
14. Technical Recommendation

For the MVP:

Mobile:
Expo + React Native + TypeScript

State:
Zustand or equivalent

Local storage:
SQLite / local database

Backend:
Optional initially

Financial engine:
Pure TypeScript module

Notifications:
Expo Notifications

Authentication:
Can be added if cloud sync is required

The financial engine should work independently from the UI.

57. Offline-First

Because the MVP is manual, most functionality can work locally.

The user should be able to:

Add expenses
Add income
View balance
View routines
View rules
Calculate daily spending

without an internet connection.

Cloud sync can be added later.

58. Security Principle

Even though this is not a bank, financial data is sensitive.

The app should:

Store only necessary data
Avoid logging financial information
Use secure local storage where appropriate
Encrypt sensitive data where appropriate
Never send financial data to AI unnecessarily
Clearly explain any future external integrations 59. MVP Validation

Before building advanced features, the product should be tested manually.

The developer should personally use it for at least one complete income cycle.

Test scenarios:

Scenario 1

Start on day 1.

Scenario 2

Start halfway through the month.

Scenario 3

Start with very little money.

Scenario 4

Receive unexpected income.

Scenario 5

Large unexpected expense.

Scenario 6

Overspend several days in a row.

Scenario 7

Spend less than normal.

Scenario 8

Upcoming large bill.

Scenario 9

Savings target changed.

Scenario 10

User changes payday.

The engine should remain understandable in every situation.

60. Main Success Question

The MVP succeeds if a user can open the app and immediately answer:

"Can I afford to spend money today?"

and:

"Will I make it to my next income?"

and:

"Where is my money going?"

If the app can reliably answer those three questions, the MVP has delivered its core value.

61. Final Product Definition

The complete product can be summarized as:

A manual money coach that takes your current money, upcoming income, bills, savings goals, personal routines, rules, and real spending, then continuously tells you how much you can safely spend and whether you're on track to make it to your next income.

The core loop is:

Tell the app your situation
↓
Protect bills + savings + buffer
↓
Calculate safe spending pace
↓
Live normally
↓
Record actual expenses
↓
Recalculate
↓
Receive simple advice
↓
Adjust if necessary
↓
Add unexpected income
↓
Recalculate
↓
Reach payday safely
↓
Review where the money went
↓
Start next cycle

The single most important UI element is:

        MONEY AVAILABLE

            1,240 TND


        SAFE TO SPEND

             42 TND
             TODAY


        🟢 YOU'RE ON TRACK


        16 days until payday


        Normal day: 31 TND
        Spent today: 18 TND


        + ADD EXPENSE

Everything else in the product exists to make that recommendation:

accurate, personal, explainable, and useful.

**My recommendation:** build this MVP **without AI and without bank integration first**. The interesting p
