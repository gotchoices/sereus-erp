# User Story: Define the family's parameters, components and routing

## Story Overview
As an engineer
I want to describe a family's parameters, its components and how it is built
So that any configuration of it can be named, costed and built

Context: Continues product-01. The family has a draft. Component families (pipe, cap, net cup) are already released.

## What the user needs to understand
- **Parameters** are the values that vary from one configuration to the next. Their order sets the **partname** (`a:chan(1200,6,75)`): the values in parameter order.
- A **BOM line** says which component family goes into this one, how its parameters follow from this family's (`D` passed through, a length computed from `L`), how many, and when it applies at all.
- **Routing** is the sequence of work steps (cut, drill, assemble); lines can be tied to the step that uses them, and **notes and QC checks** say how each step is done and checked.
- That everything here is a draft until released, and can be changed freely until then.

## Sequence
1. Engineer opens the family and sees, at a glance, what it is made of so far: its parameters, its BOM lines and its routing, with empty sections saying what would go there and how to add the first entry.
2. For each kind of entry the engineer can quickly find out what it is and see an example, without leaving the family.
3. Engineer adds parameters in partname order: a name (`L`), a type (number, choice or text), units, a range or the allowed choices, and an optional default. As they go, they see what a partname of this family looks like (`a:chan(L,D,H)`).
4. Engineer adds BOM lines: the component family, an expression for each of its parameters (`D`), and the quantity per unit (`L / 1000`), optionally a condition (`C == "k"`). While choosing a component, the engineer sees what its parameters are, so they know what to give it.
5. Engineer adds routing steps (cut, drill, assemble) with optional times, and links lines to the step that uses them.
6. Engineer adds work notes and QC checks to steps (a measurement with nominal and limits, or pass/fail).
7. Engineer saves the draft at any point; the whole definition is kept as entered, and the page shows that it is saved and still a draft.
   - If the definition breaks a rule (a step still used by a line is removed, a note points to a missing document), the save is refused, the rule is named in words with the entry it concerns, and nothing is lost from the form.

## Acceptance Criteria
- [ ] Parameters, lines, steps and notes can be added, edited, reordered and removed while the version is a draft.
- [ ] A refused save says which rule refused it, in words, and points at the entry.
- [ ] Nothing in a draft is visible as "current" to other modules until it is released.
- [ ] The engineer always knows whether they are looking at a draft or a released version, and which version.
- [ ] Each section (parameters, BOM, routing, notes and QC) can explain itself in a sentence or two with an example, on the spot.

## Questions (for the owner; the working default is used until answered)
- Q1. Until the BOM engine exists, expressions (`L / 1000`) can't be evaluated. Should the app check them at all when saving? *Default: no check; they are stored as written, and release checks only what it can (component exists, parameter count).*
- Q2. Should the engineer be able to try a configuration (enter `1200,6,75` and see the exploded BOM) while editing? *Default: yes, once the engine exists; not in the first slices.*
- Q3. Documents (drawings, datasheets): does the engineer attach files, or record where a file lives (a path or link)? *Default: a name, a kind and a link; no upload yet.*
- Q4. Reordering parameters changes every partname of the family. Allowed freely in a draft? *Default: allowed before the first release, with a warning after it.*
