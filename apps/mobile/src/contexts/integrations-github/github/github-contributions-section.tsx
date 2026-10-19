// ============================================
// GitHub contributions — the Profile screen's section (smart)
// ============================================
// Reads the repositories the API may read (GET /github/repositories: pinned by
// config, or the token account's own and contributed-to repositories) and
// shows one at a time: its summary, its top contributors and its commit
// history with the lines each commit added and deleted. Tapping a commit opens
// its own screen with every changed file's diff (github-commit-detail.tsx); a
// contributor opens their GitHub profile. The section is not
// shown at all when the integration is off (no repositories) or the account
// may not read it (403) — there is nothing for the person to act on.
// docs/technical/github-contributions.md

import { ApiError } from "@workspace/api-client";
import type { GithubCommit, GithubContributor, GithubContributorStats, GithubRepositoryListItem, GithubRepositoryRef } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";
import { Linking, View } from "react-native";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { ChangeRow } from "../../../components/change-row";
import { LanguageBreakdown } from "../../../components/language-breakdown";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { StatTiles } from "@workspace/ui-native/components/stat-tiles";
import { EmptyState, ErrorState } from "@workspace/ui-native/components/empty";
import { BodyText, Label, MutedText } from "@workspace/ui-native/components/text";
import { useApi } from "../../../lib/api-context";
import { errorMessageOf } from "../../../lib/error-messages";
import { useNow } from "../../../lib/use-now";
import { ROUTES } from "../../../runtime/routes";
import {
	changeSummary,
	commitMeta,
	contributorBasisNote,
	contributorMeta,
	formatCount,
	languageShares,
	lastPushLabel,
	OPEN_GITHUB_FAILED_MESSAGE,
	repositoryDescription,
	repositoryListDescription,
	summaryTiles,
} from "./labels";

export const GITHUB_SECTION_TITLE = "GitHub contributions";

/** Commits per page — small enough to read on a phone, "Show older commits" loads the next. */
export const GITHUB_COMMIT_PAGE_SIZE = 10;

/** Contributors listed before "Show all contributors". */
export const GITHUB_CONTRIBUTORS_PREVIEW = 5;

/** Above this many repositories the dropdown gets a search box (a discovered list can be long). */
export const GITHUB_REPOSITORY_SEARCH_MIN = 8;

/** Relative times ("2 hours ago") are re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

const HTTP_FORBIDDEN = 403;

/** The account may not read GitHub contributions (no READ:GITHUB) — the section stays hidden. */
function isForbidden(error: Error): boolean {
	return error instanceof ApiError && error.statusCode === HTTP_FORBIDDEN;
}

export function GithubContributionsSection(): React.JSX.Element | null {
	const api = useApi();
	const repositories = api.github.repositories.useQuery(undefined);
	const [selectedFullName, setSelectedFullName] = React.useState<string | null>(null);
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const retry = React.useCallback((): void => {
		void repositories.refetch();
	}, [repositories]);

	if (repositories.isPending) {
		return <GithubSectionSkeleton />;
	}
	if (repositories.isError) {
		return isForbidden(repositories.error) ? null : (
			<Card title={GITHUB_SECTION_TITLE}>
				<ErrorState message={errorMessageOf(repositories.error)} retryLabel="Try again" onRetry={retry} />
			</Card>
		);
	}
	const listing = repositories.data.data;
	const [first] = listing.repositories;
	const current = listing.repositories.find((repository: GithubRepositoryListItem): boolean => repository.fullName === selectedFullName) ?? first;
	if (current === undefined) {
		return null;
	}
	const description = repositoryListDescription(listing);
	return (
		<Card title={GITHUB_SECTION_TITLE} {...(description === null ? {} : { description })} testID="github-contributions">
			{listing.repositories.length > 1 ? <RepositoryPicker repositories={listing.repositories} selected={current} nowMs={nowMs} onSelect={setSelectedFullName} /> : null}
			{/* Keyed by repository: switching starts the history from its newest page. */}
			<RepositoryContributions key={current.fullName} repository={current} nowMs={nowMs} />
		</Card>
	);
}

interface RepositoryPickerProps {
	readonly repositories: readonly GithubRepositoryListItem[];
	readonly selected: GithubRepositoryListItem;
	readonly nowMs: number;
	readonly onSelect: (fullName: string) => void;
}

/** A dropdown of the repositories; a long (discovered) list can be searched by name. */
function RepositoryPicker({ repositories, selected, nowMs, onSelect }: RepositoryPickerProps): React.JSX.Element {
	const options = React.useMemo(
		() =>
			repositories.map((repository: GithubRepositoryListItem): SelectOption<string> => ({
				value: repository.fullName,
				label: repository.fullName,
				...optionalDescription(repositoryDescription(repository, nowMs)),
			})),
		[repositories, nowMs],
	);
	return (
		<SelectField
			label="Repository"
			options={options}
			value={selected.fullName}
			onChange={onSelect}
			searchable={repositories.length > GITHUB_REPOSITORY_SEARCH_MIN}
			searchPlaceholder="Search repositories"
			noMatchesMessage="No repository matches your search."
			testID="github-repository-select"
		/>
	);
}

/** An option's description only when there is one (`exactOptionalPropertyTypes`). */
function optionalDescription(description: string | null): { readonly description?: string } {
	return description === null ? {} : { description };
}

interface RepositoryProps {
	readonly repository: GithubRepositoryRef;
}

interface RepositoryContributionsProps extends RepositoryProps {
	readonly nowMs: number;
}

function RepositoryContributions({ repository, nowMs }: RepositoryContributionsProps): React.JSX.Element {
	const router = useRouter();
	const [openFailed, setOpenFailed] = React.useState(false);
	const openOnGithub = React.useCallback((url: string): void => {
		setOpenFailed(false);
		Linking.openURL(url).catch((): void => {
			setOpenFailed(true);
		});
	}, []);
	const openCommit = React.useCallback(
		(sha: string): void => {
			router.push({ pathname: ROUTES.githubCommit, params: { owner: repository.owner, repository: repository.repository, sha } });
		},
		[repository.owner, repository.repository, router],
	);
	return (
		<View className="gap-5">
			<RepositorySummary repository={repository} nowMs={nowMs} />
			{openFailed ? <Alert tone="error" message={OPEN_GITHUB_FAILED_MESSAGE} /> : null}
			<TopContributors repository={repository} onOpen={openOnGithub} />
			<CommitHistory repository={repository} nowMs={nowMs} onOpenCommit={openCommit} />
		</View>
	);
}

interface RepositorySummaryProps extends RepositoryProps {
	readonly nowMs: number;
}

function RepositorySummary({ repository, nowMs }: RepositorySummaryProps): React.JSX.Element {
	const api = useApi();
	const summary = api.github.repositorySummary.useQuery({ owner: repository.owner, repository: repository.repository });
	const retry = React.useCallback((): void => {
		void summary.refetch();
	}, [summary]);

	if (summary.isPending) {
		return (
			<SkeletonGroup className="gap-2">
				<SkeletonText size="sm" widthClassName="w-56" />
				<Skeleton className="h-16 w-full rounded-lg" />
			</SkeletonGroup>
		);
	}
	if (summary.isError) {
		return <ErrorState message={errorMessageOf(summary.error)} retryLabel="Try again" onRetry={retry} />;
	}
	const data = summary.data.data;
	const pushed = lastPushLabel(data, nowMs);
	return (
		<View className="gap-3">
			{data.description === null ? null : <BodyText>{data.description}</BodyText>}
			<StatTiles items={summaryTiles(data)} testID="github-summary-tiles" />
			{data.languages.length === 0 ? null : (
				<View className="gap-2">
					<Label>Languages</Label>
					<LanguageBreakdown title="Languages" languages={languageShares(data.languages)} testID="github-languages" />
				</View>
			)}
			{pushed === null ? null : <MutedText>{pushed}</MutedText>}
		</View>
	);
}

interface OpenableProps extends RepositoryProps {
	/** Opens a GitHub page (a commit, a profile) outside the app. */
	readonly onOpen: (url: string) => void;
}

function TopContributors({ repository, onOpen }: OpenableProps): React.JSX.Element {
	const api = useApi();
	const stats = api.github.repositoryContributors.useQuery({ owner: repository.owner, repository: repository.repository });
	const [showAll, setShowAll] = React.useState(false);
	const retry = React.useCallback((): void => {
		void stats.refetch();
	}, [stats]);
	const toggleShowAll = React.useCallback((): void => {
		setShowAll((current: boolean): boolean => !current);
	}, []);

	return (
		<View className="gap-1">
			<Label>Top contributors</Label>
			{stats.isPending ? (
				<SkeletonGroup className="gap-2">
					<Skeleton className="h-12 w-full rounded-lg" />
				</SkeletonGroup>
			) : null}
			{stats.isError ? <ErrorState message={errorMessageOf(stats.error)} retryLabel="Try again" onRetry={retry} /> : null}
			{stats.data === undefined ? null : <ContributorTotals stats={stats.data.data} showAll={showAll} onToggleShowAll={toggleShowAll} onOpen={onOpen} />}
		</View>
	);
}

interface ContributorTotalsProps extends Omit<ContributorListProps, "contributors"> {
	readonly stats: GithubContributorStats;
}

/** The contributors, and — when the API could only count the latest commits — a note saying so. */
function ContributorTotals({ stats, showAll, onToggleShowAll, onOpen }: ContributorTotalsProps): React.JSX.Element {
	const note = contributorBasisNote(stats.basis);
	return (
		<>
			{note === null ? null : <MutedText>{note}</MutedText>}
			<ContributorList contributors={stats.contributors} showAll={showAll} onToggleShowAll={onToggleShowAll} onOpen={onOpen} />
		</>
	);
}

interface ContributorListProps {
	readonly contributors: readonly GithubContributor[];
	readonly showAll: boolean;
	readonly onToggleShowAll: () => void;
	readonly onOpen: (url: string) => void;
}

function ContributorList({ contributors, showAll, onToggleShowAll, onOpen }: ContributorListProps): React.JSX.Element {
	if (contributors.length === 0) {
		return <EmptyState message="No contributions yet." />;
	}
	const shown = showAll ? contributors : contributors.slice(0, GITHUB_CONTRIBUTORS_PREVIEW);
	return (
		<View>
			{shown.map((contributor: GithubContributor): React.JSX.Element => (
				<ContributorRow key={contributor.login} contributor={contributor} onOpen={onOpen} />
			))}
			{contributors.length > GITHUB_CONTRIBUTORS_PREVIEW ? (
				<View className="self-start pt-2">
					<Button label={showAll ? "Show fewer contributors" : `Show all ${formatCount(contributors.length)} contributors`} variant="ghost" onPress={onToggleShowAll} />
				</View>
			) : null}
		</View>
	);
}

interface ContributorRowProps {
	readonly contributor: GithubContributor;
	readonly onOpen: (url: string) => void;
}

function ContributorRow({ contributor, onOpen }: ContributorRowProps): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(contributor.htmlUrl);
	}, [contributor.htmlUrl, onOpen]);
	return (
		<ChangeRow
			leading={<Avatar name={contributor.login} imageUrl={contributor.avatarUrl} size="md" />}
			title={contributor.login}
			meta={contributorMeta(contributor)}
			additions={formatCount(contributor.additions)}
			deletions={formatCount(contributor.deletions)}
			changeSummary={changeSummary(contributor.additions, contributor.deletions)}
			accessibilityHint="Opens their GitHub profile"
			onPress={open}
		/>
	);
}

interface CommitHistoryProps extends RepositoryProps {
	readonly nowMs: number;
	/** Shows one commit, by SHA, on its own screen. */
	readonly onOpenCommit: (sha: string) => void;
}

/**
 * The newest page, then one page per "Show older commits". Each page is its
 * own query (keyed by its cursor); only the cursors of the pages the person
 * asked for are local state.
 */
function CommitHistory({ repository, nowMs, onOpenCommit }: CommitHistoryProps): React.JSX.Element {
	const [olderCursors, setOlderCursors] = React.useState<readonly string[]>([]);
	const loadOlder = React.useCallback((cursor: string): void => {
		setOlderCursors((current: readonly string[]): readonly string[] => (current.includes(cursor) ? current : [...current, cursor]));
	}, []);
	const lastCursor = olderCursors.at(-1);
	return (
		<View className="gap-1">
			<Label>Recent commits</Label>
			<CommitHistoryPage repository={repository} cursor={undefined} isLast={lastCursor === undefined} nowMs={nowMs} onOpenCommit={onOpenCommit} onLoadOlder={loadOlder} />
			{olderCursors.map((cursor: string): React.JSX.Element => (
				<CommitHistoryPage
					key={cursor}
					repository={repository}
					cursor={cursor}
					isLast={cursor === lastCursor}
					nowMs={nowMs}
					onOpenCommit={onOpenCommit}
					onLoadOlder={loadOlder}
				/>
			))}
		</View>
	);
}

interface CommitHistoryPageProps extends CommitHistoryProps {
	/** `undefined` for the newest page. */
	readonly cursor: string | undefined;
	/** Only the last page offers "Show older commits". */
	readonly isLast: boolean;
	readonly onLoadOlder: (cursor: string) => void;
}

function CommitHistoryPage({ repository, cursor, isLast, nowMs, onOpenCommit, onLoadOlder }: CommitHistoryPageProps): React.JSX.Element {
	const api = useApi();
	const page = api.github.repositoryCommits.useQuery({
		owner: repository.owner,
		repository: repository.repository,
		limit: GITHUB_COMMIT_PAGE_SIZE,
		...(cursor === undefined ? {} : { cursor }),
	});
	const retry = React.useCallback((): void => {
		void page.refetch();
	}, [page]);

	if (page.isPending) {
		return (
			<SkeletonGroup className="gap-2" accessibilityLabel="Loading commits">
				<Skeleton className="h-12 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
			</SkeletonGroup>
		);
	}
	if (page.isError) {
		return <ErrorState message={errorMessageOf(page.error)} retryLabel="Try again" onRetry={retry} />;
	}
	const { items, nextCursor } = page.data.data;
	if (items.length === 0 && cursor === undefined) {
		return <EmptyState message="No commits yet." />;
	}
	return (
		<View>
			{items.map((commit: GithubCommit): React.JSX.Element => (
				<CommitRow key={commit.sha} commit={commit} nowMs={nowMs} onOpenCommit={onOpenCommit} />
			))}
			{isLast && nextCursor !== null ? <LoadOlderButton cursor={nextCursor} onLoadOlder={onLoadOlder} /> : null}
		</View>
	);
}

interface CommitRowProps {
	readonly commit: GithubCommit;
	readonly nowMs: number;
	readonly onOpenCommit: (sha: string) => void;
}

function CommitRow({ commit, nowMs, onOpenCommit }: CommitRowProps): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpenCommit(commit.sha);
	}, [commit.sha, onOpenCommit]);
	return (
		<ChangeRow
			title={commit.headline}
			meta={commitMeta(commit, nowMs)}
			additions={formatCount(commit.additions)}
			deletions={formatCount(commit.deletions)}
			changeSummary={changeSummary(commit.additions, commit.deletions)}
			accessibilityHint="Shows the files this commit changed"
			onPress={open}
		/>
	);
}

interface LoadOlderButtonProps {
	readonly cursor: string;
	readonly onLoadOlder: (cursor: string) => void;
}

function LoadOlderButton({ cursor, onLoadOlder }: LoadOlderButtonProps): React.JSX.Element {
	const loadOlder = React.useCallback((): void => {
		onLoadOlder(cursor);
	}, [cursor, onLoadOlder]);
	return (
		<View className="self-start pt-2">
			<Button label="Show older commits" variant="ghost" onPress={loadOlder} />
		</View>
	);
}

/** The section's shape while the repository list loads. */
function GithubSectionSkeleton(): React.JSX.Element {
	return (
		<Card title={GITHUB_SECTION_TITLE}>
			<SkeletonGroup accessibilityLabel="Loading GitHub contributions" testID="github-contributions-skeleton" className="gap-2">
				<SkeletonText size="sm" widthClassName="w-56" />
				<Skeleton className="h-16 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
			</SkeletonGroup>
		</Card>
	);
}
