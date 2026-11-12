/** Links between web screens (design/specs/web/navigation.md). `keep` carries the mock variant, if any. */
const withKeep = (path: string, keep: string) => (keep ? `${path}?${keep}` : path);

export const familyHref = (base: string, keep = '') => withKeep(`/product/families/${encodeURIComponent(base)}`, keep);
export const draftHref = (base: string, keep = '') => withKeep(`/product/families/${encodeURIComponent(base)}/draft`, keep);
export const familiesHref = (keep = '') => withKeep('/product', keep);
export const versionHref = (base: string, ver: number, keep = '', minor?: number) => {
	const q = [keep, minor !== undefined ? `minor=${minor}` : ''].filter(Boolean).join('&');
	return `/product/families/${encodeURIComponent(base)}/v/${ver}${q ? `?${q}` : ''}`;
};
export const partsHref = (keep = '') => withKeep('/product/parts', keep);
/** A part by ID (its permanent link); a part number or partname also resolves. */
export const partHref = (ref: string | number, keep = '') => withKeep(`/product/parts/${encodeURIComponent(String(ref))}`, keep);
export const referenceHref = (keep = '') => withKeep('/product/reference', keep);
