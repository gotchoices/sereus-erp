import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** `/` opens the first module section. */
export const load: PageServerLoad = ({ url }) => {
	redirect(307, `/product${url.search}`);
};
