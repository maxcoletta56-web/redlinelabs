import assert from "node:assert/strict";
import test from "node:test";
import { readNextAction } from "./whop-next-action.ts";

test("presents a 3D Secure redirect inline when the action allows it", () => {
  const action = readNextAction({
    type: "redirect",
    render: ["inline"],
    data: { url: "https://psp.example/3ds/challenge", frame_max_width: 500 },
  });
  assert.deepEqual(action, {
    kind: "redirect",
    url: "https://psp.example/3ds/challenge",
    mode: "inline",
    frameMaxWidth: 500,
  });
});

test("rejects non-https redirect targets", () => {
  assert.equal(
    readNextAction({
      type: "redirect",
      render: ["full_page"],
      data: { url: "javascript:alert(1)", frame_max_width: null },
    }),
    null,
  );
});

test("reads bank transfer instructions and an await step", () => {
  const instructions = readNextAction({
    type: "display_instructions",
    render: ["full_page"],
    data: {
      kind: "bank_transfer",
      bank_transfer: {
        account_number: "4411 0902 33",
        account_number_label: "Account number",
        reference: "SHINE-8237",
        document_url: "https://psp.example/instructions",
      },
    },
  });
  assert.equal(instructions?.kind, "instructions");
  if (instructions?.kind !== "instructions") return;
  assert.equal(instructions.documentUrl, "https://psp.example/instructions");
  assert.deepEqual(instructions.rows[0], { label: "Account number", value: "4411 0902 33" });

  assert.deepEqual(
    readNextAction({
      type: "await_confirmation",
      render: [],
      data: { expires_at: "2026-01-01T12:00:00.000Z" },
    }),
    { kind: "await_confirmation", expiresAt: "2026-01-01T12:00:00.000Z" },
  );
});
