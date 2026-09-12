import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { StoragePlatformStack } from "../lib/storage-platform-stack.js";

describe("StoragePlatformStack", () => {
	it("creates private and public buckets with versioning", () => {
		const app = new App();
		const stack = new StoragePlatformStack(app, "TestStack", { environmentName: "development" });
		const template = Template.fromStack(stack);

		template.resourceCountIs("AWS::S3::Bucket", 2);
		template.hasResourceProperties("AWS::S3::Bucket", {
			VersioningConfiguration: { Status: "Enabled" },
		});
	});

	it("wires processing and scanner queues with DLQs", () => {
		const app = new App();
		const stack = new StoragePlatformStack(app, "TestStackQueues", { environmentName: "staging" });
		const template = Template.fromStack(stack);

		template.resourceCountIs("AWS::SQS::Queue", 4);
		expect(Object.keys(template.findResources("AWS::Lambda::Function")).length).toBeGreaterThanOrEqual(2);
	});
});
