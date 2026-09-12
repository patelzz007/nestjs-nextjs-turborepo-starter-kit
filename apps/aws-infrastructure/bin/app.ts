#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { readContextString } from "../lib/cdk-context.util.js";
import { StoragePlatformStack } from "../lib/storage-platform-stack.js";

const app = new cdk.App();

const environmentName = readContextString(app.node, "environment") ?? "development";
const region: string = process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1";
const account: string | undefined = process.env.CDK_DEFAULT_ACCOUNT;

new StoragePlatformStack(app, `StoragePlatform-${environmentName}`, {
	env: account !== undefined ? { account, region } : { region },
	environmentName,
	description: `Private/public S3 buckets, CloudFront, processing queues, and scanners for ${environmentName}`,
});

app.synth();
