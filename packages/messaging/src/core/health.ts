export interface MessagingHealthIndicator {
	isHealthy(): Promise<boolean>;
	getReport(): Promise<Record<string, string>>;
}
