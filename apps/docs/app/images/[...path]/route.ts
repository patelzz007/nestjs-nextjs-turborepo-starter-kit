import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Serves the guides' images straight from the repo-root `docs/images/` folder
 * (the single source of truth — no mirrored `public/` copy). The remark
 * image-rewrite plugin turns `./images/…` references into `/images/…` URLs,
 * which land here; the `img` component adds the lightbox on top.
 *
 * The resolved path is constrained to stay under `docs/images/` (dot-dot
 * segments are stripped before joining) so the route can't be abused to read
 * arbitrary files from disk.
 */
const IMAGES_ROOT = path.resolve(process.cwd(), "../../docs/images");

const MIME_TYPES: Readonly<Record<string, string>> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".avif": "image/avif",
};

interface ImagesRouteParams {
	readonly path: readonly string[];
}

export async function GET(_request: Request, { params }: { readonly params: Promise<ImagesRouteParams> }): Promise<NextResponse> {
	const { path: segments } = await params;
	const relative = segments.join("/").replaceAll("..", "").replace(/^\/+/, "");
	const filePath = path.join(IMAGES_ROOT, relative);

	if (!filePath.startsWith(`${IMAGES_ROOT}${path.sep}`)) {
		return new NextResponse("Not found", { status: 404 });
	}

	try {
		const data = await readFile(filePath);
		const extension = path.extname(filePath).toLowerCase();
		return new NextResponse(data, {
			headers: {
				"Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch {
		return new NextResponse("Not found", { status: 404 });
	}
}
