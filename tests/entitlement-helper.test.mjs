import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

function extractFunction(signature) {
  const start = html.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is present`);
  const bodyStart = html.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${signature}`);
}

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
  assert.match(html, /\/api\/owner-console\/devices/);
  assert.match(html, /headers\.Authorization="Bearer "\+entitlementSessionToken/);
  assert.doesNotMatch(html, /ENTITLEMENT_QQ_BRIDGE_SECRET|service_role/);
});

test("Owner can inspect and revoke Account devices without exposing that capability to Admin", () => {
  assert.match(html, /data-ent-action="devices"/);
  assert.match(html, /id="entitlementDevicePanel"/);
  assert.match(html, /openEntitlementDevices/);
  assert.match(html, /revokeEntitlementDevice/);
  assert.match(html, /method:"DELETE",body:JSON\.stringify\(\{accountId:entitlementDeviceContext\.accountId,deviceId\}\)/);
  assert.match(html, /result\.overLimit/);
  assert.match(html, /超过当前上限/);
});

test("activated accounts expose an Owner-only copy action for the existing login entry", () => {
  assert.match(html, /state==="activated"\?'<button data-ent-action="copy-login-link">复制登录入口<\/button><button data-ent-action="devices">设备<\/button>'/);
  assert.match(html, /async function copyActivatedAccountLoginLink\(row\)/);
  assert.match(html, /action:"copy-login-link",entitlementId:row\.entitlementId/);
  assert.match(html, /if\(!result\.loginLink\)throw new Error\("已有账号登录入口没有正确返回"\)/);
  assert.match(html, /await copyEntitlementText\(result\.loginLink\)/);
  assert.match(html, /action==="copy-login-link"\)copyActivatedAccountLoginLink\(row\)/);
  assert.doesNotMatch(html, /action:"regenerate-login-link"|action:"issue-login-link"/);
});

test("expired Activation Links stay visible as expired and can only be regenerated", () => {
  assert.match(html, /row\.activationState==="expired"\?"expired"/);
  assert.match(html, /state==="expired"\?"已过期"/);
  assert.match(html, /state==="pending"\|\|state==="expired"\?'<button data-ent-action="regenerate">重新生成<\/button>'/);
});

test("authorization status refreshes while visible and stops outside the authorization view", () => {
  assert.match(html, /ENTITLEMENT_POLL_INTERVAL_MS=15000/);
  assert.match(html, /if\(id==="authorization"\)loadEntitlementConsole\(\);[\s\S]*else stopEntitlementPolling\(\)/);
  assert.match(html, /await refreshEntitlements\(entitlementSearchQq\.value\.trim\(\),false,true\);[\s\S]*startEntitlementPolling\(\)/);
  assert.match(html, /document\.addEventListener\("visibilitychange"/);
  assert.match(html, /if\(document\.hidden\)\{stopEntitlementPolling\(\);return\}/);
});

test("Owner can combine QQ, status, and user_type filters", () => {
  assert.match(html, /id="entitlementSearchQq"/);
  assert.match(html, /id="entitlementFilter"/);
  assert.match(html, /id="entitlementTypeFilter"/);
  for (const type of ["stable", "beta", "developer"]) {
    assert.match(html, new RegExp(`<option value="${type}">`, "i"));
  }
  assert.match(html, /entitlementMatchesFilter\(row,statusFilter\)&&entitlementMatchesType\(row,typeFilter\)/);

  const filterHarness = new Function(`${extractFunction("function entitlementState")}
    ${extractFunction("function entitlementMatchesFilter")}
    ${extractFunction("function entitlementMatchesType")}
    return { entitlementMatchesFilter, entitlementMatchesType };`)();
  const rows = [
    { status: "active", activationState: "activated", userType: "stable" },
    { status: "active", activationState: "expired", userType: "beta" },
    { status: "revoked", activationState: "activated", userType: "developer" },
  ];
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesType(row, "beta")), [rows[1]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesFilter(row, "pending")), [rows[1]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesType(row, "all")), rows);
});

test("batch selection is limited to active rows in the current filtered result", () => {
  assert.match(html, /id="entitlementBatchToggle"/);
  assert.match(html, /data-ent-select/);
  assert.match(html, /function selectAllFilteredEntitlements\(\)\{entitlementSelectedIds=new Set\(filteredEntitlementRows\(\)\.filter\(row=>row\.status==="active"\)/);
  assert.match(html, /已选择 \$\{count\} 个账号/);
  assert.match(html, /全选仅作用于当前筛选结果/);
  assert.match(html, /function changeEntitlementFilters\(\)\{entitlementSelectedIds\.clear\(\);renderEntitlements\(\)\}/);

  const selectAllHarness = new Function(`let entitlementSelectedIds=new Set(),renderCount=0;
    const visibleRows=[
      {entitlementId:"beta-active",status:"active"},
      {entitlementId:"beta-revoked",status:"revoked"}
    ];
    function filteredEntitlementRows(){return visibleRows}
    function renderEntitlements(){renderCount+=1}
    ${extractFunction("function selectAllFilteredEntitlements")}
    selectAllFilteredEntitlements();
    return {selected:[...entitlementSelectedIds],renderCount};`)();
  assert.deepEqual(selectAllHarness.selected, ["beta-active"]);
  assert.equal(selectAllHarness.renderCount, 1);
});

test("batch user_type changes use the existing Owner PATCH path and refresh automatically", () => {
  const start = html.indexOf("async function applyEntitlementBatchType()");
  const end = html.indexOf("function entitlementDeviceLimitLabel", start);
  assert.ok(start >= 0 && end > start, "batch mutation function is present");
  const batchSource = html.slice(start, end);
  assert.match(batchSource, /已选择 \$\{selectedRows\.length\} 个账号，即将批量修改为 \$\{targetLabel\}/);
  assert.match(batchSource, /method:"PATCH"/);
  assert.match(batchSource, /action:"change-type"/);
  assert.match(batchSource, /entitlementId:row\.entitlementId,userType:target/);
  assert.match(batchSource, /await refreshEntitlements\(entitlementSearchQq\.value\.trim\(\),true,true\)/);
  assert.doesNotMatch(batchSource, /method:"POST"|method:"DELETE"|activationLink|deviceId/);

  const runBatch = new Function(`return async function(){
    let entitlementBusy=false;
    let entitlementRows=[
      {entitlementId:"one",qqAccount:"10001",status:"active",userType:"beta"},
      {entitlementId:"two",qqAccount:"10002",status:"active",userType:"stable"},
      {entitlementId:"three",qqAccount:"10003",status:"revoked",userType:"beta"}
    ];
    let entitlementSelectedIds=new Set(["one","two","three"]),requests=[],refreshCount=0,feedback=[];
    const entitlementBatchType={value:"stable"},entitlementSearchQq={value:""};
    function confirm(){return true}
    function renderEntitlementBatchState(){}
    function renderEntitlements(){}
    function setEntitlementFeedback(message,error=false){feedback.push({message,error})}
    async function entitlementRequest(path,init){requests.push({path,body:JSON.parse(init.body)});return {ok:true}}
    async function refreshEntitlements(){refreshCount+=1}
    ${extractFunction("async function applyEntitlementBatchType")}
    await applyEntitlementBatchType();
    return {requests,refreshCount,selected:[...entitlementSelectedIds],feedback};
  }`)();
  return runBatch().then((result) => {
    assert.deepEqual(result.requests, [{
      path: "/api/owner-console/entitlements",
      body: { action: "change-type", entitlementId: "one", userType: "stable" },
    }]);
    assert.equal(result.refreshCount, 1);
    assert.deepEqual(result.selected, []);
    assert.equal(result.feedback.at(-1).message, "已将 1 个账号修改为 Stable");
  });
});

test("single-account type management and existing authorization operations remain available", () => {
  assert.match(html, /data-ent-action="change-type"/);
  assert.match(html, /mutateEntitlement\(row,"change-type",select\.value\)/);
  for (const operation of ["复制链接", "复制登录入口", "重新生成", "设备", "撤销"]) {
    assert.match(html, new RegExp(operation));
  }
});

test("the inline Helper application script parses", () => {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match, "inline Helper script is present");
  assert.doesNotThrow(() => new Function(match[1]));
});
