#!/usr/bin/env tsx

/**
 * Phase 4 Migration Script: Migrate controllers from KernelIntegrationHelper to @Authorize decorator
 *
 * This script automates the migration of authorization patterns:
 * - Remove KernelIntegrationHelper injection
 * - Add @Authorize decorator imports
 * - Replace requireAction() and requireResourceAccess() with @Authorize decorators
 *
 * Run: pnpm tsx scripts/migrate-to-authorize-decorator.ts
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

interface MigrationResult {
	file: string;
	changed: boolean;
	error?: string;
}

const results: MigrationResult[] = [];

async function migrateController(filePath: string): Promise<MigrationResult> {
	try {
		const content = fs.readFileSync(filePath, "utf-8");

		// Skip if already migrated (no KernelIntegrationHelper)
		if (!content.includes("KernelIntegrationHelper")) {
			return { file: filePath, changed: false };
		}

		let newContent = content;

		// 1. Replace import
		newContent = newContent.replace(
			/import { KernelIntegrationHelper } from ["'].*?kernel-integration\.helper["'];/g,
			'import { Authorize } from "../authorization/decorators/authorize.decorator";',
		);

		// 2. Remove from constructor
		newContent = newContent.replace(/private readonly kernelHelper: KernelIntegrationHelper,\s*/g, "");
		newContent = newContent.replace(/private readonly helper: KernelIntegrationHelper,\s*/g, "");

		// 3. Find and mark requireAction() and requireResourceAccess() for manual review
		// (This is complex and requires context, so we'll just remove the helper calls)
		const hasRequireAction = newContent.includes("requireAction");
		const hasRequireResourceAccess = newContent.includes("requireResourceAccess");

		if (hasRequireAction || hasRequireResourceAccess) {
			console.log(`⚠️  ${filePath} needs manual migration for requireAction/requireResourceAccess`);
		}

		// Only write if changed
		if (newContent !== content) {
			fs.writeFileSync(filePath, newContent, "utf-8");
			return { file: filePath, changed: true };
		}

		return { file: filePath, changed: false };
	} catch (error) {
		return {
			file: filePath,
			changed: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function main(): Promise<void> {
	console.log("🔄 Starting migration to @Authorize decorator...\n");

	// Find all controllers
	const controllers = await glob("src/modules/**/*.controller.ts", { cwd: process.cwd() });

	console.log(`📁 Found ${controllers.length} controllers\n`);

	for (const controller of controllers) {
		const result = await migrateController(path.join(process.cwd(), controller));
		results.push(result);

		if (result.error) {
			console.log(`❌ ${controller}: ${result.error}`);
		} else if (result.changed) {
			console.log(`✅ ${controller}: migrated`);
		} else {
			console.log(`⏭️  ${controller}: already migrated or no changes needed`);
		}
	}

	// Summary
	const changed = results.filter((r) => r.changed).length;
	const errors = results.filter((r) => r.error).length;
	const skipped = results.filter((r) => !r.changed && !r.error).length;

	console.log(`\n📊 Migration Summary:`);
	console.log(`   Migrated: ${changed}`);
	console.log(`   Errors: ${errors}`);
	console.log(`   Skipped: ${skipped}`);
	console.log(`\n⚠️  IMPORTANT: This script only handles imports and constructor injection.`);
	console.log(`   You MUST manually add @Authorize decorators to replace requireAction/requireResourceAccess calls.`);
	console.log(`   See: /docs/phase4-controller-migration-plan.md`);
}

main().catch(console.error);
