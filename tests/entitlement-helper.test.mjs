import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("47小助手 keeps the existing support tools and adds one Owner-only authorization area", () => {
  for (const marker of ["QQ 会话", "知识库", "待确认", "输入回复", "授权"]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(html, /id="authorization"/);
  assert.match(html, /stable/);
  assert.match(html, /beta/);
  assert.match(html, /developer/);
  assert.match(html, /Admin Allowlist/);
});

test("authorization UI delegates identity and privilege decisions to the 47 server", () => {
  assert.match(html, /https:\/\/mono-phone-chat-xiaoxiong\.jx4728\.chatgpt\.site/);
  assert.match(html, /\/api\/entitlements\/helper-console\/auth\/start/);
  assert.match(html, /\/api\/entitlements\/helper-console\/session/);
  assert.match(html, /\/api\/owner-console\/entitlements/);
  assert.match(html, /\/api\/owner-console\/operators/);
  assert.match(html, /headers\.Authorization="Bearer "\+entitlementSessionToken/);
  assert.doesNotMatch(html, /ENTITLEMENT_QQ_BRIDGE_SECRET|service_role/);
});

test("authorization status refreshes while visible and stops outside the authorization view", () => {
  assert.match(html, /ENTITLEMENT_POLL_INTERVAL_MS=15000/);
  assert.match(html, /if\(id==="authorization"\)loadEntitlementConsole\(\);[\s\S]*else stopEntitlementPolling\(\)/);
  assert.match(html, /await refreshEntitlements\(entitlementSearchQq\.value\.trim\(\),false,true\);[\s\S]*startEntitlementPolling\(\)/);
  assert.match(html, /document\.addEventListener\("visibilitychange"/);
  assert.match(html, /if\(document\.hidden\)\{stopEntitlementPolling\(\);return\}/);
});

test("the inline Helper application script parses", () => {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match, "inline Helper script is present");
  assert.doesNotThrow(() => new Function(match[1]));
});
