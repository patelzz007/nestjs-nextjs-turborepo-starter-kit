// ============================================
// scripts/local-public-paths.ts — what the local-public-path repair changes
// ============================================
// The local storage driver used to save each public file's link WITH the API's
// address (`http://0.0.0.0:8080/api/v1/files/…/local-public`), which strands a
// picture whenever that address is unreachable (a phone) or changes. It now
// saves the path alone and adds the address when serving it
// (`PublicUrlResolver`). This plans the repair of rows saved the old way.

/** A local-driver public link saved with an address: the origin, then the path the API serves it at. */
const ABSOLUTE_LOCAL_PUBLIC_URL = /^https?:\/\/[^/]+(?<path>\/api\/v\d+\/files\/[^?#]+\/local-public)$/u;

/** The stored path a local-driver public link should have been saved as, or `null` when it needs no repair. */
export function toStoredLocalPublicPath(stored: string | null): string | null {
	if (stored === null) {
		return null;
	}
	return ABSOLUTE_LOCAL_PUBLIC_URL.exec(stored)?.groups?.path ?? null;
}

export interface PublicPathRow {
	readonly id: string;
	readonly publicPath: string | null;
}

export interface PublicPathRepair {
	readonly id: string;
	readonly from: string;
	readonly to: string;
}

/** The rows to rewrite, and what to: only local-driver links saved with an address. */
export function planLocalPublicPathRepairs(rows: readonly PublicPathRow[]): PublicPathRepair[] {
	return rows.flatMap((row) => {
		const to = toStoredLocalPublicPath(row.publicPath);
		return to === null || row.publicPath === null ? [] : [{ id: row.id, from: row.publicPath, to }];
	});
}
