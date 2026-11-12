/**
 * Model errors in words, for the web target (consolidations under design/generated/web/screens/).
 * Rules not listed fall back to the model's own message.
 */
import type { CoreError } from '@wyatt/core';

const NAME_FORMAT = 'Names look like a:chan: a class letter, a colon, then letters, digits or _.';

/** Refusals by rule name (catalog.qsql constraints and the model's code rules). */
const RULES: Record<string, string> = {
	FamilyBaseFormat: NAME_FORMAT,
	FamilyUnit: 'Choose a unit from the list.',
	FamilyDeleteUnreleased: 'A family that has been released cannot be deleted; mark it obsolete instead.',
	FamilyBaseFixed: 'The name is permanent once a version has been released.',
	VersionOneDraft: 'This family already has a draft.',
	NoDraft: 'This family has no draft.',
	ParameterVarFormat: 'Parameter names are letters, digits and _, not starting with a digit, and not a reserved word.',
	ParameterVarUnique: 'Two parameters have the same name.',
	ParameterNumUnit: 'A number parameter needs a unit.',
	ParameterRange: 'Min and max apply to numbers, and min must not exceed max.',
	ParameterType: 'Choose a type for every parameter.',
	AllowedValueOfEnum: 'Allowed values apply only to choice parameters.',
	BomLineComponent: 'A line names a family that does not exist.',
	BomLineProcess: 'A line names a routing step that does not exist.',
	ProcessUnused: 'A line names a routing step that does not exist.',
	ProcessNext: "A step's next step does not exist.",
	ProcessOperation: 'Choose an operation for every step.',
	NoteProcess: 'A note belongs to a step that does not exist.',
	NoteDocument: 'A note points to a document that is not in this draft.',
	NoteMeasure: 'Only QC notes carry a measurement.',
	BomLineChildParams: 'Child parameters must be a list.',
	FamilyCurrentIsReleased: 'The release could not be recorded; try again.',
	VersionReleaseFields: 'A release needs a change summary and the interchangeable choice.',
	UnitCodeFormat: 'Unit codes are letters, digits and _, up to 12.',
	UnitFactor: 'Give both parts of the conversion, both above zero, or neither.',
	UnitScale: 'Decimal places are 0 to 9.',
	UnitDimension: 'Choose a dimension from the list.',
	UnitScaleFixed: 'This unit is in use; its decimal places cannot change.',
	ClassPrefixFormat: 'A class prefix is one letter, digit or @.',
	ClassKind: 'Choose a kind from the list.',
	ClassKindFixed: 'This class has families; its kind cannot change.',
	OperationCodeFormat: 'Operation codes are letters, digits and _, up to 16.',
	PartStatus: 'Choose a status from the list.',
	PartTracking: 'Choose a tracking mode from the list.',
	PartLevels: 'Levels must be zero or more, the minimum buy and shelf life more than zero.',
};

/** Any model error, in words. */
export function errorText(error: CoreError): string {
	// The release checks' own sentences name the line, so they are shown as they are.
	if (error.kind === 'refused' && (error.rule === 'ChildParamCount' || error.rule === 'ChildNotReleased')) return error.message.replace(/^line/, 'Line');
	if (error.kind === 'refused' && error.rule && RULES[error.rule]) return RULES[error.rule]!;
	if (error.kind === 'duplicate' && /ParameterVarUnique|Parameter\.Var/.test(error.message)) return RULES.ParameterVarUnique!;
	return error.message;
}

export function familyCreateError(error: CoreError, input: { base: string }): string {
	const prefix = input.base.slice(0, 1);
	if (error.kind === 'invalid') return NAME_FORMAT;
	if (error.kind === 'duplicate') return `A family named ${input.base} already exists.`;
	if (error.kind === 'refused' && error.rule === 'FamilyClass') return `There is no class ${prefix}. Add it under Units, classes and operations.`;
	return errorText(error);
}
