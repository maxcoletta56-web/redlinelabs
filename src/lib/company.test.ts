import assert from "node:assert/strict";
import test from "node:test";
import {
  BRAND_NAME,
  COMPANY_NUMBER,
  INCORPORATION_DATE_ISO,
  INCORPORATION_DATE_LABEL,
  LEGAL_NAME,
  REGISTERED_COMPANY_DETAIL,
  footerCopyright,
} from "./company.ts";

test("legal entity matches the Hong Kong certificate of incorporation", () => {
  assert.equal(LEGAL_NAME, "RedlineLabs Limited");
  assert.equal(COMPANY_NUMBER, "80442501");
  assert.equal(INCORPORATION_DATE_ISO, "2026-05-20");
  assert.equal(INCORPORATION_DATE_LABEL, "20 May 2026");
  assert.equal(BRAND_NAME, "Redline Labs");
});

test("detail copy names the registered private corporation", () => {
  assert.match(REGISTERED_COMPANY_DETAIL, /verified registered private corporation/);
  assert.match(REGISTERED_COMPANY_DETAIL, /80442501/);
  assert.match(REGISTERED_COMPANY_DETAIL, /RedlineLabs Limited/);
});

test("footer copyright uses the legal name and company number", () => {
  assert.equal(
    footerCopyright(2026),
    "© 2026 RedlineLabs Limited (Hong Kong Co. No. 80442501). Trading as Redline Labs.",
  );
});
