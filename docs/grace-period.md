# Grace period before dismissal

[#74](https://github.com/odogono/fman/issues/74). Under the Enhanced rules from version 2, a club that goes over its credit limit gets a grace period to get back under it, instead of the manager being dismissed at once. The change was measured as the experimental ruleset `grace-period`, then became part of [`enhanced-2`](enhanced-rules.md).

## The problem in the original

Dismissal comes at the first weekly bills where the club's debt exceeds its credit limit, £250,000 × (5 − division). Cash in hand doesn't count. The baseline shows the main cause is relegation, not compounding interest. A club that borrows up to its division's limit is relegated, the limit drops beneath its debt (Division 2's £750k becomes Division 3's £500k), and the next bills end the game. Under `enhanced-1`, the season just completed before an aggressive dismissal was a relegation in 44 of 44 dismissals at level 3 and 54 of 56 at level 5.

## The rule

- When the bills find the club over its credit limit, a grace period of **4 weeks** starts. A week is one payment of bills: each league match and cup round, including cup replays.
- Each further week over the limit counts it down. If the club is still over when it runs out, the manager is dismissed.
- Getting back to the limit or under ends the grace period. Going over again later starts a new full one.
- A running grace period carries on through the season end, and relegation over the new limit starts one at the first bills of the new season.
- Nothing else changes. Borrowing is still refused while over the limit, a bills shortfall still adds to the debt, interest is still 1% a week, and the club can still buy, sell and repay.

Under Enhanced rules the bills screen shows the grace period in the original's style ([ADR 0010](adr/0010-enhanced-rules-speak-on-the-original-screens.md)): `OVER YOUR CREDIT LIMIT` and `4 WEEKS TO CLEAR IT`, then `LAST WEEK TO CLEAR YOUR DEBT`. Under the Original rules, the bills and dismissal screens are unchanged.

## Measuring it

Neither of the original four bot strategies can show what the rule offers. Balanced never borrows, and aggressive borrows to the limit but never sells or repays, so a grace period can help it only if gate money happens to clear its debt. A fifth strategy, **recovering**, plays as aggressive but, once over the limit, stops buying, repays from its cash and sells its weakest reserves until back within the limit ([the harness](gameplay-baseline.md#strategies)). Adding it added rows to every baseline and left the existing rows unchanged.

Recovering, 200 runs per level, 10 seasons ([full baseline](baseline/grace-period.md)):

| Level | Dismissed, original → `grace-period` | Final cash − debt, median | `enhanced-1` → `enhanced-2` dismissed |
| ----- | ------------------------------------ | ------------------------- | ------------------------------------- |
| 1–3   | 0% → 0%                              | unchanged                 | 0% → 0%                               |
| 4     | 22.5% → 15.5%                        | −£113k → −£111k           | 0% → 0%                               |
| 5     | 84.0% → 74.5%                        | −£252k → −£259k           | 2.0% → 1.0%                           |
| 6     | 99.0% → 97.5%                        | −£252k → −£262k           | 6.5% → 4.5%                           |
| 7     | 100% → 100%                          | −£252k → −£261k           | 22.5% → 15.5%                         |

A grace period rescues clubs whose debt can be recovered. It doesn't rescue clubs that are insolvent outright, whose wages and interest exceed their income. Each extra week over the limit costs interest, so borrowing doesn't become free: recovering and aggressive still finish far behind balanced on cash − debt at every level, and balanced plays exactly as before. Recovering under the original rules already avoids most relegation dismissals at levels 1–3, because it sells and repays at the menu before the next bills.

Four weeks was chosen against 8 and 12. Longer periods save a few more clubs at level 4 (15.5% at 4 weeks, 13.5% at 8, 12% at 12) but cost more interest at every level (level 5 median −£259k, −£267k, −£270k).
