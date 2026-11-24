---
status: accepted
---

# The sim offers each prompt's answers

The headless sim lists each prompt's offered answers and says which offered answer a typed text selects, next to the rules that accept them. The bounds they share, such as a loan's room or a club page's range, are written once and used by both. The view and the bots read the offers from the sim, and a bot's answer must be offered before it is submitted. ADR-0005 still holds: touch input submits the original answers through the one text-input path. Only its cost changes, because the layer that knows which answers each prompt accepts is now in the sim, not the view.

## Considered Options

- **Keep the offers in the view, with the bots listing their own answers.** That copied every bound into three places, and nothing checked that a strategy gave only offered answers.
- **Split `accept` into reading an answer and applying it, and derive the offers from the reading.** That gives one source of truth, but it means rewriting the rules code that rules parity depends on.

## Consequences

The sim knows about offered answers even though it never draws them, because the bots, which have no view, need them too. A new prompt changes `accept` and the offers in the same layer, and the sim's probe checks both together.
