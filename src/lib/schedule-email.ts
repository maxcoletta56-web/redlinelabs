import "server-only";

import { after } from "next/server";

/**
 * Runs after the response is sent. Email work must never reject into checkout
 * or the admin mark-paid handler, and a missing request scope still sends.
 */
export function scheduleEmail(reference: string, task: () => Promise<void>) {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[mailer] order email failed", {
        reference,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: message
          .replace(/re_[A-Za-z0-9_-]+/gi, "re_[redacted]")
          .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
          .slice(0, 300),
      });
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
