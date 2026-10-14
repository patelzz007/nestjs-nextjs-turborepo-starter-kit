// ============================================
// scripts/repair-local-public-paths.ts — one-off repair of local-driver public links
// ============================================
// `pnpm --filter @workspace/api storage:repair-local-public-paths` (dry run: lists
// what would change) — add `-- --apply` to rewrite. Only rows of the LOCAL
// storage driver are touched (`storage_provider = 'local'`), in one transaction;
// CDN / bucket URLs are never changed. Safe to re-run: a repaired row is skipped.
// See scripts/local-public-paths.ts for why.

import { prisma } from "../prisma/seed/client";
import { planLocalPublicPathRepairs, type PublicPathRepair } from "./local-public-paths";

const apply = process.argv.slice(2).includes("--apply");

function report(table: string, repairs: readonly PublicPathRepair[]): void {
	console.log(`${table}: ${String(repairs.length)} link(s) ${apply ? "rewritten" : "to rewrite"}`);
	for (const repair of repairs) {
		console.log(`  ${repair.id}: ${repair.from} → ${repair.to}`);
	}
}

async function main(): Promise<void> {
	await prisma.$transaction(async (tx) => {
		const fileRows = await tx.storedFile.findMany({ where: { storageProvider: "local", publicPath: { startsWith: "http" } }, select: { id: true, publicPath: true } });
		const variantRows = await tx.fileVariant.findMany({ where: { storageProvider: "local", publicPath: { startsWith: "http" } }, select: { id: true, publicPath: true } });
		const fileRepairs = planLocalPublicPathRepairs(fileRows);
		const variantRepairs = planLocalPublicPathRepairs(variantRows);
		if (apply) {
			for (const repair of fileRepairs) {
				await tx.storedFile.update({ where: { id: repair.id }, data: { publicPath: repair.to } });
			}
			for (const repair of variantRepairs) {
				await tx.fileVariant.update({ where: { id: repair.id }, data: { publicPath: repair.to } });
			}
		}
		report("stored_files", fileRepairs);
		report("file_variants", variantRepairs);
	});
	if (!apply) {
		console.log("Dry run: nothing was changed. Re-run with --apply to rewrite these links.");
	}
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
