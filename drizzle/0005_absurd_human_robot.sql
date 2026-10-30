CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`auth_version` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_token_hash_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_expires_at` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `api_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`key_id` text,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`response_status` integer,
	`response_body` text,
	`request_id` text NOT NULL,
	`model` text,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_idempotency_project_key` ON `api_idempotency` (`project_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_api_idempotency_expires_at` ON `api_idempotency` (`expires_at`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`last_four` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_project_id` ON `api_keys` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_created_at` ON `api_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `api_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`default_response_schema` text,
	`requests_per_minute` integer DEFAULT 30 NOT NULL,
	`requests_per_day` integer DEFAULT 200 NOT NULL,
	`tokens_per_day` integer DEFAULT 1000000 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_projects_name_unique` ON `api_projects` (`name`);--> statement-breakpoint
CREATE INDEX `idx_api_projects_status` ON `api_projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_api_projects_created_at` ON `api_projects` (`created_at`);--> statement-breakpoint
CREATE TABLE `api_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`key_id` text NOT NULL,
	`request_id` text NOT NULL,
	`external_id` text,
	`status_code` integer NOT NULL,
	`outcome` text NOT NULL,
	`error_code` text,
	`schema_source` text,
	`model` text,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`question_count` integer,
	`difficulty` text,
	`subject` text,
	`latency_ms` integer,
	`is_replay` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_usage_project_created` ON `api_usage` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_usage_key_created` ON `api_usage` (`key_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_usage_created_at` ON `api_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_usage_request_id` ON `api_usage` (`request_id`);