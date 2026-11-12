/**
 * Model errors in words, for the web target (design/generated/web/screens/FamilyList.md,
 * NewFamily). Rules not listed fall back to the model's own message.
 */
import type { CoreError } from '@wyatt/core';

export function familyCreateError(error: CoreError, input: { base: string }): string {
	const prefix = input.base.slice(0, 1);
	if (error.kind === 'invalid') return 'Names look like a:chan: a class letter, a colon, then letters, digits or _.';
	if (error.kind === 'duplicate') return `A family named ${input.base} already exists.`;
	if (error.kind === 'refused' && error.rule === 'FamilyClass') return `There is no class ${prefix}. Add it under Units, classes and operations.`;
	if (error.kind === 'refused' && error.rule === 'FamilyUnit') return 'Choose a unit from the list.';
	if (error.kind === 'refused' && error.rule === 'FamilyBaseFormat') return 'Names look like a:chan: a class letter, a colon, then letters, digits or _.';
	return error.message;
}
