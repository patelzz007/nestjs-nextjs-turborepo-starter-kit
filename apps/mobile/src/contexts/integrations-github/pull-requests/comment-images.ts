// ============================================
// comment-images.ts - Pictures attached to a comment, as markdown (ADR 052)
// ============================================
// GitHub has no API for its own uploads, so a picture attached from the app is
// stored by the API (`GITHUB_COMMENT_IMAGE`, public) and the comment links to
// it in markdown, which GitHub shows like any other picture. While it uploads,
// the comment holds a placeholder line, as GitHub's own editor does, so the
// writer sees where it will go. Pure: the composer's hook does the work.

import { DocumentMimeTypeSchema, FILE_CATEGORY_POLICIES, type DocumentMimeType } from "@workspace/shared";

/** What the comment pictures may be: the API's own rules for the category. */
export const COMMENT_IMAGE_POLICY = FILE_CATEGORY_POLICIES.GITHUB_COMMENT_IMAGE;

const BYTES_PER_MEGABYTE = 1_048_576;

/** Characters that would end a markdown picture's description or address early. */
const MARKDOWN_LABEL_UNSAFE = /[[\]\\]/gu;
const FILE_EXTENSION = /\.[^.]+$/u;
/** Characters that would end a markdown address early; escaped one by one (the rest of the address is already encoded). */
const MARKDOWN_ADDRESS_UNSAFE = /[\s()<>]/gu;

/** A picked picture as the picker describes it. */
export interface PickedImage {
	readonly fileName: string | null;
	readonly mimeType: string | null;
	readonly fileSize: number | null;
}

/** Why a picked picture cannot be attached, in the writer's words; `null` when it can. */
export function pickedImageProblem(image: PickedImage): string | null {
	const mimeType = DocumentMimeTypeSchema.safeParse(image.mimeType);
	if (!mimeType.success || !COMMENT_IMAGE_POLICY.allowedMimeTypes.includes(mimeType.data)) {
		return "Attach a JPEG, PNG or WebP picture.";
	}
	if (image.fileSize !== null && image.fileSize > COMMENT_IMAGE_POLICY.maxBytes) {
		return `Pictures can be up to ${String(Math.floor(COMMENT_IMAGE_POLICY.maxBytes / BYTES_PER_MEGABYTE))} MB.`;
	}
	return null;
}

/** The picture's type when the picker named an allowed one. */
export function pickedImageMimeType(image: PickedImage): DocumentMimeType | null {
	const parsed = DocumentMimeTypeSchema.safeParse(image.mimeType);
	return parsed.success && COMMENT_IMAGE_POLICY.allowedMimeTypes.includes(parsed.data) ? parsed.data : null;
}

/** The picture's name, or a plain one when the picker gave none. */
export function pickedImageName(image: PickedImage): string {
	const name = image.fileName?.trim() ?? "";
	return name.length > 0 ? name : "image";
}

/** The picture's description in the comment: its name without the extension or markdown's brackets. */
function descriptionOf(fileName: string): string {
	const description = fileName.replace(FILE_EXTENSION, "").replace(MARKDOWN_LABEL_UNSAFE, "").trim();
	return description.length > 0 ? description : "image";
}

/** The line that holds a picture's place while it uploads. */
export function uploadingPlaceholder(fileName: string): string {
	return `![Uploading ${descriptionOf(fileName)}…]()`;
}

/** The markdown that shows an uploaded picture. */
export function imageMarkdown(fileName: string, url: string): string {
	return `![${descriptionOf(fileName)}](${url.replace(MARKDOWN_ADDRESS_UNSAFE, encodeURIComponent)})`;
}

/** The comment with `line` added on a line of its own at the end. */
export function withLineAppended(body: string, line: string): string {
	if (body.length === 0) {
		return line;
	}
	return body.endsWith("\n") ? `${body}${line}` : `${body}\n${line}`;
}

/** The comment with a placeholder swapped for the picture, or removed (`replacement` empty) — and the line it stood on with it. */
export function withPlaceholderReplaced(body: string, placeholder: string, replacement: string): string {
	if (replacement.length > 0) {
		return body.replace(placeholder, replacement);
	}
	const withoutLine = body.replace(`\n${placeholder}`, "");
	return withoutLine === body ? body.replace(placeholder, "") : withoutLine;
}
