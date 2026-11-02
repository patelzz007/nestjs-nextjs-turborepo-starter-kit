import { isAbsolute, resolve } from "node:path";

/**
 * Which env file the API's tooling loads (Prisma's config, the RLS apply, the e2e setup), decided before
 * any configuration exists, so it lives here and not in src/config (whose env boundary is api-config.ts).
 *
 * The API's env file: `DOTENV_PATH` when it is set, otherwise `<apiRoot>/.env`. `dotenv run` and
 * `dotenv/config` honour `DOTENV_PATH` themselves; every loader that names the file honours it too, so
 * `pnpm ci:local` can point the whole API at CI's generated env and never read the developer's file.
 * A relative `DOTENV_PATH` resolves against the working directory, as dotenv does.
 */
export function apiEnvFilePath(apiRoot: string, configured: string | undefined = process.env.DOTENV_PATH): string {
	const path = configured?.trim() ?? "";
	if (path.length === 0) {
		return resolve(apiRoot, ".env");
	}
	return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
