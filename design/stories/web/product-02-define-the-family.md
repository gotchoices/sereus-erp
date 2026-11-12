# User Story: Define the family's parameters, components and routing

## Story Overview
As an engineer
I want to describe a family's parameters, its components and how it is built
So that any configuration of it can be named, costed and built

Context: Continues product-01. The family has a draft. Component families (pipe, cap, net cup) are already released.

## Sequence
1. Engineer adds parameters in partname order: a name (`L`), a type (number, choice or text), units, a range or the allowed choices, and an optional default.
2. Engineer adds BOM lines: the component family, an expression for each of its parameters (`D`), and the quantity per unit (`L / 1000`), optionally a condition (`C == "k"`).
3. Engineer adds routing steps (cut, drill, assemble) with optional times, and links lines to the step that uses them.
4. Engineer adds work notes and QC checks to steps (a measurement with nominal and limits, or pass/fail).
5. Engineer saves the draft at any point; the whole definition is kept as entered.
   - If the definition breaks a rule (a step still used by a line is removed, a note points to a missing document), the save is refused, the rule is named, and nothing is lost from the form.

## Acceptance Criteria
- [ ] Parameters, lines, steps and notes can be added, edited, reordered and removed while the version is a draft.
- [ ] A refused save says which rule refused it, in words.
- [ ] Nothing in a draft is visible as "current" to other modules until it is released.
