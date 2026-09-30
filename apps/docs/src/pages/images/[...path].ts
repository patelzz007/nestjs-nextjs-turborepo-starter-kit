import type { APIRoute, GetStaticPaths } from "astro";

import { dataUrlToBytes, imageContentType, imageRouteParam } from "@/lib/assets";

/**
 * Serves the repo-root `docs/images/` folder at `/images/…`, so guides can
 * reference screenshots with paths that also work on GitHub.
 */
const IMAGES: Readonly<Record<string, string>> = import.meta.glob<string>("../../../../../docs/images/**/*.{png,jpg,jpeg,gif,webp,avif,svg}", {
	query: "?inline",
	import: "default",
	eager: true,
});

interface ImagePath {
	readonly params: { readonly path: string };
	readonly props: { readonly dataUrl: string };
}

export const getStaticPaths = ((): ImagePath[] =>
	Object.entries(IMAGES).flatMap(([key, dataUrl]): ImagePath[] => {
		const path = imageRouteParam(key);
		return path === null ? [] : [{ params: { path }, props: { dataUrl } }];
	})) satisfies GetStaticPaths;

export const GET: APIRoute<{ readonly dataUrl: string }> = ({ props, params }) =>
	new Response(dataUrlToBytes(props.dataUrl), { headers: { "Content-Type": imageContentType(params.path ?? "") } });
