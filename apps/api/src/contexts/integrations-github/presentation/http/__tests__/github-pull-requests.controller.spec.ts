import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { Idempotent } from "../../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { RequirePermission } from "../../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessGuard } from "../../../../../platform/presentation/http/security/guards/admin-access.guard";
import { IS_PUBLIC_KEY } from "../../../../../platform/presentation/http/security/decorators/public.decorator";
import { GithubAccountController } from "../github-account.controller";
import { GithubLiveUpdatesController } from "../github-live-updates.controller";
import { GithubRepositoryVisibleGuard } from "../github-repository-visible.guard";
import { GithubWebhookController } from "../github-webhook.controller";
import { GithubContentEditsController } from "../github-content-edits.controller";
import { GithubPicturesController } from "../github-pictures.controller";
import { GithubPullRequestsController } from "../github-pull-requests.controller";
import { handlerOf, metadataKeyOf } from "./route-metadata";

const reflector = new Reflector();

/** The keys the decorators store their options under, named through the decorators themselves. */
const REQUIRED_PERMISSION_KEY = RequirePermission("READ", "GITHUB").KEY;
const IDEMPOTENT_OPTIONS_METADATA = metadataKeyOf(Idempotent({ required: true }), { required: true });

type ControllerClass =
	| typeof GithubAccountController
	| typeof GithubPullRequestsController
	| typeof GithubContentEditsController
	| typeof GithubLiveUpdatesController
	| typeof GithubPicturesController;

/** What the reflector reads off one handler. */
interface RouteMetadata {
	readonly path: string | undefined;
	readonly permission: object | undefined;
	readonly idempotent: object | undefined;
	readonly responseContract: object | undefined;
}

function metadataOf(
	handler:
		| GithubAccountController[keyof GithubAccountController]
		| GithubPullRequestsController[keyof GithubPullRequestsController]
		| GithubContentEditsController["contentEdits"]
		| GithubLiveUpdatesController[keyof GithubLiveUpdatesController]
		| GithubPicturesController[keyof GithubPicturesController],
): RouteMetadata {
	return {
		path: reflector.get<string | undefined>(PATH_METADATA, handler),
		permission: reflector.get<object | undefined>(REQUIRED_PERMISSION_KEY, handler),
		idempotent: reflector.get<object | undefined>(IDEMPOTENT_OPTIONS_METADATA, handler),
		responseContract: reflector.get(ResponseContract, handler),
	};
}

const account = (key: keyof GithubAccountController): RouteMetadata => metadataOf(handlerOf(GithubAccountController.prototype, key));
const liveUpdates = (key: keyof GithubLiveUpdatesController): RouteMetadata => metadataOf(handlerOf(GithubLiveUpdatesController.prototype, key));
const pullRequests = (key: keyof GithubPullRequestsController): RouteMetadata => metadataOf(handlerOf(GithubPullRequestsController.prototype, key));
const pictures = (key: keyof GithubPicturesController): RouteMetadata => metadataOf(handlerOf(GithubPicturesController.prototype, key));

const ROUTES: readonly [string, RouteMetadata, string, "READ" | "UPDATE"][] = [
	["GithubAccountController.status", account("status"), "/", "READ"],
	["GithubAccountController.link", account("link"), "/", "UPDATE"],
	["GithubAccountController.unlink", account("unlink"), "/", "UPDATE"],
	["GithubPullRequestsController.list", pullRequests("list"), "/", "READ"],
	["GithubPullRequestsController.detail", pullRequests("detail"), ":owner/:repository/:number", "READ"],
	["GithubPullRequestsController.timeline", pullRequests("timeline"), ":owner/:repository/:number/timeline", "READ"],
	["GithubPullRequestsController.commits", pullRequests("commits"), ":owner/:repository/:number/commits", "READ"],
	["GithubPullRequestsController.commit", pullRequests("commit"), ":owner/:repository/:number/commits/:sha", "READ"],
	["GithubPullRequestsController.status", pullRequests("status"), ":owner/:repository/:number/status", "READ"],
	["GithubPullRequestsController.addComment", pullRequests("addComment"), ":owner/:repository/:number/comments", "UPDATE"],
	["GithubPullRequestsController.submitReview", pullRequests("submitReview"), ":owner/:repository/:number/reviews", "UPDATE"],
	["GithubPullRequestsController.merge", pullRequests("merge"), ":owner/:repository/:number/merge", "UPDATE"],
	["GithubPullRequestsController.attachPicture", pullRequests("attachPicture"), ":owner/:repository/:number/pictures", "UPDATE"],
	["GithubPullRequestsController.setReaction", pullRequests("setReaction"), ":owner/:repository/:number/reactions", "UPDATE"],
	["GithubPullRequestsController.files", pullRequests("files"), ":owner/:repository/:number/files", "READ"],
	["GithubPullRequestsController.reviewThreads", pullRequests("reviewThreads"), ":owner/:repository/:number/review-threads", "READ"],
	["GithubLiveUpdatesController.status", liveUpdates("status"), ":owner/:repository", "READ"],
	["GithubLiveUpdatesController.enable", liveUpdates("enable"), ":owner/:repository", "UPDATE"],
	["GithubLiveUpdatesController.disable", liveUpdates("disable"), ":owner/:repository", "UPDATE"],
	["GithubLiveUpdatesController.stream", liveUpdates("stream"), ":owner/:repository/events", "READ"],
	["GithubPicturesController.file", pictures("file"), "file", "READ"],
	["GithubPicturesController.upload", pictures("upload"), "uploads/:attachmentId", "READ"],
	["GithubContentEditsController.contentEdits", metadataOf(handlerOf(GithubContentEditsController.prototype, "contentEdits")), ":nodeId", "READ"],
];

describe("pull-request controllers", () => {
	it.each([
		[GithubAccountController, "/github/account"],
		[GithubPullRequestsController, "/github/pull-requests"],
		[GithubContentEditsController, "/github/content-edits"],
		[GithubLiveUpdatesController, "/github/live-updates"],
		[GithubPicturesController, "/github/pictures"],
	])("serves %o under the versioned %s prefix, admin panel only", (controller: ControllerClass, prefix: string) => {
		expect(reflector.get<string>(PATH_METADATA, controller)).toBe(`${API_VERSION_PREFIX}${prefix}`);
		expect(reflector.get<readonly object[]>(GUARDS_METADATA, controller)).toContain(AdminAccessGuard);
	});

	it.each(ROUTES)("routes %s to %j and requires %s GITHUB_PULL_REQUEST", (_name: string, metadata: RouteMetadata, path: string, action: "READ" | "UPDATE") => {
		expect(metadata.path).toBe(path);
		expect(metadata.permission).toEqual({ action, resource: "GITHUB_PULL_REQUEST" });
	});

	it.each(ROUTES.filter(([name]) => !name.startsWith("GithubPicturesController") && name !== "GithubLiveUpdatesController.stream"))(
		"declares one response contract on %s",
		(_name: string, metadata: RouteMetadata) => {
			expect(metadata.responseContract).toBeDefined();
		},
	);

	it.each<keyof GithubPullRequestsController>(["addComment", "submitReview", "attachPicture", "merge"])(
		"requires an Idempotency-Key on %s, so a retry never posts to GitHub twice",
		(name) => {
			expect(pullRequests(name).idempotent).toEqual({ required: true });
		},
	);

	it.each<keyof GithubPicturesController>(["file", "upload"])(
		"serves pictures (%s) to signed-in admins only — the address names no reader, so the session is the credential",
		(key) => {
			expect(reflector.get<boolean | undefined>(IS_PUBLIC_KEY, handlerOf(GithubPicturesController.prototype, key))).toBeUndefined();
		},
	);

	it("opens a repository's change stream only past the visibility guard", () => {
		expect(reflector.get<readonly object[]>(GUARDS_METADATA, handlerOf(GithubLiveUpdatesController.prototype, "stream"))).toEqual([GithubRepositoryVisibleGuard]);
	});

	it("receives GitHub's webhook publicly, outside the admin guard — the signature is the credential", () => {
		const handler = handlerOf(GithubWebhookController.prototype, "receive");
		expect(reflector.get<string>(PATH_METADATA, GithubWebhookController)).toBe(`${API_VERSION_PREFIX}/github/webhook`);
		expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
		expect(reflector.get<readonly object[] | undefined>(GUARDS_METADATA, GithubWebhookController)).toBeUndefined();
		expect(reflector.get<number>(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
	});

	it("sets a reaction with PUT and no Idempotency-Key: setting it to what it already is changes nothing", () => {
		expect(reflector.get<number>(METHOD_METADATA, handlerOf(GithubPullRequestsController.prototype, "setReaction"))).toBe(RequestMethod.PUT);
		expect(pullRequests("setReaction").idempotent).toBeUndefined();
	});
});
