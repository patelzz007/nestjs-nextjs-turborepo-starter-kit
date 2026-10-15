import { describe, expect, it } from "vitest";

import {
	GITHUB_REACTION_CONTENTS,
	GITHUB_REACTION_EMOJI,
	GithubReactionSubjectSchema,
	SetGithubReactionSchema,
	withViewerReaction,
	type GithubReactionGroup,
} from "./github-reactions";

describe("GitHub reactions", () => {
	it("lists GitHub's eight reactions in its order, each with an emoji", () => {
		expect(GITHUB_REACTION_CONTENTS).toEqual(["thumbsUp", "thumbsDown", "laugh", "hooray", "confused", "heart", "rocket", "eyes"]);
		expect(GITHUB_REACTION_CONTENTS.map((content) => GITHUB_REACTION_EMOJI[content]).join("")).toBe("👍👎😄🎉😕❤️🚀👀");
	});

	it("names a subject by its GitHub id, kept as a string (ids no longer fit 32 bits)", () => {
		expect(GithubReactionSubjectSchema.parse({ type: "issueComment", commentId: "6186769145" })).toEqual({ type: "issueComment", commentId: "6186769145" });
		expect(GithubReactionSubjectSchema.safeParse({ type: "issueComment", commentId: "0" }).success).toBe(false);
		expect(GithubReactionSubjectSchema.safeParse({ type: "issueComment", commentId: "12/../1" }).success).toBe(false);
		expect(SetGithubReactionSchema.safeParse({ subject: { type: "pullRequest" }, content: "heart", reacted: true, extra: 1 }).success).toBe(false);
		expect(SetGithubReactionSchema.safeParse({ subject: { type: "pullRequest" }, content: "heart", reacted: true }).success).toBe(true);
		expect(SetGithubReactionSchema.safeParse({ subject: { type: "pullRequest" }, content: "+1", reacted: true }).success).toBe(false);
	});

	it("adds the viewer's reaction in GitHub's order, and takes it away again", () => {
		const groups: GithubReactionGroup[] = [{ content: "heart", count: 2, viewerHasReacted: false }];

		const added = withViewerReaction(groups, "thumbsUp", true);
		expect(added).toEqual([
			{ content: "thumbsUp", count: 1, viewerHasReacted: true },
			{ content: "heart", count: 2, viewerHasReacted: false },
		]);
		expect(withViewerReaction(added, "thumbsUp", false)).toEqual(groups);
		expect(withViewerReaction(groups, "heart", true)).toEqual([{ content: "heart", count: 3, viewerHasReacted: true }]);
	});

	it("changes nothing when the reaction already stands as asked", () => {
		const groups: GithubReactionGroup[] = [{ content: "rocket", count: 1, viewerHasReacted: true }];

		expect(withViewerReaction(groups, "rocket", true)).toEqual(groups);
		expect(withViewerReaction(groups, "eyes", false)).toEqual(groups);
	});
});
