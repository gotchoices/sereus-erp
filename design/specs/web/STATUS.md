# Target STATUS (phase checklist)

This file tracks progress for a single app target (`<target>`). It is meant to be updated by the human (with agent assistance).

Phases are defined in `appeus/docs/DESIGN.md` (authoritative).

## Bootstrap / Discovery (shared)
- [x] `design/specs/project.md` is complete enough to proceed (publisher id open)
- [ ] (Mobile targets) Apply the app id (Android `applicationId`, iOS bundle id) in the native build trees (from `design/specs/project.md`, e.g. `org.sereus.health`)

## Story Generation (this target)
- [x] Stories exist under `design/stories/web/` (product-01…04, drafts for the owner to edit)

## Navigation Planning (this target)
- [ ] `design/specs/web/navigation.md` exists (drafted) and is reviewed
- [x] `design/specs/web/screens/index.md` lists the intended screens/routes (draft)

## Domain Contract (shared)
- [x] `design/specs/domain/` is sufficient to support this target’s first slices (product.md, catalog.qsql, `@wyatt/core/catalog`)

## Screen/Component Slicing (this target)
- [ ] Key screens/components have specs under `design/specs/<target>/screens/` and `design/specs/<target>/components/`
- [ ] Slices are being generated one at a time with test/commit pauses (FamilyList generated from its consolidation, no screen spec; awaiting the owner's review)

## Scenario / Peer Review (optional)
- [ ] Scenario docs/images exist under `design/generated/<target>/scenarios/` and `design/generated/<target>/images/`

## Final wiring
- [ ] Production data wiring is implemented and tested


