"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  CommentsUnavailableError,
  insertComment,
  parseComment,
} from "@/lib/comments";
import { rateLimit } from "@/lib/rate-limit";

export type CommentFormState = {
  error: string | null;
  token: string;
};

export async function createComment(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const parsed = parseComment(formData.get("comment"));
  if (!parsed.ok) return { error: parsed.error, token: "" };

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const limit = rateLimit(`comment:${ip}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return { error: "Too many comments. Try again in a few minutes.", token: "" };
  }

  try {
    await insertComment(parsed.comment);
  } catch (error) {
    console.error(
      "comment insert failed",
      error instanceof CommentsUnavailableError ? error.name : error instanceof Error ? error.name : "unknown",
    );
    return {
      error:
        error instanceof CommentsUnavailableError
          ? "Comments are unavailable until the database is configured."
          : "Could not save that comment. Try again.",
      token: "",
    };
  }

  revalidatePath("/comments");
  return { error: null, token: crypto.randomUUID() };
}
