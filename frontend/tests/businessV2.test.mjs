import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

// No added dependency or application database. Compile the actual TS/TSX sources
// in memory with the project's TypeScript and exercise pure logic, SSR and mocked clients.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = fileURLToPath(new URL("../",import.meta.url));
const cache = new Map();
function load(relative) {
    const file = resolve(root,relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports:{} }; cache.set(file,module);
    const source = readFileSync(file,"utf8").replaceAll("import.meta.env.VITE_API_BASE_URL",'""');
    const code = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,
        target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true } }).outputText;
    const localRequire = id => {
        if (!id.startsWith(".")) return createRequire(file)(id);
        const base = resolve(dirname(file),id);
        for (const suffix of extname(base) ? [""] : [".ts",".tsx"]) {
            try { readFileSync(base + suffix); return load(base + suffix); }
            catch (error) { if (error.code !== "ENOENT") throw error; }
        }
        throw new Error("Missing test import: " + id);
    };
    new Function("require","module","exports",code)(localRequire,module,module.exports);
    return module.exports;
}
const business = load("src/utils/businessV2.ts");
const labels = load("src/utils/displayLabels.ts");
const render = (file,props) => renderToStaticMarkup(React.createElement(load(file).default,props));
const service = (id,kind,price = 10,active = true) => ({ service_id:String(id),service_name:`服务${id}`,
    service_kind:kind,default_price:price,is_active:active });
const catalog = [service(1,"BASE",70),service(2,"BASE",45),service(3,"BASE",30),
    service(4,"ADDON",10),service(5,"ADDON",10),service(6,"ADDON",5),service(7,"ADDON",5,false)];
const pets = [{ pet_id:"1",pet_name:"Bobby",pet_type:"金毛",customer_id:"1",pet_remark:null },
    { pet_id:"2",pet_name:"Kitty",pet_type:"Cat",customer_id:"1",pet_remark:null }];
const row = { ...business.emptyPetDraft(1),pet_id:"1",service_id:"1",addonIds:["4","5"] };
const original = { appointment_pet_id:1,pet_id:1,pet_name:"Bobby",pet_type:"Small Dog",service_id:1,service_name:"原基础服务",
    service_name_snapshot:"原基础服务",base_price_snapshot:70,quoted_amount:90,default_price:70,amount:null,remark:null,
    addons:[{ appointment_pet_addon_id:1,service_id:4,service_name_snapshot:"头部造型",price_snapshot:10 },
        { appointment_pet_addon_id:2,service_id:5,service_name_snapshot:"身体造型",price_snapshot:10 }] };
const appointment = { appointment_id:"1",customer_id:"1",customer_name:"QA Customer",customer_hp:"000",
    appointment_date:"2026-10-03",start_time:"10:00",status:"CONFIRMED",remark:null,pets:[original],quoted_total:100,
    travel_fee_amount:10,travel_fee_label:"7–10公里",travel_fee_note:null,
    customer_address_id:"1",address_label_snapshot:"住家",address_text_snapshot:null,map_url_snapshot:"https://maps.apple.com/?q=QA",
    latitude_snapshot:null,longitude_snapshot:null,amount_due:null };

test("breed stays free text; all active BASE/ADDON services are offered without species filtering",() => {
    assert.deepEqual(labels.serviceKindLabels,{ BASE:"基础服务",ADDON:"加购项目" });
    assert.equal(labels.displayPetType("金毛"),"金毛"); assert.equal(labels.displayPetType("英短"),"英短");
    for (const pet of [pets[0],pets[1],{ ...pets[0],pet_type:"混种" }]) {
        assert.deepEqual(business.eligibleServices(catalog,"BASE",pet).map(s=>s.service_id),["1","2","3"]);
        assert.deepEqual(business.eligibleServices(catalog,"ADDON",pet).map(s=>s.service_id),["4","5","6"]);
    }
});

test("retained inactive selection requires the same original pet; pet change clears services",() => {
    const changed = catalog.map(s => s.service_id === "1" ? { ...s,is_active:false } : s);
    assert.ok(business.eligibleServices(changed,"BASE",pets[0],original).some(s => s.service_id === "1"));
    assert.ok(!business.eligibleServices(changed,"BASE",pets[1],original).some(s => s.service_id === "1"));
    const withInactiveAddon = { ...original,addons:[{ service_id:7 }] };
    assert.ok(business.eligibleServices(catalog,"ADDON",pets[0],withInactiveAddon).some(s => s.service_id === "7"));
    assert.ok(!business.eligibleServices(catalog,"ADDON",pets[1],withInactiveAddon).some(s => s.service_id === "7"));
    const result = business.changePetDraft(row,"pet_id","2");
    assert.equal(result.service_id,""); assert.deepEqual(result.addonIds,[]);
});

test("multiple independent add-ons and exact-cent previews; final amount is never sent at booking",() => {
    assert.equal(business.petDraftQuote(row,catalog),90);
    assert.equal(business.petDraftQuote({ ...row,addonIds:["4"] },catalog),80);
    const cat = { ...business.emptyPetDraft(2),pet_id:"2",service_id:"2",addonIds:["6"] };
    assert.equal(business.previewTotal([business.petDraftQuote(row,catalog),business.petDraftQuote(cat,catalog)],10),150);
    assert.equal(business.previewPetQuote(.1,[.2]),.3);
    assert.equal(business.validatePetDrafts([row,cat],pets,catalog),null);
    assert.match(business.validatePetDrafts([{ ...row,addonIds:["1"] }],pets,catalog),/加购/);
    assert.match(business.validatePetDrafts([{ ...row,addonIds:["4","4"] }],pets,catalog),/加购/);
    const payload = business.bookingPetPayload({ ...row,appointment_pet_id:1 });
    assert.deepEqual(payload.addons,[{ service_id:"4" },{ service_id:"5" }]);
    assert.equal(payload.appointment_pet_id,1); assert.ok(!("amount" in payload)); assert.ok(!("quoted_amount" in payload));
    assert.deepEqual(business.bookingPetPayload({ ...row,addonIds:[] }).addons,[]);
});

test("unknown quotes remain unknown; genuine zero is RM0.00, not missing",() => {
    assert.equal(business.previewPetQuote(null,[10]),null);
    assert.equal(business.previewTotal([90,null],10),null);
    assert.equal(business.previewPetQuote(99999999.99,[.01]),null);
    assert.equal(business.quoteLabel(null),"未记录"); assert.equal(business.quoteLabel(undefined),"未记录");
    assert.equal(business.quoteLabel(0),"RM0.00");
});

test("strict manual/service/final money validation and travel added exactly once",() => {
    for (const value of ["","-1","1.234","1e2","100000000","NaN","Infinity"]) assert.equal(business.parseMoneyInput(value),null);
    for (const amount of [0,2,5,10,20]) {
        const draft = { ...business.initialExtras(),travelChanged:true,presetAmount:amount,optionId:"api-id",travelLabel:amount ? "API label" : "免交通费" };
        assert.equal(business.travelPreview(draft),amount);
        assert.equal(business.previewTotal([90,45],business.travelPreview(draft)),135 + amount);
        assert.equal(business.bookingExtrasPayload(draft).travel_fee_amount,amount);
    }
    const manual = { ...business.initialExtras(),optionId:"manual-api-id",travelLabel:"15公里以上",travelChanged:true,manual:true,manualAmount:"27.35" };
    assert.equal(business.bookingExtrasPayload(manual).travel_fee_amount,27.35);
    assert.throws(() => business.bookingExtrasPayload({ ...manual,manualAmount:"1.234" }));
});

test("editing omits unchanged address and travel fields; note-only edit cannot reprice",() => {
    const originalDraft = business.initialExtras(appointment);
    assert.deepEqual(business.bookingExtrasPayload(originalDraft,appointment),{});
    assert.deepEqual(business.bookingExtrasPayload({ ...originalDraft,note:"新备注" },appointment),{ travel_fee_note:"新备注" });
    assert.deepEqual(business.bookingExtrasPayload({ ...originalDraft,addressId:"2" },appointment),{ customer_address_id:"2" });
    assert.deepEqual(business.bookingExtrasPayload({ ...originalDraft,addressId:"" },appointment),{ customer_address_id:null });
    assert.equal(business.travelPreview(originalDraft,appointment),10);
    assert.deepEqual(business.appointmentLocation(appointment),{ label:"住家",address_text:null,map_url:"https://maps.apple.com/?q=QA",latitude:null,longitude:null });
});

test("text/map-only address validation, label default, safe provider-agnostic map links",() => {
    assert.equal(business.validateAddressForm("住家","123 Jalan Example",""),null);
    assert.equal(business.validateAddressForm("其他","","https://maps.apple.com/?q=QA"),null);
    assert.match(business.validateAddressForm("住家"," \t"," "),/至少|文字地址或地图/);
    assert.match(business.validateAddressForm("","Address",""),/标签/);
    for (const url of ["javascript:alert(1)","ftp://example.invalid/qa","https://user:secret@example.invalid"]) assert.equal(business.safeHttpUrl(url),null);
    assert.equal(business.mapHref({ map_url:"https://location.example.invalid/qa",address_text:"Other" }),"https://location.example.invalid/qa");
    assert.ok(business.mapHref({ address_text:"123 Jalan Example, Muar" }).endsWith(encodeURIComponent("123 Jalan Example, Muar")));
    assert.equal(business.mapHref({}),null);
    const form = render("src/components/addresses/AddressForm.tsx",{ customerId:"1",onCancel:() => {},onSaved:async () => {} });
    assert.match(form,/value="住家"/); assert.match(form,/文字地址（选填）/); assert.match(form,/地图链接（选填）/);
    const display = render("src/components/addresses/LocationDisplay.tsx",{ location:{ map_url:"https://maps.apple.com/?q=QA" } });
    assert.match(display,/noopener noreferrer/); assert.match(display,/在地图打开/);
});

test("completion prefers quote; editable final override and travel stay separate",() => {
    assert.equal(business.completionInitialAmount(original),"90.00");
    assert.equal(business.completionInitialAmount({ ...original,amount:85 }),"85.00");
    assert.equal(business.completionInitialAmount({ ...original,quoted_amount:null }),"70.00");
    assert.equal(business.completionInitialAmount({ ...original,quoted_amount:null,default_price:null }),"");
    assert.equal(business.completionInitialAmount({ ...original,quoted_amount:0 }),"0.00");
    const html = render("src/components/appointments/CompleteAppointmentForm.tsx",{ appointment,onClose:() => {},onSuccess:async () => {} });
    assert.match(html,/value="90.00"/); assert.match(html,/交通费单独计入预约总额/); assert.match(html,/RM100.00/);
});

test("SSR itemized snapshots and legacy records render without invented historical quotes",() => {
    const html = render("src/components/appointments/AppointmentV2Details.tsx",{ appointment });
    assert.match(html,/头部造型/); assert.match(html,/身体造型/); assert.match(html,/RM100.00/);
    assert.match(html,/maps.apple.com/);
    const legacy = { ...appointment,quoted_total:null,customer_address_id:null,address_label_snapshot:null,map_url_snapshot:null,
        pets:[{ ...original,quoted_amount:null,base_price_snapshot:null,service_name_snapshot:null,addons:undefined }] };
    const old = render("src/components/appointments/AppointmentV2Details.tsx",{ appointment:legacy });
    assert.match(old,/预计服务费：未记录/); assert.match(old,/原基础价格未记录/); assert.doesNotMatch(old,/NaN/);
    const fields = render("src/components/appointments/PetServicesFields.tsx",{ row,pets,services:catalog,original:legacy.pets[0],onBase:() => {},onAddons:() => {} });
    assert.match(fields,/原预约预计服务费：未记录/); assert.match(fields,/保存后预计（当前价格）/);
});

test("completed details/history use backend totals, never recalculate from quotes or catalog",() => {
    const completed = { ...appointment,status:"COMPLETED",amount_due:123.45,pets:[{ ...original,amount:85 }] };
    const html = render("src/components/appointments/AppointmentV2Details.tsx",{ appointment:completed,compact:true });
    assert.match(html,/宠物最终服务费：RM85.00/); assert.match(html,/最终应收：RM123.45/);
    assert.doesNotMatch(html,/最终应收：RM95.00/);
    const history = render("src/components/appointments/AppointmentV2Details.tsx",{ appointment:{ ...completed,amount_due:undefined,amount:77 },compact:true });
    assert.match(history,/最终应收：RM77.00/);
});

test("address snapshot and map fallback never require a current address or unsafe link",() => {
    assert.equal(business.mapHref({ map_url:"javascript:alert(1)",address_text:"Old snapshot" }),
        "https://www.google.com/maps/search/?api=1&query=Old%20snapshot");
    assert.equal(business.mapHref({ latitude:2.04,longitude:102.56 }),
        "https://www.google.com/maps/search/?api=1&query=2.04%2C102.56");
    const changed = { ...business.initialExtras(appointment),addressId:"2" };
    assert.deepEqual(business.bookingExtrasPayload(changed,appointment),{ customer_address_id:"2" });
    assert.deepEqual(business.bookingExtrasPayload({ ...changed,addressId:"1",addressChanged:true },appointment),{});
});

test("API clients retain English payloads, typed 409, and nested address routes",async () => {
    const previous = globalThis.fetch; const calls = [];
    globalThis.fetch = async (url,init = {}) => { calls.push({ url:String(url),init }); return new Response(JSON.stringify({ service_id:"9",address_id:"8" }),{ status:200,headers:{ "Content-Type":"application/json" } }); };
    try {
        const services = load("src/services/serviceService.ts");
        await services.createService({ service_name:"加购",default_price:10,service_kind:"ADDON" });
        assert.equal(JSON.parse(calls.at(-1).init.body).service_kind,"ADDON");
        await services.createService({ service_name:"基础",default_price:70,service_kind:"BASE" });
        assert.equal(JSON.parse(calls.at(-1).init.body).service_kind,"BASE");
        const addresses = load("src/services/addressService.ts");
        await addresses.createCustomerAddress("1",{ label:"住家",address_text:null,map_url:"https://maps.apple.com/?q=QA" });
        assert.equal(calls.at(-1).url,"/api/customers/1/addresses");
        assert.equal(JSON.parse(calls.at(-1).init.body).address_text,null);
        await load("src/services/travelFeeService.ts").getTravelFeeOptions();
        assert.equal(calls.at(-1).url,"/api/travel-fee-options");
        assert.equal(new Headers(calls.at(-1).init.headers).get("X-Pet-Management-Request"),"1");
        globalThis.fetch = async () => new Response("{}",{ status:409 });
        await assert.rejects(services.updateService("9",{ service_name:"基础",default_price:10,service_kind:"BASE",is_active:true }),error => error.status === 409);
    } finally { globalThis.fetch = previous; }
});

test("new travel selection is required; legacy NULL display and explicit zero remain distinct",() => {
    const empty=business.initialExtras();
    assert.equal(business.travelPreview(empty),null); assert.equal(business.travelEstimate(empty),null);
    assert.throws(()=>business.bookingExtrasPayload(empty),/请选择交通费/);
    assert.equal(business.validateTravelDraft(empty),"请选择交通费。");
    const free={...empty,optionId:"explicit-free-option",travelChanged:true,travelLabel:"免交通费",presetAmount:0};
    assert.equal(business.bookingExtrasPayload(free).travel_fee_amount,0);
    assert.equal(business.bookingExtrasPayload(free).travel_fee_label,"免交通费");
    assert.equal(business.previewTotal([90],business.travelEstimate(empty)),null);
    assert.equal(business.previewTotal([90],5),95);
    assert.equal(business.previewTotal([85],5),90);
    const none=render("src/components/appointments/AppointmentV2Details.tsx",{appointment:{...appointment,travel_fee_label:null,travel_fee_amount:null}});
    assert.match(none,/未记录/); assert.doesNotMatch(none,/不收取交通费/);
    const complete=render("src/components/appointments/CompleteAppointmentForm.tsx",{appointment:{...appointment,travel_fee_amount:5},onClose:()=>{},onSuccess:async()=>{}});
    assert.match(complete,/最终应收总额：RM95.00/); assert.match(complete,/宠物最终服务费/);
});

test("travel management clients send configurable label/amount/active/order without rule fields",async () => {
    const previous=globalThis.fetch; const calls=[];
    globalThis.fetch=async (url,init={})=>{ calls.push({url:String(url),init});return new Response("{}",{status:200}); };
    try {
        const api=load("src/services/travelFeeService.ts");
        await api.getTravelFeeOptions(true);
        assert.equal(calls.at(-1).url,"/api/travel-fee-options?include_inactive=true");
        await api.createTravelFeeOption({label:"免交通费",amount:0,is_active:true,sort_order:10});
        assert.deepEqual(JSON.parse(calls.at(-1).init.body),{label:"免交通费",amount:0,is_active:true,sort_order:10});
        await api.updateTravelFeeOption("9",{label:"15公里以上",amount:null,is_active:false,sort_order:50});
        assert.equal(calls.at(-1).url,"/api/travel-fee-options/9");
        assert.equal(JSON.parse(calls.at(-1).init.body).amount,null);
        assert.equal(calls.at(-1).init.method,"PUT");
    } finally { globalThis.fetch=previous; }
});

test("legacy booking edit requires a selection, while untouched recorded travel is preserved",() => {
    const legacy={...appointment,travel_fee_label:null,travel_fee_amount:null};
    assert.match(business.validateTravelDraft(business.initialExtras(legacy),legacy),/请选择/);
    const selected={...business.initialExtras(legacy),travelChanged:true,optionId:"active-option",travelLabel:"免交通费",presetAmount:0};
    assert.equal(business.validateTravelDraft(selected,legacy),null);
    assert.deepEqual(business.bookingExtrasPayload(selected,legacy),{travel_fee_option_id:"active-option",travel_fee_label:"免交通费",travel_fee_amount:0});
    assert.equal(business.validateTravelDraft(business.initialExtras(appointment),appointment),null);
    assert.deepEqual(business.bookingExtrasPayload(business.initialExtras(appointment),appointment),{});
});

test("history cache is initially lazy, deduplicates in-flight/reopen requests and paginates on demand",async () => {
    assert.ok(readFileSync(resolve(root,"src/pages/CustomersPage.tsx"),"utf8").includes('key={`history-${selected.customer_id}`}'),"History key must not collide with the sibling address key");
    const {createCustomerHistoryStore}=load("src/utils/customerHistoryStore.ts");
    const calls=[];let release;
    const fixture=Array.from({length:23},(_,i)=>({...appointment,appointment_id:String(i+1)}));
    const store=createCustomerHistoryStore(async (id,limit,offset)=>{
        calls.push({id,limit,offset});
        if(offset===0 && calls.length===1) await new Promise(resolve=>{release=resolve;});
        return {appointments:fixture.slice(offset,offset+limit),limit,offset,has_more:offset+limit<fixture.length,
            next_offset:offset+limit<fixture.length ? offset+limit : null};
    });
    assert.equal(store.get("1").loaded,false);assert.equal(calls.length,0);
    const html=render("src/components/customers/CustomerAppointmentHistory.tsx",{customerId:"1",store});
    assert.match(html,/查看预约记录/);assert.equal(calls.length,0);assert.doesNotMatch(html,/原基础服务/);
    const first=store.loadFirst("1"),duplicate=store.loadFirst("1");
    assert.equal(first,duplicate);await Promise.resolve();assert.equal(calls.length,1);
    release();await first;assert.equal(store.get("1").appointments.length,10);
    await store.loadFirst("1");assert.equal(calls.length,1);
    const more=store.loadMore("1");assert.equal(more,store.loadMore("1"));await more;
    assert.equal(store.get("1").appointments.length,20);
    await store.loadMore("1");assert.equal(store.get("1").appointments.length,23);
    await store.loadMore("1");assert.deepEqual(calls.map(call=>call.offset),[0,10,20]);
    store.invalidate("1");assert.equal(store.get("1").loaded,false);assert.equal(calls.length,3);
});

test("history empty/error states and retry keep pages bounded without losing existing records",async () => {
    const {createCustomerHistoryStore}=load("src/utils/customerHistoryStore.ts");
    let fail=true;const calls=[];
    const store=createCustomerHistoryStore(async (id,limit,offset)=>{
        calls.push(offset);if(fail)throw new Error("mock network failure");
        return {appointments:id==="empty"?[]:[appointment],limit,offset,has_more:false,next_offset:null};
    });
    await store.loadFirst("1");assert.equal(store.get("1").error,true);assert.equal(store.get("1").loaded,false);
    fail=false;await store.loadFirst("1");assert.equal(store.get("1").appointments.length,1);assert.equal(store.get("1").error,false);
    await store.loadFirst("empty");assert.equal(store.get("empty").loaded,true);assert.equal(store.get("empty").appointments.length,0);
    assert.equal(store.get("empty").nextOffset,null);
});

test("history client requests bounded page separately from overview",async () => {
    const previous=globalThis.fetch;const urls=[];
    globalThis.fetch=async url=>{urls.push(String(url));return new Response("{}",{status:200});};
    try {
        const api=load("src/services/customerService.ts");
        await api.getCustomerOverview("1");assert.deepEqual(urls,["/api/customers/1/overview"]);
        await api.getCustomerAppointments("1",10,20);assert.equal(urls.at(-1),"/api/customers/1/appointments?limit=10&offset=20");
    } finally {globalThis.fetch=previous;}
});

test("load-more failure preserves prior records and retries the same offset without duplicates",async () => {
    const {createCustomerHistoryStore}=load("src/utils/customerHistoryStore.ts");
    let failing=true;const offsets=[];
    const store=createCustomerHistoryStore(async (_id,limit,offset)=>{
        offsets.push(offset);
        if(offset && failing)throw new Error("mock page failure");
        return {appointments:offset?[appointment,{...appointment,appointment_id:"2"}]:[appointment],limit,offset,
            has_more:offset===0,next_offset:offset===0?10:null};
    });
    await store.loadFirst("1");await store.loadMore("1");
    assert.equal(store.get("1").error,true);assert.equal(store.get("1").appointments.length,1);
    assert.equal(store.get("1").nextOffset,10);
    failing=false;await store.loadMore("1");
    assert.equal(store.get("1").error,false);assert.equal(store.get("1").appointments.length,2);
    assert.deepEqual(offsets,[0,10,10]);assert.equal(store.get("1").nextOffset,null);
});
