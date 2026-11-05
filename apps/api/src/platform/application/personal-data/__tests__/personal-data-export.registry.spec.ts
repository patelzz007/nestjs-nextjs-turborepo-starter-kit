import { describe, expect, it } from "vitest";

import { PersonalDataExportRegistry, type PersonalDataExporter } from "../personal-data-export.registry";

function exporter(section: string): PersonalDataExporter {
	return { section, description: section, export: () => Promise.resolve({ records: 0, data: [] }) };
}

describe("PersonalDataExportRegistry", () => {
	it("lists every exporter by section name, so the ZIP and manifest have a stable order", () => {
		const registry = new PersonalDataExportRegistry();
		registry.register(exporter("notifications"));
		registry.register(exporter("account"));
		registry.register(exporter("claims"));
		expect(registry.exporters().map((entry) => entry.section)).toStrictEqual(["account", "claims", "notifications"]);
	});

	it("refuses two exporters for one section, and a name that can't be a file name", () => {
		const registry = new PersonalDataExportRegistry();
		registry.register(exporter("account"));
		expect((): void => {
			registry.register(exporter("account"));
		}).toThrow(/Two exporters claim/u);
		expect((): void => {
			registry.register(exporter("../secrets"));
		}).toThrow();
	});
});
