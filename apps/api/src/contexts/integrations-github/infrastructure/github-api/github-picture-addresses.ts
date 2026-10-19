// ============================================
// github-picture-addresses.ts - The API's own addresses for pictures GitHub shows only to signed-in readers (ADR 052)
// ============================================
// Two kinds of picture in a comment open only for a signed-in reader on
// GitHub: a file kept in a repository (the app's comment pictures, or any
// `github.com/<owner>/<repo>/raw/<ref>/<path>`), and an upload to a private
// repository (GitHub's signed `private-user-images…` link to it expires in
// minutes). The app has no GitHub session, so each is listed with an address
// of the API's (`/github/pictures/…`, `GithubPicturesController`). The address
// names the picture only — no reader, no expiry — so a cached answer never
// carries a dead link: the app opens it signed in as itself, and the API reads
// the picture then, with that reader's own GitHub token, so GitHub still
// decides who sees it.

import { Injectable } from "@nestjs/common";
import { API_VERSION_PREFIX, apiRoutes, githubAttachmentIdOf, type GithubRepositoryFile } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { repositoryFileOf } from "../../domain/policies/github-picture-address.policy";
import { isSignedUploadLink, type BodyImageLink } from "./github-body-images";

@Injectable()
export class GithubPictureAddresses {
	public constructor(private readonly config: TypedConfigService) {}

	/** Where the app loads each picture of a body: the API's address for the two kinds above, GitHub's own for the rest. */
	public readonly linkFor: BodyImageLink = (src: string, nodeId: string): string => {
		const file = repositoryFileOf(src);
		if (file !== null) {
			return this.repositoryFileAddress(file);
		}
		const attachmentId = isSignedUploadLink(src) ? githubAttachmentIdOf(src) : null;
		return attachmentId === null ? src : this.uploadAddress(attachmentId, nodeId);
	};

	private repositoryFileAddress(file: GithubRepositoryFile): string {
		const query = new URLSearchParams({ owner: file.owner, repository: file.repository, ref: file.ref, path: file.path });
		return `${this.config.http.publicUrl}${API_VERSION_PREFIX}${apiRoutes.githubPictures.file}?${query.toString()}`;
	}

	private uploadAddress(attachmentId: string, nodeId: string): string {
		const path = apiRoutes.githubPictures.upload.replace(":attachmentId", encodeURIComponent(attachmentId));
		return `${this.config.http.publicUrl}${API_VERSION_PREFIX}${path}?${new URLSearchParams({ node: nodeId }).toString()}`;
	}
}
