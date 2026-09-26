import { connection } from "next/server";
import { CommentForm } from "./comment-form";
import { PageIntro } from "@/components/PageIntro";
import { formatCommentTime, listComments } from "@/lib/comments";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Comments",
  description:
    "Leave a public comment on Redline Labs. Comments are stored as written and are not product advice.",
  path: "/comments",
});

export default async function CommentsPage() {
  await connection();
  const result = await listComments();

  return (
    <div className="wrap max-w-[760px] py-16">
      <PageIntro kicker="Comments" title="Leave a comment">
        Notes are public and saved to the database as written. They are not
        product advice.
      </PageIntro>
      <CommentForm />
      {result.configured ? null : (
        <p className="mt-4 text-sm leading-6 text-[#8f8c84]">
          The database is not configured in this environment.
        </p>
      )}
      {result.error ? (
        <p role="alert" className="mt-4 text-sm text-[#d4af37]">
          {result.error}
        </p>
      ) : null}
      {result.configured && result.comments.length === 0 && !result.error ? (
        <p className="mt-10 text-sm text-[#8f8c84]">No comments yet.</p>
      ) : null}
      {result.comments.length > 0 ? (
        <ul className="mt-10 space-y-3">
          {result.comments.map((item) => (
            <li key={item.id} className="surface p-5">
              <p className="text-[15px] leading-7 break-words text-[#f3f1ea]">{item.comment}</p>
              {item.createdAt ? (
                <p className="mt-2 text-[12px] tracking-[0.04em] text-[#8f8c84]">
                  <time dateTime={item.createdAt}>{formatCommentTime(item.createdAt)}</time>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
