import { neon } from "@neondatabase/serverless";

export const COMMENT_MAX_LENGTH = 500;

/** Matches db/comments.sql. Neon rejects a trailing semicolon on this endpoint. */
const CREATE_COMMENTS = "CREATE TABLE IF NOT EXISTS comments (comment TEXT)";

const INSERT_COMMENT = "INSERT INTO comments (comment) VALUES ($1)";

const LIST_COMMENTS = "SELECT comment FROM comments";

export type StoredComment = {
  id: string;
  comment: string;
};

export type CommentList = {
  comments: StoredComment[];
  configured: boolean;
  error: string | null;
};

export type Sql = {
  query: (query: string, params?: unknown[]) => Promise<unknown>;
};

export class CommentsUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "CommentsUnavailableError";
  }
}

const ready = new WeakMap<Sql, Promise<void>>();
let cached: { url: string; sql: Sql } | null = null;

export function parseComment(
  value: FormDataEntryValue | null,
): { ok: true; comment: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "Write a comment." };
  const comment = value.replaceAll("\0", "").trim();
  if (!comment) return { ok: false, error: "Write a comment." };
  if (comment.length > COMMENT_MAX_LENGTH) {
    return { ok: false, error: "Keep the comment under 500 characters." };
  }
  return { ok: true, comment };
}

export function getSql(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (cached?.url === url) return cached.sql;
  const client = neon(url);
  const sql: Sql = {
    query: (query, params) => client.query(query, params ?? []),
  };
  cached = { url, sql };
  return sql;
}

export async function ensureCommentsTable(sql: Sql) {
  let pending = ready.get(sql);
  if (!pending) {
    pending = sql
      .query(CREATE_COMMENTS)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready.delete(sql);
        throw error;
      });
    ready.set(sql, pending);
  }
  await pending;
}

export async function insertComment(comment: string, sql: Sql | null = getSql()) {
  if (!sql) throw new CommentsUnavailableError();
  await ensureCommentsTable(sql);
  await sql.query(INSERT_COMMENT, [comment]);
}

function readComment(row: unknown, index: number): StoredComment | null {
  if (!row || typeof row !== "object") return null;
  const comment = (row as Record<string, unknown>).comment;
  if (typeof comment !== "string") return null;
  return { id: String(index), comment };
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return [];
}

export async function listComments(sql: Sql | null = getSql()): Promise<CommentList> {
  if (!sql) return { comments: [], configured: false, error: null };
  try {
    await ensureCommentsTable(sql);
    const result = await sql.query(LIST_COMMENTS);
    const comments = rowsOf(result)
      .map(readComment)
      .filter((row): row is StoredComment => row !== null);
    return { comments, configured: true, error: null };
  } catch (error) {
    console.error(
      "list comments failed",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      comments: [],
      configured: true,
      error: "Comments could not be loaded.",
    };
  }
}
