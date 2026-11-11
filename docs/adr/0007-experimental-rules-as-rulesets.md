# Experimental rules live in named rulesets beside the original

Gameplay changes are made as named rulesets that the simulation takes as a parameter, not as edits to the existing rules. The original ruleset stays the default and keeps all its fidelity tests, so ADR-0001's promise of the original experience still holds while variations are tried and compared against it. Editing the rules in place would be simpler, but it would break the fidelity fixtures and leave no reference to measure a change against.
