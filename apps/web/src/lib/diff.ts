/**
 * Differences between two definitions, in words, for the Release dialog
 * (design/generated/web/screens/VersionView.md). Lines and parameters are matched by
 * position, steps by number, notes and documents by content.
 */
import type { BomLineDef, DraftDefinition, ParameterDef, ProcessDef } from '@wyatt/core/catalog';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const paramText = (p: ParameterDef) => `${p.var} (${p.type}${p.unitCode ? `, ${p.unitCode}` : ''})`;
const lineText = (l: BomLineDef) => `${l.component}${l.childParams.length ? `(${l.childParams.join(', ')})` : ''} × ${l.qty}${l.when ? ` when ${l.when}` : ''}`;
const stepText = (p: ProcessDef) => `step ${p.idx} ${p.operationCode}`;

export function changes(from: DraftDefinition, to: DraftDefinition): string[] {
	const out: string[] = [];
	if ((from.spec ?? '') !== (to.spec ?? '')) out.push('Specification changed');
	if ((from.familyScript ?? '') !== (to.familyScript ?? '')) out.push('Family script changed');
	if ((from.priceFormula ?? '') !== (to.priceFormula ?? '')) out.push('Price formula changed');
	if (from.explodeDefault !== to.explodeDefault) out.push(`Explode default: ${from.explodeDefault} → ${to.explodeDefault}`);

	const n = Math.max(from.parameters.length, to.parameters.length);
	for (let i = 0; i < n; i++) {
		const a = from.parameters[i], b = to.parameters[i];
		if (!a && b) out.push(`Parameter added: ${paramText(b)}`);
		else if (a && !b) out.push(`Parameter removed: ${paramText(a)}`);
		else if (a && b && !same(a, b)) out.push(a.var === b.var ? `Parameter ${b.var} changed` : `Parameter ${i + 1}: ${paramText(a)} → ${paramText(b)}`);
	}
	if (from.parameters.length !== to.parameters.length || from.parameters.some((p, i) => to.parameters[i]?.var !== p.var)) {
		out.push(`Partnames change: (${from.parameters.map((p) => p.var).join(',')}) → (${to.parameters.map((p) => p.var).join(',')})`);
	}

	const m = Math.max(from.lines.length, to.lines.length);
	for (let i = 0; i < m; i++) {
		const a = from.lines[i], b = to.lines[i];
		if (!a && b) out.push(`Line ${i + 1} added: ${lineText(b)}`);
		else if (a && !b) out.push(`Line ${i + 1} removed: ${lineText(a)}`);
		else if (a && b && !same(a, b)) out.push(`Line ${i + 1}: ${lineText(a)} → ${lineText(b)}`);
	}

	const steps = new Set([...from.processes, ...to.processes].map((p) => p.idx));
	for (const idx of [...steps].sort((x, y) => x - y)) {
		const a = from.processes.find((p) => p.idx === idx), b = to.processes.find((p) => p.idx === idx);
		if (!a && b) out.push(`Step added: ${stepText(b)}`);
		else if (a && !b) out.push(`Step removed: ${stepText(a)}`);
		else if (a && b && !same(a, b)) out.push(`${stepText(b)} changed`);
	}

	const noteKey = (x: { processIdx: number; type: string; body: string; measure: unknown }) => JSON.stringify([x.processIdx, x.type, x.body, x.measure]);
	const fromNotes = new Set(from.notes.map(noteKey)), toNotes = new Set(to.notes.map(noteKey));
	const notesAdded = to.notes.filter((x) => !fromNotes.has(noteKey(x))).length;
	const notesRemoved = from.notes.filter((x) => !toNotes.has(noteKey(x))).length;
	if (notesAdded || notesRemoved) out.push(`Notes: ${notesAdded} new or changed, ${notesRemoved} removed or replaced`);

	const docKey = (d: { kind: string; name: string; contentRef: string }) => JSON.stringify([d.kind, d.name, d.contentRef]);
	const fromDocs = new Set(from.documents.map(docKey)), toDocs = new Set(to.documents.map(docKey));
	const docsAdded = to.documents.filter((d) => !fromDocs.has(docKey(d))).length;
	const docsRemoved = from.documents.filter((d) => !toDocs.has(docKey(d))).length;
	if (docsAdded || docsRemoved) out.push(`Documents: ${docsAdded} new or changed, ${docsRemoved} removed or replaced`);
	return out;
}
