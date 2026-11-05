import { createFileRoute } from "@tanstack/react-router";

import { dataUrlToBytes, imageContentType } from "../../lib/assets";

/** Serves the repo-root `docs/images/` folder at `/images/…`, so guides use image paths that also work on GitHub. */
export const Route = createFileRoute("/images/$")({
	server: {
		handlers: {
			GET: async ({ params }): Promise<Response> => {
				const imagePath = params._splat ?? "";
				const { imageDataUrl } = await import("../../server/content.server");
				const dataUrl = imageDataUrl(imagePath);
				if (dataUrl === null) {
					return new Response("Not found", { status: 404 });
				}
				return new Response(dataUrlToBytes(dataUrl), { headers: { "Content-Type": imageContentType(imagePath) } });
			},
		},
	},
});
