"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field } from "@/components/Field";
import { createComment, type CommentFormState } from "./actions";

const initialState: CommentFormState = { error: null, token: "" };

export function CommentForm() {
  const [state, action, pending] = useActionState(createComment, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.token) formRef.current?.reset();
  }, [state.token]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field
        id="comment"
        name="comment"
        label="Comment"
        type="text"
        required
        maxLength={500}
        placeholder="write a comment"
        autoComplete="off"
        disabled={pending}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-[#d4af37]">
          {state.error}
        </p>
      ) : null}
      {state.token ? (
        <p role="status" className="text-sm text-[#cfc8b8]">
          Comment saved.
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving" : "Submit"}
      </button>
    </form>
  );
}
