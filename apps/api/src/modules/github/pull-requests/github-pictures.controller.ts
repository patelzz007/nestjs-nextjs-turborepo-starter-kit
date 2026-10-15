import { Controller, Get, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
	apiPath,
	apiRoutes,
	GITHUB_PICTURES_PATH,
	GithubRepositoryFileSchema,
	GithubUploadedPictureParamsSchema,
	GithubUploadedPictureQuerySchema,
	type GithubRepositoryFile,
	type GithubUploadedPictureParams,
	type GithubUploadedPictureQuery,
} from "@workspace/shared";
import type { FastifyReply } from "fastify";

import { SkipEnvelope } from "../../../common/decorators/skip-envelope.decorator";
import { ZodParams, ZodQuery } from "../../../common/decorators/zod-request.decorators";
import { AdminAccessOnly } from "../../auth/decorators/admin-access.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GithubCommentPicturesService } from "./github-comment-pictures.service";
import { PULL_REQUEST_READ_ERRORS } from "./github-pull-requests.api-docs";
import type { RepositoryImage } from "./github-repository-files.client";

/** A picture changes only by being replaced under a new name, so the viewer may keep it a while — in its own cache only. */
const PICTURE_CACHE_CONTROL = "private, max-age=3600";

const PICTURE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** A route of {@link apiRoutes.githubPictures}, relative to the controller's prefix. */
function underPrefix(route: string): string {
	return route.replace(`${GITHUB_PICTURES_PATH}/`, "");
}

async function sendPicture(reply: FastifyReply, picture: RepositoryImage): Promise<void> {
	await reply
		.header("Content-Type", picture.mimeType)
		.header("X-Content-Type-Options", "nosniff")
		.header("Content-Security-Policy", "default-src 'none'; sandbox")
		.header("Cache-Control", PICTURE_CACHE_CONTROL)
		.send(picture.bytes);
}

/**
 * Pictures GitHub shows only to a signed-in reader, for the app (ADR 052): a
 * file kept in a repository, and an upload to a private repository. Comments
 * list them with these addresses (`GithubPictureAddresses`), which name no
 * reader and never expire; the app opens them signed in, like any request,
 * and each picture is read then with the caller's own linked token, so GitHub
 * still decides who sees it. Served with `nosniff` and a sandboxing CSP: only
 * JPEG, PNG, WebP and AVIF (checked by their bytes) are answered.
 */
@ApiTags("GitHub pull requests")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for GitHub pull requests.")
@Controller(apiPath(GITHUB_PICTURES_PATH))
export class GithubPicturesController {
	public constructor(private readonly pictures: GithubCommentPicturesService) {}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@SkipEnvelope()
	// A conversation loads many pictures at once, like a page of images from a CDN: the `strict` limit does not apply (the `default` one still does).
	@SkipThrottle({ strict: true })
	@Get(underPrefix(apiRoutes.githubPictures.file))
	@ApiOperation({ summary: "A picture kept in a repository, read with your GitHub token", description: PULL_REQUEST_READ_ERRORS })
	@ApiProduces(...PICTURE_TYPES)
	@ApiOkResponse({ description: "The picture's bytes" })
	public async file(@GetUser("sub") userId: string, @ZodQuery(GithubRepositoryFileSchema) file: GithubRepositoryFile, @Res() reply: FastifyReply): Promise<void> {
		await sendPicture(reply, await this.pictures.repositoryPicture(userId, file));
	}

	@RequirePermission("READ", "GITHUB_PULL_REQUEST")
	@SkipEnvelope()
	@SkipThrottle({ strict: true })
	@Get(underPrefix(apiRoutes.githubPictures.upload))
	@ApiOperation({
		summary: "An upload to a private repository, shown in a comment",
		description: `\`node\` is the pull request, comment, review or line comment whose body shows it: that body is read with your GitHub token, and the picture through GitHub's fresh signed link in it. ${PULL_REQUEST_READ_ERRORS}`,
	})
	@ApiProduces(...PICTURE_TYPES)
	@ApiOkResponse({ description: "The picture's bytes" })
	public async upload(
		@GetUser("sub") userId: string,
		@ZodParams(GithubUploadedPictureParamsSchema) params: GithubUploadedPictureParams,
		@ZodQuery(GithubUploadedPictureQuerySchema) query: GithubUploadedPictureQuery,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendPicture(reply, await this.pictures.uploadedPicture(userId, params.attachmentId, query.node));
	}
}
