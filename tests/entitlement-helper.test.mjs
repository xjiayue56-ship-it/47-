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

test("Owner can inspect devices and manage their individual use entries without exposing that capability to Admin", () => {
  assert.match(html, /data-ent-action="devices"/);
  assert.match(html, /id="entitlementDevicePanel"/);
  assert.match(html, /openEntitlementDevices/);
  assert.match(html, /revokeEntitlementDevice/);
  assert.match(html, /使用入口/);
  assert.match(html, /manageEntitlementEntry/);
  assert.match(html, /data-entry-action="move"/);
  assert.match(html, /data-entry-action="unlink"/);
  assert.match(html, /method:\"PATCH\",body:JSON\.stringify/);
  assert.match(html, /浏览器 · 待下次使用识别/);
  assert.doesNotMatch(html, />原有使用入口</);
  assert.match(html, /method:"DELETE",body:JSON\.stringify\(\{accountId:entitlementDeviceContext\.accountId,deviceId\}\)/);
  assert.match(html, /result\.overLimit/);
  assert.match(html, /超过当前上限/);
});

test("activated accounts expose an Owner-only copy action for the existing login entry", () => {
  assert.match(html, /state==="active"\|\|state==="suspended"\?'<button data-ent-action="copy-login-link">复制登录入口<\/button><button data-ent-action="devices">设备<\/button>'/);
  assert.match(html, /async function copyActivatedAccountLoginLink\(row\)/);
  assert.match(html, /action:"copy-login-link",entitlementId:row\.entitlementId/);
  assert.match(html, /if\(!result\.loginLink\)throw new Error\("已有账号登录入口没有正确返回"\)/);
  assert.match(html, /await copyEntitlementText\(result\.loginLink\)/);
  assert.match(html, /action==="copy-login-link"\)copyActivatedAccountLoginLink\(row\)/);
  assert.doesNotMatch(html, /action:"regenerate-login-link"|action:"issue-login-link"/);
});

test("expired Activation Links stay visible as expired and can only be regenerated", () => {
  assert.match(html, /activationExpiresAt/);
  assert.match(html, /72 小时 Activation Link/);
  assert.match(html, /state==="pending"\?'<button data-ent-action="regenerate">重新生成<\/button>'/);
});

test("authorization status refreshes while visible and stops outside the authorization view", () => {
  assert.match(html, /ENTITLEMENT_POLL_INTERVAL_MS=15000/);
  assert.match(html, /if\(id==="authorization"\)loadEntitlementConsole\(\);[\s\S]*else stopEntitlementPolling\(\)/);
  assert.match(html, /await refreshEntitlements\(entitlementSearchQq\.value\.trim\(\),false,true\);[\s\S]*startEntitlementPolling\(\)/);
  assert.match(html, /document\.addEventListener\("visibilitychange"/);
  assert.match(html, /if\(document\.hidden\)\{stopEntitlementPolling\(\);return\}/);
});

test("Owner combines QQ, access status, identity, and release channel as one strict intersection", () => {
  assert.match(html, /id="entitlementSearchQq"/);
  assert.match(html, /id="entitlementAccessFilter"/);
  assert.match(html, /id="entitlementIdentityFilter"/);
  assert.match(html, /id="entitlementChannelFilter"/);
  for (const type of ["stable", "beta", "developer"]) {
    assert.match(html, new RegExp(`<option value="${type}">`, "i"));
  }
  assert.match(html, /entitlementMatchesQuery\(row,query\)&&entitlementMatchesDimension\(row,access,"accessStatus"\)&&entitlementMatchesDimension\(row,identity,"identityType"\)&&entitlementMatchesDimension\(row,channel,"releaseChannel"\)/);

  const filterHarness = new Function(`${extractFunction("function entitlementMatchesQuery")}
    ${extractFunction("function entitlementMatchesDimension")}
    return { entitlementMatchesQuery, entitlementMatchesDimension };`)();
  const rows = [
    { qqAccount: "10001", accessStatus: "active", identityType: "customer", releaseChannel: "stable" },
    { qqAccount: "10002", accessStatus: "active", identityType: "tester", releaseChannel: "beta" },
    { qqAccount: "20001", accessStatus: "revoked", identityType: "customer", releaseChannel: "stable" },
    { qqAccount: "10003", accessStatus: "suspended", identityType: "tester", releaseChannel: "developer" },
  ];
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesDimension(row, "beta", "releaseChannel")), [rows[1]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesDimension(row, "active", "accessStatus")), [rows[0], rows[1]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesDimension(row, "stable", "releaseChannel")), [rows[0], rows[2]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesDimension(row, "developer", "releaseChannel")), [rows[3]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesQuery(row, "1000")), [rows[0], rows[1], rows[3]]);
  assert.deepEqual(rows.filter((row) => filterHarness.entitlementMatchesDimension(row, "all", "releaseChannel")), rows);

  const visible = rows.filter((row) => filterHarness.entitlementMatchesQuery(row, "100")
    && filterHarness.entitlementMatchesDimension(row, "active", "accessStatus")
    && filterHarness.entitlementMatchesDimension(row, "stable", "releaseChannel"));
  assert.deepEqual(visible, [rows[0]], "Stable never includes Beta, Developer, or unknown rows");

  const combinedHarness = new Function(`
    const entitlementRows=${JSON.stringify(rows)};
    const entitlementSearchQq={value:""},entitlementAccessFilter={value:"all"},entitlementIdentityFilter={value:"all"},entitlementChannelFilter={value:"all"};
    ${extractFunction("function entitlementMatchesQuery")}
    ${extractFunction("function entitlementMatchesDimension")}
    ${extractFunction("function filteredEntitlementRows")}
    return (query,access,identity,channel)=>{
      entitlementSearchQq.value=query;entitlementAccessFilter.value=access;entitlementIdentityFilter.value=identity;entitlementChannelFilter.value=channel;
      return filteredEntitlementRows().map(row=>row.qqAccount);
    };`)();
  assert.deepEqual(combinedHarness("", "all", "all", "stable"), ["10001", "20001"]);
  assert.deepEqual(combinedHarness("", "active", "tester", "beta"), ["10002"]);
  assert.deepEqual(combinedHarness("", "all", "all", "developer"), ["10003"]);
  assert.deepEqual(combinedHarness("", "all", "all", "all"), rows.map((row) => row.qqAccount));
  assert.deepEqual(combinedHarness("100", "suspended", "tester", "developer"), ["10003"]);
});

test("batch selection is limited to non-terminal accounts in the current filtered result", () => {
  assert.match(html, /id="entitlementBatchToggle"/);
  assert.match(html, /data-ent-select/);
  assert.match(html, /function selectAllFilteredEntitlements\(\)\{entitlementSelectedIds=new Set\(filteredEntitlementRows\(\)\.filter\(row=>entitlementState\(row\)!=="revoked"\)/);
  assert.match(html, /已选择 \$\{count\} 个账号/);
  assert.match(html, /全选仅作用于当前筛选结果/);
  assert.match(html, /function changeEntitlementFilters\(\)\{entitlementSelectedIds\.clear\(\);refreshEntitlements/);

  const selectAllHarness = new Function(`let entitlementSelectedIds=new Set(),renderCount=0;
    const visibleRows=[
      {entitlementId:"beta-active",accessStatus:"active"},
      {entitlementId:"beta-revoked",accessStatus:"revoked"}
    ];
    function filteredEntitlementRows(){return visibleRows}
    function renderEntitlements(){renderCount+=1}
    ${extractFunction("function entitlementState")}
    ${extractFunction("function selectAllFilteredEntitlements")}
    selectAllFilteredEntitlements();
    return {selected:[...entitlementSelectedIds],renderCount};`)();
  assert.deepEqual(selectAllHarness.selected, ["beta-active"]);
  assert.equal(selectAllHarness.renderCount, 1);
});

test("batch lifecycle changes use the Owner PATCH path, list revoke targets, and refresh automatically", () => {
  const start = html.indexOf("async function applyEntitlementBatchAction()");
  const end = html.indexOf("function entitlementDeviceLimitLabel", start);
  assert.ok(start >= 0 && end > start, "batch mutation function is present");
  const batchSource = html.slice(start, end);
  assert.match(batchSource, /本次将 Revoke 的全部账号/);
  assert.match(batchSource, /accounts=selectedRows\.map\(row=>row\.qqAccount\)\.join\("、"\)/);
  assert.match(batchSource, /method:"PATCH"/);
  assert.match(batchSource, /selectedRows=filteredEntitlementRows\(\)\.filter/);
  assert.match(batchSource, /action:"change-dimensions"/);
  assert.match(batchSource, /releaseChannel:actionValue\.split\(":"\)\[1\]/);
  assert.match(batchSource, /await refreshEntitlements\(entitlementSearchQq\.value\.trim\(\),true,true\)/);
  assert.doesNotMatch(batchSource, /method:"POST"|method:"DELETE"|activationLink|deviceId/);

  const runBatch = new Function(`return async function(){
    let entitlementBusy=false;
    let entitlementRows=[
      {entitlementId:"one",qqAccount:"10001",accessStatus:"active",releaseChannel:"beta"},
      {entitlementId:"two",qqAccount:"10002",accessStatus:"active",releaseChannel:"stable"},
      {entitlementId:"three",qqAccount:"10003",accessStatus:"revoked",releaseChannel:"beta"}
    ];
    let entitlementSelectedIds=new Set(["one","two","three"]),requests=[],refreshCount=0,feedback=[];
    const entitlementBatchAction={value:"channel:stable"},entitlementSearchQq={value:""};
    function filteredEntitlementRows(){return entitlementRows.filter(row=>row.entitlementId!=="two")}
    function confirm(){return true}
    function renderEntitlementBatchState(){}
    function renderEntitlements(){}
    function setEntitlementFeedback(message,error=false){feedback.push({message,error})}
    async function entitlementRequest(path,init){requests.push({path,body:JSON.parse(init.body)});return {ok:true}}
    async function refreshEntitlements(){refreshCount+=1}
    ${extractFunction("function entitlementState")}
    ${extractFunction("async function applyEntitlementBatchAction")}
    await applyEntitlementBatchAction();
    return {requests,refreshCount,selected:[...entitlementSelectedIds],feedback};
  }`)();
  return runBatch().then((result) => {
    assert.deepEqual(result.requests, [{
      path: "/api/owner-console/entitlements",
      body: { action: "change-dimensions", entitlementId: "one", releaseChannel: "stable" },
    }]);
    assert.equal(result.refreshCount, 1);
    assert.deepEqual(result.selected, []);
    assert.equal(result.feedback.at(-1).message, "已对 1 个账号执行 Channel → stable");
  });
});

test("single-account lifecycle and immutable release promotion remain explicit", () => {
  for (const action of ["suspend", "resume", "revoke", "reissue"]) assert.match(html, new RegExp(`data-ent-action="${action}"|value="${action}"`));
  for (const operation of ["复制链接", "复制登录入口", "重新生成", "设备", "Revoke", "重新批准"]) {
    assert.match(html, new RegExp(operation));
  }
  assert.match(html, /Revoke 是永久终态/);
  assert.match(html, /旧 Link 不会复活/);
  assert.match(html, /Promote SAME build → Beta/);
  assert.match(html, /Promote SAME build → Stable/);
  assert.match(html, /Owner 明确批准/);
  assert.doesNotMatch(html, /autoPromote|automaticPromotion/);
});

test("refund lookup uses the exact Order ID, names the linked account, and revokes only its entitlement", () => {
  assert.match(html, /id="entitlementRefundOrder"/);
  const start = html.indexOf("async function revokeRefundedEntitlement(event)");
  const end = html.indexOf("async function mutateEntitlement", start);
  assert.ok(start >= 0 && end > start, "refund revoke function is present");
  const source = html.slice(start, end);
  assert.match(source, /String\(item\.orderId\|\|""\)===orderId/);
  assert.match(source, /Order ID：\$\{orderId\}/);
  assert.match(source, /账号：\$\{row\.qqAccount\}/);
  assert.match(source, /不会删除 canonical user data/);
  assert.match(source, /action:"refund-revoke",orderId/);
  assert.doesNotMatch(source, /activation|deviceId|reset|delete/iu);
});

test("the inline Helper application script parses", () => {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match, "inline Helper script is present");
  assert.doesNotThrow(() => new Function(match[1]));
});
