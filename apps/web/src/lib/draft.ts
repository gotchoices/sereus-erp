/** Helpers for editing a draft definition in the browser (design/generated/web/screens/DraftEditor.md). */
import type { BomLineDef, DocumentDef, DraftDefinition, NoteDef, ParameterDef, ProcessDef, Version } from '@wyatt/core/catalog';

export const newParameter = (): ParameterDef => ({
	pos: 0, var: '', type: 'num', unitCode: null, description: '', defaultValue: null, min: null, max: null, allowed: [],
});
export const newLine = (): BomLineDef => ({
	pos: 0, component: '', childParams: [], qty: '1', when: null, script: null, processIdx: null, childVer: null, comment: null,
});
export const newProcess = (idx: number): ProcessDef => ({
	idx, operationCode: '', nextIdx: null, setupTime: null, laborPerUnit: null, machinePerUnit: null, description: null,
});
export const newNote = (processIdx: number): NoteDef => ({
	processIdx, seq: 0, type: 'step', body: '', documentId: null, measure: null,
});
export const newDocument = (): DocumentDef & { id: string } => ({
	id: `D${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(), kind: 'drawing', name: '', contentRef: '',
});

/** The editable part of a version. */
export function definitionOf(v: Version): DraftDefinition {
	return structuredClone({
		spec: v.spec, familyScript: v.familyScript, priceFormula: v.priceFormula, explodeDefault: v.explodeDefault,
		compatNotes: v.compatNotes, parameters: v.parameters, lines: v.lines, processes: v.processes,
		notes: v.notes, documents: v.documents,
	});
}

/** Row order sets positions; notes are numbered within their step; blank optional text becomes null. */
export function normalized(def: DraftDefinition): DraftDefinition {
	const blank = (s: string | null) => (s === null || s.trim() === '' ? null : s);
	const seqs = new Map<number, number>();
	return {
		...def,
		spec: blank(def.spec), familyScript: blank(def.familyScript), priceFormula: blank(def.priceFormula), compatNotes: blank(def.compatNotes),
		parameters: def.parameters.map((p, i) => ({
			...p, pos: i + 1, unitCode: p.type === 'num' ? p.unitCode : null, defaultValue: blank(p.defaultValue),
			min: p.type === 'num' ? num(p.min) : null, max: p.type === 'num' ? num(p.max) : null,
			allowed: p.type === 'enum' ? p.allowed.filter((a) => a.value.trim() !== '') : [],
		})),
		lines: def.lines.map((l, i) => ({ ...l, pos: i + 1, when: blank(l.when), script: blank(l.script), comment: blank(l.comment), childVer: num(l.childVer) })),
		processes: def.processes.map((p) => ({
			...p, setupTime: blank(p.setupTime), laborPerUnit: blank(p.laborPerUnit), machinePerUnit: blank(p.machinePerUnit), description: blank(p.description),
		})),
		notes: def.notes.map((n) => {
			const seq = (seqs.get(n.processIdx) ?? 0) + 1;
			seqs.set(n.processIdx, seq);
			return { ...n, seq, measure: n.type === 'qc' ? n.measure : null };
		}),
	};
}

function num(v: unknown): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

/** Move item `i` of a list up (-1) or down (+1). */
export function move<T>(list: T[], i: number, by: -1 | 1): void {
	const j = i + by;
	if (j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j]!, list[i]!];
}
