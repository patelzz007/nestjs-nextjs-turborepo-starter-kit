import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

/** Where generated files live. The engine reads and writes only through this, so it is tested without a disk. */
export interface ContentStore {
	/** The file's text, or null when it does not exist. */
	read(file: string): Promise<string | null>;
	write(file: string, content: string | Uint8Array): Promise<void>;
	remove(file: string): Promise<void>;
	/** The files directly inside a folder, as repository paths; empty when the folder does not exist. */
	list(folder: string): Promise<readonly string[]>;
}

/** A path that would leave the repository: a workspace-level problem, so the batch stops. */
export class UnsafePathError extends Error {
	public constructor(file: string) {
		super(`Refused a path outside the repository: ${file}`);
		this.name = "UnsafePathError";
	}
}

/** Node's error for a file or folder that does not exist. */
const MissingFileErrorSchema = z.object({ code: z.literal("ENOENT") });

/** The repository on disk. Every path is resolved and checked, whatever the caller already validated. */
export class FileContentStore implements ContentStore {
	private readonly _root: string;

	public constructor(root: string) {
		this._root = path.resolve(root);
	}

	public async read(file: string): Promise<string | null> {
		try {
			return await readFile(this.resolve(file), "utf8");
		} catch (error) {
			if (MissingFileErrorSchema.safeParse(error).success) {
				return null;
			}
			throw error;
		}
	}

	public async write(file: string, content: string | Uint8Array): Promise<void> {
		const target = this.resolve(file);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, content);
	}

	public async remove(file: string): Promise<void> {
		await rm(this.resolve(file), { force: true });
	}

	public async list(folder: string): Promise<readonly string[]> {
		try {
			const names = await readdir(this.resolve(folder));
			return names.map((name) => `${folder}/${name}`).sort();
		} catch (error) {
			if (MissingFileErrorSchema.safeParse(error).success) {
				return [];
			}
			throw error;
		}
	}

	private resolve(file: string): string {
		const target = path.resolve(this._root, file);
		if (!target.startsWith(`${this._root}${path.sep}`)) {
			throw new UnsafePathError(file);
		}
		return target;
	}
}
