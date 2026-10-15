// ============================================
// github-reactions.ts - Emoji reactions on a pull request and its comments (ADR 052)
// ============================================
// GitHub's eight reactions (👍 👎 😄 🎉 😕 ❤️ 🚀 👀): how many people chose
// each, and whether the linked account did. What can be reacted to is named by
// a subject — the pull request itself, a conversation comment or a line
// comment — because GitHub's REST API (which accepts a fine-grained token)
// addresses each by its own path and numeric id. A review's summary has no
// REST reactions, so it has no subject: its reactions are shown, not changed.

import { z } from "zod";

/** GitHub's reactions, in the order GitHub shows them. */
export const GithubReactionContentSchema = z.enum(["thumbsUp", "thumbsDown", "laugh", "hooray", "confused", "heart", "rocket", "eyes"]);

export type GithubReactionContent = z.output<typeof GithubReactionContentSchema>;

/** Every reaction, in GitHub's order — the picker's choices. */
export const GITHUB_REACTION_CONTENTS: readonly GithubReactionContent[] = GithubReactionContentSchema.options;

/** The emoji each reaction is drawn as. */
export const GITHUB_REACTION_EMOJI: Readonly<Record<GithubReactionContent, string>> = {
	thumbsUp: "👍",
	thumbsDown: "👎",
	laugh: "😄",
	hooray: "🎉",
	confused: "😕",
	heart: "❤️",
	rocket: "🚀",
	eyes: "👀",
};

/** What each reaction is called, for screen readers ("thumbs up"). */
export const GITHUB_REACTION_NAMES: Readonly<Record<GithubReactionContent, string>> = {
	thumbsUp: "thumbs up",
	thumbsDown: "thumbs down",
	laugh: "laugh",
	hooray: "hooray",
	confused: "confused",
	heart: "heart",
	rocket: "rocket",
	eyes: "eyes",
};

/** One reaction on something: how many chose it, and whether the linked account did. Only reactions someone chose are listed. */
export const GithubReactionGroupSchema = z.object({
	content: GithubReactionContentSchema,
	count: z.number().int().positive(),
	viewerHasReacted: z.boolean(),
});

export type GithubReactionGroup = z.output<typeof GithubReactionGroupSchema>;

export const GithubReactionGroupsSchema = z.array(GithubReactionGroupSchema).max(GITHUB_REACTION_CONTENTS.length);

/** GitHub's numeric id of a comment, as a string (they no longer fit a 32-bit integer). */
export const GithubDatabaseIdSchema = z
	.string()
	.regex(/^[1-9][0-9]{0,19}$/u, "must be a GitHub id")
	.meta({ description: "GitHub's numeric id of the comment", example: "6186769145" });

/**
 * What a reaction is on: the pull request itself, a conversation comment, or a line comment.
 * Open (not `.strict()`): it is part of responses too, which clients must read tolerantly (ADR 022).
 */
export const GithubReactionSubjectSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("pullRequest") }),
	z.object({ type: z.literal("issueComment"), commentId: GithubDatabaseIdSchema }),
	z.object({ type: z.literal("reviewComment"), commentId: GithubDatabaseIdSchema }),
]);

export type GithubReactionSubject = z.output<typeof GithubReactionSubjectSchema>;

/** `PUT …/:number/reactions` — the linked account's reaction on a subject, set on (`reacted`) or off. Setting it twice changes nothing. */
export const SetGithubReactionSchema = z
	.object({
		subject: GithubReactionSubjectSchema,
		content: GithubReactionContentSchema,
		reacted: z.boolean(),
	})
	.strict();

export type SetGithubReactionInput = z.output<typeof SetGithubReactionSchema>;

/** The reaction as it now stands on GitHub (a response: open, ADR 022). */
export const GithubReactionStateSchema = z.object({
	subject: GithubReactionSubjectSchema,
	content: GithubReactionContentSchema,
	reacted: z.boolean(),
});

export type GithubReactionState = z.output<typeof GithubReactionStateSchema>;

/** The reactions after the linked account set one on or off — what the screen shows until GitHub is read again. */
export function withViewerReaction(groups: readonly GithubReactionGroup[], content: GithubReactionContent, reacted: boolean): GithubReactionGroup[] {
	const current = groups.find((group: GithubReactionGroup): boolean => group.content === content);
	if (current?.viewerHasReacted === reacted || (current === undefined && !reacted)) {
		return [...groups];
	}
	const counts = new Map(groups.map((group: GithubReactionGroup): [GithubReactionContent, GithubReactionGroup] => [group.content, group]));
	const count = (current?.count ?? 0) + (reacted ? 1 : -1);
	if (count > 0) {
		counts.set(content, { content, count, viewerHasReacted: reacted });
	} else {
		counts.delete(content);
	}
	return GITHUB_REACTION_CONTENTS.flatMap((each: GithubReactionContent): GithubReactionGroup[] => {
		const group = counts.get(each);
		return group === undefined ? [] : [group];
	});
}
