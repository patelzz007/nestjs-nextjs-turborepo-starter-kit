import { Injectable, Logger } from "@nestjs/common";
import { setInterval, clearInterval } from "timers";

import { LogServiceOptionsSchema, type LogServiceOptions } from "@workspace/shared";

export type LogOptions = LogServiceOptions;

/**
 * Application-level structured logging service.
 *
 * Wraps NestJS's built-in Logger and provides a consistent interface
 * for info, warn, and error log levels with metadata support.
 * Includes memory monitoring and leak detection capabilities.
 */
@Injectable()
export class LogService {
	private readonly logger: Logger = new Logger(LogService.name);
	private memoryMonitorInterval: NodeJS.Timeout | null = null;
	private memoryBaseline: number | null = null;
	private memorySamples: number[] = [];
	private readonly MAX_SAMPLES = 60; // Keep last 60 samples (5 minutes if sampling every 5s)
	private readonly MEMORY_LEAK_THRESHOLD_MB = 50; // Alert if growth > 50MB over baseline
	private readonly SAMPLE_INTERVAL_MS = 5000; // Sample every 5 seconds

	constructor() {
		// Start memory monitoring in production or when explicitly enabled
		if (process.env.NODE_ENV === "production" || process.env.MEMORY_MONITORING === "true") {
			this.startMemoryMonitoring();
		}
	}

	public info(message: string, options?: LogOptions): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.log(formatted, logContext);
	}

	public warn(message: string, options?: LogOptions): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.warn(formatted, logContext);
	}

	public error(message: string, options?: LogOptions & { trace?: string }): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.error(formatted, options?.trace, logContext);
	}

	/**
	 * Start memory monitoring to detect potential memory leaks
	 */
	private startMemoryMonitoring(): void {
		if (this.memoryMonitorInterval !== null) {
			return; // Already started
		}

		this.logger.log("Starting memory monitoring for leak detection");

		// Take initial baseline
		this.takeMemorySample(true);

		// Set up interval sampling
		this.memoryMonitorInterval = setInterval(() => {
			this.takeMemorySample(false);
		}, this.SAMPLE_INTERVAL_MS);
	}

	/**
	 * Stop memory monitoring
	 */
	public stopMemoryMonitoring(): void {
		if (this.memoryMonitorInterval !== null) {
			clearInterval(this.memoryMonitorInterval);
			this.memoryMonitorInterval = null;
			this.logger.log("Memory monitoring stopped");
		}
	}

	/**
	 * Take a memory sample and check for leaks
	 */
	private takeMemorySample(isBaseline: boolean = false): void {
		try {
			const memoryUsage = process.memoryUsage();
			const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

			if (isBaseline) {
				this.memoryBaseline = heapUsedMB;
				this.memorySamples = [heapUsedMB];
				this.logger.log(`Memory baseline established: ${heapUsedMB} MB`, {
					context: "MemoryMonitor",
					metadata: { heapUsedMB, rssMB: Math.round(memoryUsage.rss / 1024 / 1024) },
				});
				return;
			}

			// Add to samples array (maintain fixed size)
			this.memorySamples.push(heapUsedMB);
			if (this.memorySamples.length > this.MAX_SAMPLES) {
				this.memorySamples.shift();
			}

			// Check for memory leak
			if (this.memoryBaseline !== null) {
				const memoryGrowthMB = heapUsedMB - this.memoryBaseline;

				// Log memory stats periodically
				if (this.memorySamples.length % 12 === 0) {
					// Every minute (12 * 5s)
					this.logger.log(`Memory usage update: ${heapUsedMB} MB (baseline: ${this.memoryBaseline} MB, growth: ${memoryGrowthMB} MB)`, {
						context: "MemoryMonitor",
						metadata: {
							heapUsedMB,
							baselineMB: this.memoryBaseline,
							growthMB: memoryGrowthMB,
							samples: this.memorySamples.length,
						},
					});
				}

				// Alert if memory growth exceeds threshold
				if (memoryGrowthMB > this.MEMORY_LEAK_THRESHOLD_MB) {
					this.logger.warn(`Potential memory leak detected: ${memoryGrowthMB} MB growth since baseline`, {
						context: "MemoryMonitor",
						metadata: {
							heapUsedMB,
							baselineMB: this.memoryBaseline,
							growthMB: memoryGrowthMB,
							thresholdMB: this.MEMORY_LEAK_THRESHOLD_MB,
							samples: this.memorySamples.length,
							trend: this.calculateMemoryTrend(),
						},
					});
				}
			}
		} catch (error: unknown) {
			const message: string = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error in memory monitoring: ${message}`, {
				context: "MemoryMonitor",
				metadata: { error: message },
			});
		}
	}

	/**
	 * Calculate memory trend over recent samples
	 */
	private calculateMemoryTrend(): string {
		if (this.memorySamples.length < 10) {
			return "insufficient_data";
		}

		const recentSamples = this.memorySamples.slice(-10);
		const firstHalf = recentSamples.slice(0, 5);
		const secondHalf = recentSamples.slice(5, 10);

		const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
		const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

		const trend = secondAvg - firstAvg;

		if (trend > 5) return "increasing_rapidly";
		if (trend > 2) return "increasing";
		if (trend < -5) return "decreasing_rapidly";
		if (trend < -2) return "decreasing";
		return "stable";
	}

	private formatMessage(message: string, options?: LogOptions): string {
		if (options?.metadata === undefined && options?.userId === undefined) {
			return message;
		}

		const parts: Record<string, string | number | boolean | null> = {};

		if (options.userId !== undefined) {
			parts.userId = options.userId;
		}

		if (options.metadata !== undefined) {
			for (const [key, value] of Object.entries(options.metadata)) {
				parts[key] = value;
			}
		}

		const metadataStr: string = JSON.stringify(parts);
		return `${message} | ${metadataStr}`;
	}
}
