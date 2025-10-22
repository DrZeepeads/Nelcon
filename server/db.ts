import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversations, messages, medicalEmbeddings, auditLogs, Conversation, Message, MedicalEmbedding, AuditLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Conversation queries
 */
export async function createConversation(
  userId: string,
  title: string,
  responseMode: "concise" | "academic" = "concise"
): Promise<Conversation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const result = await db.insert(conversations).values({
    id: conversationId,
    userId,
    title,
    responseMode,
  });

  const conversation = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return conversation[0];
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversation(conversationId: string): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return result[0];
}

export async function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(messages).where(eq(messages.conversationId, conversationId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

/**
 * Message queries
 */
export async function createMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations?: Array<{ source: string; chapter?: string; section?: string }>,
  tokens?: number
): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role,
    content,
    citations,
    tokens,
  });

  const message = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  return message[0];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

/**
 * Medical embeddings queries
 */
export async function createMedicalEmbedding(
  source: string,
  content: string,
  embedding: number[],
  chapter?: string,
  section?: string,
  metadata?: Record<string, unknown>
): Promise<MedicalEmbedding> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const embeddingId = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(medicalEmbeddings).values({
    id: embeddingId,
    source,
    chapter,
    section,
    content,
    embedding,
    metadata,
  });

  const result = await db
    .select()
    .from(medicalEmbeddings)
    .where(eq(medicalEmbeddings.id, embeddingId))
    .limit(1);

  return result[0];
}

/**
 * Audit log queries
 */
export async function createAuditLog(
  userId: string,
  action: string,
  conversationId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<AuditLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(auditLogs).values({
    id: logId,
    userId,
    conversationId,
    action,
    details,
    ipAddress,
    userAgent,
  });

  const result = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, logId))
    .limit(1);

  return result[0];
}
