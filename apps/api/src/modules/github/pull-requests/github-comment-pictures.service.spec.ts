import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { StoredFile } from "@prisma/client";
import { describe, expect, it, vi, type Mock } from "vitest";

import { FileService } from "../../files/services/file.service";
import { GithubPictureUnavailableError, GithubWriteRejectedError } from "../github.errors";
import { GithubCommentPicturesService, linkedPicturesIn } from "./github-comment-pictures.service";
import { GithubCredentialsService, type LinkedGithubCredential } from "./github-credentials.service";
import { GithubPullRequestClient } from "./github-pull-request.client";
import { GithubRepositoryFilesClient } from "./github-repository-files.client";

const LINKED: LinkedGithubCredential = { credential: { source: "linked", token: "github_pat_linked" }, login: "octocat" };
const PULL_REQUEST = { owner: "octo-org", repository: "hello-world", number: 42 };
const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
/** Where the picture of {@link FILE_ID} is linked from a comment on pull request #42. */
const PICTURE_URL = `https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/${FILE_ID}.png`;
const PICTURE_FILE = { owner: "octo-org", repository: "hello-world", ref: "github-comment-assets", path: `pull-requests/42/${FILE_ID}.png` };
const ATTACHMENT_ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const SIGNED = `https://private-user-images.githubusercontent.com/31275601/674345813-${ATTACHMENT_ID}.jpg?jwt=eyJ0`;
const NODE = "IC_kwDOAbCdEf5r1sT2";

function upload(overrides: Partial<StoredFile> = {}): StoredFile {
	return {
		id: FILE_ID,
		category: "GITHUB_COMMENT_IMAGE",
		visibility: "PRIVATE",
		originalName: "shot.png",
		mimeType: "image/png",
		sizeBytes: PNG.length,
		expectedChecksum: "a".repeat(64),
		actualChecksum: null,
		storageProvider: null,
		storageContainer: null,
		objectRevision: null,
		storageBucket: "private",
		storagePath: `users/user-1/github-comment-images/${FILE_ID}.png`,
		publicPath: null,
		objectGeneration: null,
		imageWidth: null,
		imageHeight: null,
		status: "READY",
		scanStatus: "NOT_SCANNED",
		scannedAt: null,
		scanResult: null,
		uploadedById: "user-1",
		productId: null,
		deletedBy: null,
		organizationId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		...overrides,
	};
}

interface Harness {
	readonly service: GithubCommentPicturesService;
	readonly findFile: Mock<FileService["findFile"]>;
	readonly deleteStoredFile: Mock<FileService["deleteStoredFile"]>;
	readonly commitFile: Mock<GithubRepositoryFilesClient["commitFile"]>;
	readonly fileExists: Mock<GithubRepositoryFilesClient["fileExists"]>;
	readonly readImage: Mock<GithubRepositoryFilesClient["readImage"]>;
	readonly readSignedUpload: Mock<GithubRepositoryFilesClient["readSignedUpload"]>;
	readonly fetchBodyHtml: Mock<GithubPullRequestClient["fetchBodyHtml"]>;
	readonly withCredential: Mock;
}

async function setup(file: StoredFile | null = upload()): Promise<Harness> {
	const findFile = vi.fn<FileService["findFile"]>(() => Promise.resolve(file));
	const readStoredBytes = vi.fn<FileService["readStoredBytes"]>(() => Promise.resolve(PNG));
	const deleteStoredFile = vi.fn<FileService["deleteStoredFile"]>(() => Promise.resolve());
	const commitFile = vi.fn<GithubRepositoryFilesClient["commitFile"]>((_credential, repository, path) =>
		Promise.resolve({ ...repository, ref: "github-comment-assets", path }),
	);
	const fileExists = vi.fn<GithubRepositoryFilesClient["fileExists"]>(() => Promise.resolve(false));
	const readImage = vi.fn<GithubRepositoryFilesClient["readImage"]>(() => Promise.resolve({ bytes: PNG, mimeType: "image/png" }));
	const readSignedUpload = vi.fn<GithubRepositoryFilesClient["readSignedUpload"]>(() => Promise.resolve({ bytes: PNG, mimeType: "image/png" }));
	const fetchBodyHtml = vi.fn<GithubPullRequestClient["fetchBodyHtml"]>(() => Promise.resolve(`<p><img src="${SIGNED}" alt="shot"></p>`));
	const withCredential = vi.fn(<T>(_userId: string, use: (linked: LinkedGithubCredential) => Promise<T>): Promise<T> => use(LINKED));
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubCommentPicturesService,
			{ provide: FileService, useValue: { findFile, readStoredBytes, deleteStoredFile } },
			{ provide: GithubCredentialsService, useValue: { withCredential } },
			{ provide: GithubRepositoryFilesClient, useValue: { commitFile, fileExists, readImage, readSignedUpload } },
			{ provide: GithubPullRequestClient, useValue: { fetchBodyHtml } },
		],
	}).compile();
	return {
		service: moduleRef.get(GithubCommentPicturesService),
		findFile,
		deleteStoredFile,
		commitFile,
		fileExists,
		readImage,
		readSignedUpload,
		fetchBodyHtml,
		withCredential,
	};
}

describe("GithubCommentPicturesService.attach", () => {
	it("answers where the uploader's own picture will be, committing nothing yet", async () => {
		const { service, commitFile, deleteStoredFile } = await setup();

		const picture = await service.attach("user-1", PULL_REQUEST, { fileId: FILE_ID });

		expect(picture).toEqual({ url: PICTURE_URL, path: `pull-requests/42/${FILE_ID}.png` });
		expect(commitFile).not.toHaveBeenCalled();
		expect(deleteStoredFile).not.toHaveBeenCalled();
	});

	it.each<[string, StoredFile | null]>([
		["someone else's upload", upload({ uploadedById: "user-2" })],
		["a file of another kind", upload({ category: "USER_AVATAR" })],
		["an upload still being checked", upload({ status: "SCANNING" })],
		["a deleted upload", null],
	])("answers not found for %s", async (_name, file) => {
		const { service } = await setup(file);

		await expect(service.attach("user-1", PULL_REQUEST, { fileId: FILE_ID })).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("linkedPicturesIn", () => {
	it("finds each picture attached from the app that a body links in this repository, once, as markdown or HTML", () => {
		const body = [`![shot](${PICTURE_URL})`, `<img src="${PICTURE_URL}" width="200" />`, `Again: ${PICTURE_URL}.`].join("\n");

		expect(linkedPicturesIn(body, PULL_REQUEST)).toEqual([{ number: 42, fileId: FILE_ID, extension: "png", file: PICTURE_FILE }]);
	});

	it("ignores other repositories, other branches, and files the app did not attach", () => {
		const body = [
			`![a](https://github.com/someone/else/raw/github-comment-assets/pull-requests/42/${FILE_ID}.png)`,
			`![b](https://github.com/octo-org/hello-world/raw/main/pull-requests/42/${FILE_ID}.png)`,
			"![c](https://github.com/octo-org/hello-world/raw/github-comment-assets/docs/logo.png)",
			"![d](https://example.com/picture.png)",
		].join("\n");

		expect(linkedPicturesIn(body, PULL_REQUEST)).toEqual([]);
	});
});

describe("GithubCommentPicturesService.commitLinkedPictures", () => {
	it("commits the caller's linked upload where its address says, then deletes the upload", async () => {
		const { service, commitFile, deleteStoredFile } = await setup();

		await service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, `Before and after: ![shot](${PICTURE_URL})`);

		expect(commitFile).toHaveBeenCalledWith(
			LINKED.credential,
			{ owner: "octo-org", repository: "hello-world" },
			`pull-requests/42/${FILE_ID}.png`,
			PNG,
			"Add a picture for pull request #42",
		);
		expect(deleteStoredFile).toHaveBeenCalledWith(expect.objectContaining({ id: FILE_ID }), "user-1");
	});

	it("commits nothing for a body without attached pictures — a picture taken out of the draft is never committed", async () => {
		const { service, commitFile, findFile } = await setup();

		await service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, "Looks good.");

		expect(findFile).not.toHaveBeenCalled();
		expect(commitFile).not.toHaveBeenCalled();
	});

	it("leaves a picture already committed as it is", async () => {
		const { service, commitFile, fileExists } = await setup(null);
		fileExists.mockResolvedValueOnce(true);

		await service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, `![shot](${PICTURE_URL})`);

		expect(fileExists).toHaveBeenCalledWith(LINKED.credential, PICTURE_FILE);
		expect(commitFile).not.toHaveBeenCalled();
	});

	it("refuses a picture whose upload is gone and that was never committed", async () => {
		const { service } = await setup(null);

		await expect(service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, `![shot](${PICTURE_URL})`)).rejects.toBeInstanceOf(GithubPictureUnavailableError);
	});

	it("takes a picture another post committed a moment earlier as done", async () => {
		const { service, commitFile, fileExists, deleteStoredFile } = await setup();
		commitFile.mockRejectedValueOnce(new GithubWriteRejectedError("unprocessable", 'Invalid request. "sha" wasn\'t supplied.', "octo-org/hello-world", "Contents"));
		fileExists.mockResolvedValueOnce(true);

		await service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, `![shot](${PICTURE_URL})`);

		expect(deleteStoredFile).toHaveBeenCalledTimes(1);
	});

	it("still posts when the committed picture's upload cannot be deleted (the sweep removes it later)", async () => {
		const { service, deleteStoredFile } = await setup();
		deleteStoredFile.mockRejectedValueOnce(new Error("storage down"));

		await expect(service.commitLinkedPictures(LINKED.credential, "user-1", PULL_REQUEST, `![shot](${PICTURE_URL})`)).resolves.toBeUndefined();
	});
});

describe("GithubCommentPicturesService serving", () => {
	it("reads a repository picture with the caller's own token", async () => {
		const { service, readImage, withCredential } = await setup();

		await expect(service.repositoryPicture("user-7", PICTURE_FILE)).resolves.toEqual({ bytes: PNG, mimeType: "image/png" });
		expect(withCredential).toHaveBeenCalledWith("user-7", expect.any(Function));
		expect(readImage).toHaveBeenCalledWith(LINKED.credential, PICTURE_FILE, expect.any(Number));
	});

	it("reads an upload through the signed link GitHub puts in the body now, read with the caller's token", async () => {
		const { service, fetchBodyHtml, readSignedUpload } = await setup();

		await expect(service.uploadedPicture("user-7", ATTACHMENT_ID, NODE)).resolves.toEqual({ bytes: PNG, mimeType: "image/png" });
		expect(fetchBodyHtml).toHaveBeenCalledWith(LINKED.credential, NODE);
		expect(readSignedUpload).toHaveBeenCalledWith(SIGNED, NODE, expect.any(Number));
	});

	it("answers not found for an upload the body does not show", async () => {
		const { service, readSignedUpload } = await setup();

		await expect(service.uploadedPicture("user-7", "00000000-0000-4000-8000-000000000000", NODE)).rejects.toBeInstanceOf(NotFoundException);
		expect(readSignedUpload).not.toHaveBeenCalled();
	});
});
