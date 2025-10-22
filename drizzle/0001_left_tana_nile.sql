CREATE TABLE `audit_logs` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`conversationId` varchar(64),
	`action` varchar(128) NOT NULL,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`responseMode` enum('concise','academic') NOT NULL DEFAULT 'concise',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medical_embeddings` (
	`id` varchar(64) NOT NULL,
	`source` varchar(255) NOT NULL,
	`chapter` varchar(128),
	`section` varchar(255),
	`content` longtext NOT NULL,
	`embedding` json,
	`metadata` json,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `medical_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(64) NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` longtext NOT NULL,
	`citations` json,
	`tokens` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
