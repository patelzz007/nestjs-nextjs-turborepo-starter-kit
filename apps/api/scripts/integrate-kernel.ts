#!/usr/bin/env tsx
/**
 * Helper script to assist with integrating Authorization Kernel into controllers and services.
 *
 * This script identifies files that need kernel integration and provides guidance.
 * It does NOT automatically modify files to prevent breaking existing logic.
 *
 * Usage:
 *   pnpm tsx scripts/integrate-kernel.ts [--dry-run]
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface FileAnalysis {
	path: string;
	needsIntegration: boolean;
	hasKernelHelper: boolean;
	hasAuthChecks: boolean;
	hasCRUD: boolean;
	priority: "high" | "medium" | "low";
	recommendation: string;
}

function analyzeFile(filePath: string): FileAnalysis {
	const content = fs.readFileSync(filePath, "utf8");
	const hasKernelHelper = content.includes("KernelIntegrationHelper");
	const hasAuthChecks = content.includes("@RequirePermission") || content.includes("@RequireAllPermissions");
	const hasCRUD = content.match(/@Post|@Patch|@Delete|@Put/) !== null;
	const hasGetAll = content.includes("@Get()");

	let needsIntegration = false;
	let priority: "high" | "medium" | "low" = "low";
	let recommendation = "";

	if (hasKernelHelper) {
		needsIntegration = false;
		recommendation = "✅ Already integrated with Authorization Kernel";
	} else if (hasCRUD) {
		needsIntegration = true;
		priority = "high";
		recommendation = "🔴 HIGH: Has CREATE/UPDATE/DELETE operations - add kernel authorization checks";
	} else if (hasGetAll) {
		needsIntegration = true;
		priority = "medium";
		recommendation = "🟡 MEDIUM: Has list/query operations - add kernel filtering";
	} else if (hasAuthChecks) {
		needsIntegration = true;
		priority = "medium";
		recommendation = "🟡 MEDIUM: Has existing auth checks - migrate to kernel";
	} else {
		recommendation = "⚪ LOW: Minimal authorization concerns";
	}

	return {
		path: filePath,
		needsIntegration,
		hasKernelHelper,
		hasAuthChecks,
		hasCRUD,
		priority,
		recommendation,
	};
}

function findFiles(dir: string, pattern: RegExp): string[] {
	const results: string[] = [];

	function walk(currentDir: string) {
		if (!fs.existsSync(currentDir)) {
			return;
		}

		const files = fs.readdirSync(currentDir);

		for (const file of files) {
			const filePath = path.join(currentDir, file);
			const stat = fs.statSync(filePath);

			if (stat.isDirectory()) {
				if (!file.includes("node_modules") && !file.includes(".git")) {
					walk(filePath);
				}
			} else if (pattern.test(file)) {
				results.push(filePath);
			}
		}
	}

	walk(dir);
	return results;
}

function main() {
	const srcDir = path.join(process.cwd(), "src", "modules");

	console.log("🔍 Analyzing controllers and services for Authorization Kernel integration...\n");

	const controllers = findFiles(srcDir, /\.controller\.ts$/);
	const services = findFiles(srcDir, /\.service\.ts$/).filter((f) => !f.includes(".spec.ts"));

	const allFiles = [...controllers, ...services];
	const analyses = allFiles.map(analyzeFile);

	const needsIntegration = analyses.filter((a) => a.needsIntegration);
	const highPriority = needsIntegration.filter((a) => a.priority === "high");
	const mediumPriority = needsIntegration.filter((a) => a.priority === "medium");

	console.log("📊 Summary:");
	console.log(`   Total files analyzed: ${allFiles.length}`);
	console.log(`   Already integrated: ${analyses.length - needsIntegration.length}`);
	console.log(`   Needs integration: ${needsIntegration.length}`);
	console.log(`     - High priority: ${highPriority.length}`);
	console.log(`     - Medium priority: ${mediumPriority.length}`);
	console.log(`     - Low priority: ${needsIntegration.length - highPriority.length - mediumPriority.length}\n`);

	if (highPriority.length > 0) {
		console.log("🔴 HIGH PRIORITY (CRUD operations):");
		for (const file of highPriority) {
			console.log(`   ${file.path.replace(process.cwd(), ".")}`);
			console.log(`      ${file.recommendation}`);
		}
		console.log("");
	}

	if (mediumPriority.length > 0) {
		console.log("🟡 MEDIUM PRIORITY (queries or existing auth):");
		for (const file of mediumPriority.slice(0, 10)) {
			console.log(`   ${file.path.replace(process.cwd(), ".")}`);
			console.log(`      ${file.recommendation}`);
		}
		if (mediumPriority.length > 10) {
			console.log(`   ... and ${mediumPriority.length - 10} more`);
		}
		console.log("");
	}

	console.log("📖 Integration Guide:");
	console.log("   Full guide: /docs/authorization-kernel-integration-guide.md");
	console.log("   Working examples:");
	console.log("     - apps/api/src/modules/organization/controllers/organization.controller.ts");
	console.log("     - apps/api/src/modules/sample-category/sample-category.controller.ts");
	console.log("     - apps/api/src/modules/authorization/kernel/examples.controller.ts");
	console.log("");

	console.log("🛠️  Integration Steps:");
	console.log("   1. Inject KernelIntegrationHelper in controller/service constructor");
	console.log("   2. Add requireAction() before CREATE operations");
	console.log("   3. Add requireResourceAccess() before UPDATE/DELETE operations");
	console.log("   4. Add getQueryFilter() for LIST/QUERY operations");
	console.log("   5. Test authorization scenarios (ALLOW and DENY paths)");
	console.log("");

	console.log("⚠️  Important:");
	console.log("   - This script identifies files but does NOT auto-modify them");
	console.log("   - Manual integration ensures business logic is preserved");
	console.log("   - Follow the integration guide for each file type");
	console.log("   - Test thoroughly after each integration");
}

main();
