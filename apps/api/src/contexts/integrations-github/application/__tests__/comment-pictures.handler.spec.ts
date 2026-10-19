import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AttachPullRequestPictureCommand } from "../commands/attach-pull-request-picture/attach-pull-request-picture.command";
import { AttachPullRequestPictureHandler } from "../commands/attach-pull-request-picture/attach-pull-request-picture.handler";
import { GithubPictureUnavailableError, GithubWriteRejectedError } from "../errors/github.errors";
import type { CommentPictureUpload } from "../ports/comment-picture-uploads.port";
import { GetRepositoryPictureHandler } from "../queries/get-repository-picture/get-repository-picture.handler";
import { GetRepositoryPictureQuery } from "../queries/get-repository-picture/get-repository-picture.query";
import { GetUploadedPictureHandler } from "../queries/get-uploaded-picture/get-uploaded-picture.handler";
import { GetUploadedPictureQuery, GITHUB_SERVED_PICTURE_MAX_BYTES } from "../queries/get-uploaded-picture/get-uploaded-picture.query";
import { OTHER_USER_ID, PULL_REQUEST, USER_ID, userActor } from "./fakes/github-contract.fixtures";
import { PNG_BYTES } from "./fakes/github-fakes";
import { githubHarness, LINKED_TOKEN, linkToken } from "./fakes/github-harness";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const PICTURE_PATH = `pull-requests/42/${FILE_ID}.png`;
/** Where the picture of {@link FILE_ID} is linked from a comment on pull request #42. */
const PICTURE_URL = `https://github.com/octo-org/hello-world/raw/github-comment-assets/${PICTURE_PATH}`;
const PICTURE_FILE = { owner: "octo-org", repository: "hello-world", ref: "github-comment-assets", path: PICTURE_PATH };
const ATTACHMENT_ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const SIGNED = `https://private-user-images.githubusercontent.com/31275601/674345813-${ATTACHMENT_ID}.jpg?jwt=eyJ0`;
const NODE = "IC_kwDOAbCdEf5r1sT2";

function upload(overrides: Partial<CommentPictureUpload> = {}): CommentPictureUpload {
	return { id: FILE_ID, category: "GITHUB_COMMENT_IMAGE", uploadedById: USER_ID, status: "READY", extension: "png", ...overrides };
}

describe("AttachPullRequestPictureHandler", () => {
	it("answers where the uploader's own picture will be, committing nothing yet", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());

		const picture = await new AttachPullRequestPictureHandler(harness.uploads).execute(
			new AttachPullRequestPictureCommand(userActor(), { params: PULL_REQUEST, picture: { fileId: FILE_ID } }),
		);

		expect(picture).toEqual({ url: PICTURE_URL, path: PICTURE_PATH });
		expect(harness.repositoryFiles.committed).toEqual([]);
		expect(harness.uploads.discarded).toEqual([]);
	});

	it.each<[string, CommentPictureUpload | null]>([
		["someone else's upload", upload({ uploadedById: OTHER_USER_ID })],
		["an upload with no uploader", upload({ uploadedById: null })],
		["a file of another kind", upload({ category: "USER_AVATAR" })],
		["an upload still being checked", upload({ status: "SCANNING" })],
		["a deleted upload", null],
	])("answers not found for %s", async (_name, file) => {
		const harness = githubHarness();
		if (file !== null) {
			harness.uploads.add(file);
		}

		await expect(
			new AttachPullRequestPictureHandler(harness.uploads).execute(new AttachPullRequestPictureCommand(userActor(), { params: PULL_REQUEST, picture: { fileId: FILE_ID } })),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("GithubCommentPictures.commitLinkedPictures", () => {
	const linked = { token: LINKED_TOKEN, login: "octocat" };

	it("commits the caller's linked upload where its address says, then deletes the upload", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());

		await harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `Before and after: ![shot](${PICTURE_URL})`);

		expect(harness.repositoryFiles.committed).toEqual([`${LINKED_TOKEN}:octo-org/hello-world:${PICTURE_PATH}`]);
		expect(harness.uploads.discarded).toEqual([`${FILE_ID}:${USER_ID}`]);
	});

	it("commits nothing for a body without attached pictures — a picture taken out of the draft is never committed", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());

		await harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, "Looks good.");

		expect(harness.repositoryFiles.committed).toEqual([]);
		expect(harness.uploads.discarded).toEqual([]);
	});

	it("leaves a picture already committed as it is", async () => {
		const harness = githubHarness();
		harness.repositoryFiles.existing.add(PICTURE_PATH);

		await harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`);

		expect(harness.repositoryFiles.committed).toEqual([]);
	});

	it("does not commit another user's upload, nor one whose type differs from its address", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload({ extension: "jpg" }));

		await expect(harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`)).rejects.toBeInstanceOf(GithubPictureUnavailableError);
		expect(harness.repositoryFiles.committed).toEqual([]);
	});

	it("refuses a picture whose upload is gone and that was never committed", async () => {
		await expect(githubHarness().pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`)).rejects.toBeInstanceOf(
			GithubPictureUnavailableError,
		);
	});

	it("takes a picture another post committed a moment earlier as done", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());
		harness.repositoryFiles.commitFailure = new GithubWriteRejectedError("unprocessable", 'Invalid request. "sha" wasn\'t supplied.', "octo-org/hello-world", "Contents");
		harness.repositoryFiles.existing.add(PICTURE_PATH);

		await harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`);

		expect(harness.uploads.discarded).toEqual([`${FILE_ID}:${USER_ID}`]);
	});

	it("passes on a refusal that left no file behind", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());
		harness.repositoryFiles.commitFailure = new GithubWriteRejectedError("forbidden", "", "octo-org/hello-world", "Contents");

		await expect(harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`)).rejects.toBeInstanceOf(GithubWriteRejectedError);
		expect(harness.uploads.discarded).toEqual([]);
	});

	it("still posts when the committed picture's upload cannot be deleted (the sweep removes it later)", async () => {
		const harness = githubHarness();
		harness.uploads.add(upload());
		harness.uploads.discardFailure = new Error("storage down");

		await expect(harness.pictures.commitLinkedPictures(linked, USER_ID, PULL_REQUEST, `![shot](${PICTURE_URL})`)).resolves.toBeUndefined();
	});
});

describe("serving pictures", () => {
	it("reads a repository picture with the caller's own token", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(
			new GetRepositoryPictureHandler(harness.credentials, harness.repositoryFiles).execute(new GetRepositoryPictureQuery(userActor(), PICTURE_FILE)),
		).resolves.toEqual({
			bytes: PNG_BYTES,
			mimeType: "image/png",
		});
		expect(harness.repositoryFiles.reads).toEqual([`${LINKED_TOKEN}:${PICTURE_PATH}:${String(GITHUB_SERVED_PICTURE_MAX_BYTES)}`]);
	});

	it("reads an upload through the signed link GitHub puts in the body now, read with the caller's token", async () => {
		const harness = githubHarness();
		await linkToken(harness);
		harness.repositoryFiles.signedLinks.set(NODE, new Map([[ATTACHMENT_ID, SIGNED]]));

		await expect(
			new GetUploadedPictureHandler(harness.credentials, harness.repositoryFiles).execute(
				new GetUploadedPictureQuery(userActor(), { attachmentId: ATTACHMENT_ID, nodeId: NODE }),
			),
		).resolves.toEqual({ bytes: PNG_BYTES, mimeType: "image/png" });
		expect(harness.repositoryFiles.reads).toEqual([`${SIGNED}:${NODE}:${String(GITHUB_SERVED_PICTURE_MAX_BYTES)}`]);
	});

	it("answers not found for an upload the body does not show", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(
			new GetUploadedPictureHandler(harness.credentials, harness.repositoryFiles).execute(
				new GetUploadedPictureQuery(userActor(), { attachmentId: ATTACHMENT_ID, nodeId: NODE }),
			),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(harness.repositoryFiles.reads).toEqual([]);
	});
});
