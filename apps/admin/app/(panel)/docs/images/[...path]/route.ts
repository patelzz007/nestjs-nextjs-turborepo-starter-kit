import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { decodeJwtPayload } from "@workspace/client/lib/auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Serves the images embedded in the repo's `docs/*.md` guides.
 *
 * Guides reference their images with **repo-relative** paths
 * (`./images/email/verification.png`), which resolve to
 * `/docs/images/email/verification.png` on a `/docs/<slug>` page. The admin
 * app has no `public/` folder and Next.js does not serve the repo-root
 * `docs/` directory, so without this route every in-guide image 404s.
 *
 * The handler mirrors `lib/docs/index.ts`: it reads straight off the
 * filesystem (server-only) from the same repo-root `docs/images` folder the
 * screenshot script writes to (`scripts/render-email-previews.ts`), so there
 * is exactly **one** copy of each image — no `public/` duplication to keep in
 * sync. Route handlers are not cached by default, so a regenerated screenshot
 * is served immediately.
 *
 * Security: the proxy's `matcher` deliberately skips static file extensions
 * (`.png` etc.), so this route handles its OWN auth — it requires a valid
 * `adminAccessToken` cookie with the `hasAdminAccess` claim, mirroring the
 * proxy's panel gating exactly (decodeJwtPayload + claim check). The path is
 * additionally zod-validated (rule 13) — only plain image-file segments are
 * accepted, and the resolved absolute path must stay inside `docs/images/`
 * (path-traversal guard, same spirit as `getDoc`'s slug check).
 */

/** Admin cookie names — must match `apps/admin/proxy.ts`. */
const ACCESS_TOKEN_COOKIE = "adminAccessToken";

/** Redirect target for unauthenticated requests (browser-navigable). */
const LOGIN_URL = "/auth/login";

/** Repo-root `docs/images` folder (`apps/admin` is one level down from the repo root). */
const DOCS_IMAGES_DIR = path.resolve(process.cwd(), "../../docs/images");

/**
 * Each URL segment must be a plain filename-safe token (no slashes, no spaces)
 * and may NOT be `..` or contain consecutive dots — the `..` exclusion is the
 * first traversal guard, with the resolved-path containment check below as the
 * authoritative second guard.
 */
const ImagePathSegmentsSchema = z.array(z.string().regex(/^(?![.]{2})(?!.*[.]{2})[a-z0-9._-]+$/i, "invalid path segment"));

/** Content-Type per image extension — anything else falls back to octet-stream (a 404 guard also applies). */
const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
};

interface DocsImagesRouteParams {
	readonly path: readonly string[];
}

/**
 * `GET /docs/images/[...path]` — streams the requested image from the repo's
 * `docs/images/` folder. Returns 404 for unknown files, non-image extensions,
 * or any path that escapes the images directory, and redirects to the login
 * page for unauthenticated / non-admin callers.
 */
export async function GET(request: NextRequest, { params }: { readonly params: Promise<DocsImagesRouteParams> }): Promise<NextResponse> {
	// The proxy's matcher skips `.png`/`.jpg`/… URLs, so auth is enforced HERE:
	// the cookie's JWT must decode to a payload with `hasAdminAccess === true`
	// (the exact same claim the proxy checks for every panel page). The login
	// redirect carries `?redirect=<pathname>` like the proxy, so a freshly
	// authenticated admin lands back on the docs page they were viewing.
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const payload = accessToken !== undefined ? decodeJwtPayload(accessToken) : null;
	if (payload?.hasAdminAccess !== true) {
		const loginUrl = new URL(LOGIN_URL, request.url);
		loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	const { path: segments } = await params;

	// Zod-validate the segments — a malformed/unsafe path must never reach the
	// filesystem (rule 13: schema validation, not string sniffing).
	const parsed = ImagePathSegmentsSchema.safeParse(segments);
	if (!parsed.success) {
		return new NextResponse("Not Found", { status: 404 });
	}

	// Resolve and enforce containment: the final path must live INSIDE
	// `docs/images/`. `path.resolve` normalizes any `..`/`.` the segments could
	// smuggle in, so this check (plus the segment regex above) closes traversal.
	const filePath = path.resolve(DOCS_IMAGES_DIR, ...parsed.data);
	if (!filePath.startsWith(`${DOCS_IMAGES_DIR}${path.sep}`)) {
		return new NextResponse("Not Found", { status: 404 });
	}

	// Only known image extensions are served (the gallery is PNGs today).
	const extension = path.extname(filePath).toLowerCase();
	const contentType = IMAGE_CONTENT_TYPES[extension];
	if (contentType === undefined) {
		return new NextResponse("Not Found", { status: 404 });
	}
	try {
		const body = await readFile(filePath);
		// Long-lived cache: image filenames are stable (regeneration overwrites
		// the same name), so a year-long immutable cache is safe and fast.
		// `private` (not `public`) — the content is auth-gated, so a shared
		// cache (CDN/proxy) must never be able to serve it to unauthenticated
		// clients; only the authenticated user's browser may cache it.
		return new NextResponse(body, {
			headers: {
				"content-type": contentType,
				"cache-control": "private, max-age=31536000, immutable",
			},
		});
	} catch {
		// File missing / unreadable → 404.
		return new NextResponse("Not Found", { status: 404 });
	}
}
