# Screens Plan

Screens of the **web** target, with routes and status. Draft for the owner's review
(November 2026). Keep in sync with [../navigation.md](../navigation.md).

## Screens

| Screen Name | Route | Spec File | Stories | Variants | Status |
|-------------|-------|-----------|---------|----------|--------|
| Families | FamilyList | family-list.md | product-01 | happy, empty, error | generated (slice 1), reviewed: rough cut accepted |
| Family | FamilyDetail | family-detail.md | product-01, 03, 04 | happy, error | generated (slice 2) |
| Draft editor | DraftEditor | draft-editor.md | product-02, 03 | happy, error | generated (slices 2, 3: release dialog) |
| Version | VersionView | version-view.md | product-03 | happy | generated (slice 3) |
| Parts | PartList | part-list.md | product-04 | happy, empty | generated (slice 4) |
| Part | PartDetail | part-detail.md | product-04 | happy | generated (slice 4) |
| Units, classes and operations | ReferenceData | reference-data.md | product-01 (context) | happy, empty | planned |
| Settings | Settings | settings.md | (none yet) | happy | planned |

Dialogs (specified as components): NewFamily (on FamilyList), Release (on DraftEditor),
Revise (on VersionView), ApprovePart (on FamilyDetail and PartList).

## Variants

- `happy`: the sample hydroponics catalog (or, in production, the strand's real data).
- `empty`: a catalog with no families.
- `error`: every read and write fails as `unavailable`.

## Order of slices

1. FamilyList with NewFamily (product-01).
2. DraftEditor, parameters and BOM lines first (product-02).
3. Release, FamilyDetail and VersionView (product-03).
4. ApprovePart, PartList and PartDetail (product-04).
5. ReferenceData, then Settings.

## Notes

- Spec files use kebab-case (`family-list.md` for route `FamilyList`).
