/**
 * Carries the superadmin's GitHub account link across a baseline reset (multi-tenancy plan MT-02).
 *
 *   pnpm db:carry-github-link -- export [--out <file>]   (default ~/.starter-kit/github-link.json)
 *   pnpm db:carry-github-link -- import --in <file>
 *
 * The file holds the row exactly as stored (ciphertext, never decrypted) plus the user's email,
 * so the link can be matched after a reseed. The token is never written to the log.
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { GITHUB_LINK_CARRY_OPERATION } from "../../src/contexts/integrations-github/infrastructure/github-link-carry.operation";

/** Private to the user. The carry file holds a credential ciphertext. */
const CARRY_FILE_MODE = 0o600;

/** The directory that holds the default carry file. */
const CARRY_DIRECTORY_MODE = 0o700;

/** The per-user folder (in the home directory) for files the kit's scripts keep outside the repository. */
const CARRY_DIRECTORY_NAME = ".starter-kit";

/** Where `export` writes when no `--out` is given: `~/.starter-kit/github-link.json`. */
export const DEFAULT_CARRY_PATH = resolve(homedir(), CARRY_DIRECTORY_NAME, "github-link.json");

const EXIT_OK = 0;
const EXIT_FAILED = 1;

const GithubAccountLinkStatusSchema = z.enum(["ACTIVE", "REJECTED"]);

const EpochFieldSchema = z.string().regex(/^\d+$/);
const NullableEpochFieldSchema = EpochFieldSchema.nullable();

/** One stored link, with bigint columns as decimal strings so the file round-trips exactly. */
const GithubLinkCarryRowSchema = z
	.object({
		id: z.string().min(1),
		createdAt: EpochFieldSchema,
		createdBy: z.string().nullable(),
		updatedAt: EpochFieldSchema,
		updatedBy: z.string().nullable(),
		isDeleted: z.boolean(),
		deletedAt: NullableEpochFieldSchema,
		deletedBy: z.string().nullable(),
		githubUserId: EpochFieldSchema,
		githubLogin: z.string().min(1),
		tokenCiphertext: z.string().min(1),
		tokenKeyVersion: z.number().int(),
		tokenExpiresAt: NullableEpochFieldSchema,
		status: GithubAccountLinkStatusSchema,
		linkedAt: EpochFieldSchema,
	})
	.strict();

const GithubLinkCarryFileSchema = z
	.object({
		email: z.email(),
		link: GithubLinkCarryRowSchema,
	})
	.strict();

export type GithubLinkCarryRow = z.output<typeof GithubLinkCarryRowSchema>;
export type GithubLinkCarryFile = z.output<typeof GithubLinkCarryFileSchema>;

export interface GithubLinkCarryStore {
	/** The single superadmin who has a link, or null when there is not exactly one. */
	findSoleSuperadminLink(): Promise<{ readonly email: string; readonly link: GithubLinkCarryRow } | null>;
	findUserIdByEmail(email: string): Promise<string | null>;
	upsertLink(userId: string, link: GithubLinkCarryRow): Promise<void>;
}

export type CarryResult =
	| { readonly kind: "exported"; readonly email: string; readonly path: string }
	| { readonly kind: "imported"; readonly email: string }
	| { readonly kind: "missing_user"; readonly email: string }
	| { readonly kind: "no_link" };

export interface CarryIo {
	readonly read: (path: string) => string;
	readonly write: (path: string, contents: string) => void;
}

const FILE_IO: CarryIo = {
	read: (path: string): string => readFileSync(path, "utf8"),
	write: (path: string, contents: string): void => {
		mkdirSync(dirname(path), { recursive: true, mode: CARRY_DIRECTORY_MODE });
		writeFileSync(path, contents, { mode: CARRY_FILE_MODE });
		chmodSync(path, CARRY_FILE_MODE);
	},
};

function epoch(value: bigint): string {
	return value.toString();
}

function epochOrNull(value: bigint | null): string | null {
	return value === null ? null : epoch(value);
}

function parseEpoch(value: string): bigint {
	return BigInt(value);
}

export async function exportGithubLink(store: GithubLinkCarryStore, path: string, io: CarryIo = FILE_IO): Promise<CarryResult> {
	const found = await store.findSoleSuperadminLink();
	if (found === null) {
		return { kind: "no_link" };
	}
	const file: GithubLinkCarryFile = { email: found.email, link: found.link };
	io.write(path, `${JSON.stringify(file, null, "\t")}\n`);
	return { kind: "exported", email: found.email, path };
}

export async function importGithubLink(store: GithubLinkCarryStore, path: string, io: CarryIo = FILE_IO): Promise<CarryResult> {
	const file = GithubLinkCarryFileSchema.parse(JSON.parse(io.read(path)));
	const userId = await store.findUserIdByEmail(file.email);
	if (userId === null) {
		return { kind: "missing_user", email: file.email };
	}
	await store.upsertLink(userId, file.link);
	return { kind: "imported", email: file.email };
}

function describe(result: CarryResult): string {
	if (result.kind === "exported") {
		return `Exported the GitHub link for ${result.email} to ${result.path}.`;
	}
	if (result.kind === "imported") {
		return `Imported the GitHub link for ${result.email}.`;
	}
	if (result.kind === "missing_user") {
		return `No user with email ${result.email}. Nothing was written.`;
	}
	return "No single superadmin GitHub link to export. Nothing was written.";
}

const CarryCommandSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("export"), out: z.string().min(1) }).strict(),
	z.object({ kind: z.literal("import"), file: z.string().min(1) }).strict(),
]);

export function parseCarryArguments(argv: readonly string[]): z.output<typeof CarryCommandSchema> {
	const [first, ...remainder] = argv;
	const tokens = first === "--" ? remainder : argv;
	const [command, ...rest] = tokens;
	if (command === "export") {
		return CarryCommandSchema.parse({ kind: "export", out: readOptionalPath(rest, "--out") ?? DEFAULT_CARRY_PATH });
	}
	if (command === "import") {
		const file = readOptionalPath(rest, "--in");
		if (file === null) {
			throw new Error("import requires --in <file>.");
		}
		return CarryCommandSchema.parse({ kind: "import", file });
	}
	throw new Error("Usage: carry-github-link <export [--out file] | import --in file>");
}

function readOptionalPath(args: readonly string[], flag: string): string | null {
	let value: string | null = null;
	let expectValue = false;
	for (const arg of args) {
		if (expectValue) {
			value = arg;
			expectValue = false;
			continue;
		}
		if (arg === flag) {
			expectValue = true;
		}
	}
	if (expectValue) {
		throw new Error(`${flag} requires a path.`);
	}
	return value;
}

/** Prisma store. Every read and write runs inside `seed.github_link.carry`. */
export function createPrismaCarryStore(prisma: PrismaClient): GithubLinkCarryStore {
	return {
		findSoleSuperadminLink: (): Promise<{ readonly email: string; readonly link: GithubLinkCarryRow } | null> =>
			underCarry(prisma, async (tx): Promise<{ readonly email: string; readonly link: GithubLinkCarryRow } | null> => {
				const users = await tx.user.findMany({
					where: { isSuperAdmin: true, isDeleted: false, githubAccountLink: { isNot: null } },
					select: { email: true, githubAccountLink: true },
				});
				const [only] = users;
				if (only === undefined || users.length !== 1 || only.githubAccountLink === null) {
					return null;
				}
				const link = only.githubAccountLink;
				return {
					email: only.email,
					link: {
						id: link.id,
						createdAt: epoch(link.createdAt),
						createdBy: link.createdBy,
						updatedAt: epoch(link.updatedAt),
						updatedBy: link.updatedBy,
						isDeleted: link.isDeleted,
						deletedAt: epochOrNull(link.deletedAt),
						deletedBy: link.deletedBy,
						githubUserId: epoch(link.githubUserId),
						githubLogin: link.githubLogin,
						tokenCiphertext: link.tokenCiphertext,
						tokenKeyVersion: link.tokenKeyVersion,
						tokenExpiresAt: epochOrNull(link.tokenExpiresAt),
						status: link.status,
						linkedAt: epoch(link.linkedAt),
					},
				};
			}),
		findUserIdByEmail: (email: string): Promise<string | null> =>
			underCarry(prisma, async (tx): Promise<string | null> => {
				const user = await tx.user.findFirst({ where: { email, isDeleted: false }, select: { id: true } });
				return user === null ? null : user.id;
			}),
		upsertLink: (userId: string, link: GithubLinkCarryRow): Promise<void> =>
			underCarry(prisma, async (tx): Promise<void> => {
				const data = {
					githubUserId: parseEpoch(link.githubUserId),
					githubLogin: link.githubLogin,
					tokenCiphertext: link.tokenCiphertext,
					tokenKeyVersion: link.tokenKeyVersion,
					tokenExpiresAt: link.tokenExpiresAt === null ? null : parseEpoch(link.tokenExpiresAt),
					status: link.status,
					linkedAt: parseEpoch(link.linkedAt),
					createdAt: parseEpoch(link.createdAt),
					createdBy: link.createdBy,
					updatedAt: parseEpoch(link.updatedAt),
					updatedBy: link.updatedBy,
					isDeleted: link.isDeleted,
					deletedAt: link.deletedAt === null ? null : parseEpoch(link.deletedAt),
					deletedBy: link.deletedBy,
				};
				await tx.githubAccountLink.upsert({
					where: { userId },
					create: { id: link.id, userId, ...data },
					update: data,
				});
			}),
	};
}

async function underCarry<T>(prisma: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<T> => {
		await tx.$executeRaw`SELECT
			set_config('role', 'app_runtime', true),
			set_config('app.rls_bypass', 'true', true),
			set_config('app.system_operation', ${GITHUB_LINK_CARRY_OPERATION}, true)`;
		return run(tx);
	});
}

function openPrisma(): PrismaClient {
	return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

async function main(): Promise<number> {
	let command: z.output<typeof CarryCommandSchema>;
	try {
		command = parseCarryArguments(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : "Invalid arguments."}\n`);
		return EXIT_FAILED;
	}
	const prisma = openPrisma();
	try {
		const store = createPrismaCarryStore(prisma);
		const result = command.kind === "export" ? await exportGithubLink(store, command.out) : await importGithubLink(store, command.file);
		const line = describe(result);
		if (result.kind === "exported" || result.kind === "imported") {
			process.stdout.write(`${line}\n`);
			return EXIT_OK;
		}
		process.stderr.write(`${line}\n`);
		return EXIT_FAILED;
	} finally {
		await prisma.$disconnect();
	}
}

if (process.env.VITEST !== "true") {
	void main().then((code: number): void => {
		process.exitCode = code;
	});
}
