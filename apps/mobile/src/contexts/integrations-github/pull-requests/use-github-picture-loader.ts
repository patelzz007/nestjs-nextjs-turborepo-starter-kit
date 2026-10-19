// How a GitHub comment's pictures load (ADR 052). The API lists, beside the
// markdown, where each picture loads from (`images`): GitHub's image proxy or
// the picture's own address for most, and an address of the API's own
// (`/github/pictures/…`) for one GitHub shows only to signed-in readers — a
// file kept in a repository, an upload to a private repository. Those are
// asked for from the API the app talks to, signed in (api-image-authorization);
// only an address the API itself listed is, never one a comment merely names.

import { API_VERSION_PREFIX, GITHUB_PICTURES_PATH, githubImageUrlFor, type GithubBodyImage } from "@workspace/shared";
import * as React from "react";
import { z } from "zod";

import type { MarkdownImageLoader } from "../../../components/markdown";
import { useApiImageSources, type ImageSource } from "../../../lib/api-image-authorization";

const PICTURES_PREFIX = `${API_VERSION_PREFIX}${GITHUB_PICTURES_PATH}/`;

/** The API path (without its version prefix) of a picture address the API listed, or `null` for any other address. */
export function apiPicturePathOf(url: string, images: readonly GithubBodyImage[]): string | null {
	const parsed = z.url().safeParse(url);
	if (!parsed.success || !images.some((image: GithubBodyImage): boolean => image.url === url)) {
		return null;
	}
	const { pathname, search } = new URL(parsed.data);
	return pathname.startsWith(PICTURES_PREFIX) ? `${pathname.slice(API_VERSION_PREFIX.length)}${search}` : null;
}

export function useGithubPictureLoader(images: readonly GithubBodyImage[]): MarkdownImageLoader {
	const api = useApiImageSources();
	return React.useMemo(
		(): MarkdownImageLoader => ({
			sourceFor: (href: string): ImageSource | null => {
				const url = githubImageUrlFor(href, images);
				const path = apiPicturePathOf(url, images);
				return path === null ? { uri: url } : api.sourceFor(path);
			},
			onFailed: (source: ImageSource): void => {
				// Only a picture asked for signed in can be helped by a renewed session.
				if (source.headers !== undefined) {
					api.onFailed(source);
				}
			},
		}),
		[api, images],
	);
}
