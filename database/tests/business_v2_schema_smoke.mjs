// Schema-only tests. Never uses dotenv or the application's database configuration.
// Required: BUSINESS_V2_TEST_PORT (not 5432) and BUSINESS_V2_TEST_CLUSTER
// pointing at a newly initialized pet-business-v2-* cluster owned by this run.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const { Client } = require("pg");
const port = Number(process.env.BUSINESS_V2_TEST_PORT);
const cluster = process.env.BUSINESS_V2_TEST_CLUSTER;
assert.ok(Number.isInteger(port) && port > 1024 && port <= 65535 && port !== 5432,
    "Supply the dedicated temporary PostgreSQL port; never the application's port.");
assert.ok(cluster && /^pet-business-v2-[a-f0-9]{32}$/.test(basename(cluster)),
    "Supply the temporary pet-business-v2-* cluster created for this test.");
const configuration = { host: "127.0.0.1", port, user: "business_v2_qa",
    password: "", ssl: false, connectionTimeoutMillis: 5000 };
const admin = new Client({ ...configuration, database: "postgres" });
const run = randomUUID().replaceAll("-", "");
const databases = [];
const clients = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const legacyTables = [
    ["customer", "customer_id"], ["pet", "pet_id"], ["service", "service_id"],
    ["appointment", "appointment_id"], ["appointment_pet", "appointment_pet_id"],
    ["expense", "expense_id"], ["inventory_item", "inventory_item_id"],
    ["inventory_transaction", "inventory_transaction_id"], ["app_user", "user_id"],
    ["app_session", "token_hash"],
];

async function database(suffix) {
    const name = "business_v2_qa_" + run + "_" + suffix;
    await admin.query('CREATE DATABASE "' + name + '"');
    databases.push(name);
    const client = new Client({ ...configuration, database: name });
    clients.push(client);
    await client.connect();
    return client;
}
async function baseline(client) {
    await client.query(read("database/tests/fixtures/pre_v2_schema.sql"));
    await client.query(read("database/migrations/001_add_expenses_inventory.sql"));
}
async function fixtures(client) {
    // Own isolated fixtures only; no demo seed.sql and no live business records.
    await client.query(String.raw`
        INSERT INTO customer (customer_name, customer_hp) VALUES ('QA Owner', '000'), ('QA Other', '001');
        INSERT INTO pet (customer_id, pet_name, pet_type) VALUES (1, 'QA Dog', '金毛'), (1, 'QA Cat', 'Cat');
        INSERT INTO service (service_name, default_price, is_active)
            VALUES ('QA Legacy', 999.99, TRUE), ('QA Nullable price', NULL, FALSE);
        INSERT INTO appointment (customer_id, appointment_date, start_time, status, remark)
            VALUES (1, '2026-10-02', '10:00', 'COMPLETED', 'legacy completed'),
                   (1, '2026-10-03', '11:00', 'CONFIRMED', 'legacy confirmed'),
                   (1, '2026-10-04', '12:00', 'CANCELLED', 'legacy cancelled');
        INSERT INTO appointment_pet (appointment_id, pet_id, service_id, amount, remark)
            VALUES (1, 1, 1, 123.45, 'legacy actual'), (1, 2, 1, 0.29, 'fractional'),
                   (2, 1, 2, NULL, 'unknown charge'), (3, 1, 1, -1.23, 'allowed legacy value');
        INSERT INTO expense (expense_date, category, item_name, amount, source)
            VALUES ('2026-10-02', 'INVENTORY', 'QA supplies', 12.34, 'INVENTORY');
        INSERT INTO inventory_item (item_name, current_quantity, unit, reorder_level)
            VALUES ('QA supplies', 3, 'unit', 1);
        INSERT INTO inventory_transaction (inventory_item_id, transaction_type, quantity, amount, expense_id)
            VALUES (1, 'STOCK_IN', 3, 12.34, 1);
        INSERT INTO app_user (username, password_hash) VALUES ('qa-schema-only', 'not-a-login-fixture');
        INSERT INTO app_session (token_hash, user_id, expires_at)
            VALUES (REPEAT('a', 64), 1, CURRENT_TIMESTAMP + INTERVAL '1 day');
    `);
}
async function snapshot(client, reference) {
    const result = {};
    for (const [table, id] of legacyTables) {
        const rows = (await client.query("SELECT * FROM " + table + " ORDER BY " + id)).rows;
        const columns = reference?.[table]?.columns ?? Object.keys(rows[0]);
        result[table] = { columns, rows: rows.map(row => Object.fromEntries(columns.map(k => [k, row[k]]))) };
    }
    return JSON.parse(JSON.stringify(result));
}
async function fingerprint(client) {
    const columns = (await client.query(String.raw`
        SELECT c.relname AS table_name, a.attname AS column_name,
               format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull,
               a.attidentity, pg_get_expr(d.adbin, d.adrelid) AS default_expression
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname, a.attname
    `)).rows;
    const constraints = (await client.query(String.raw`
        SELECT c.relname AS table_name, con.conname, con.contype,
               pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' ORDER BY c.relname, con.conname
    `)).rows;
    const indexes = (await client.query(
        "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname"
    )).rows;
    return { columns, constraints, indexes };
}
async function fails(client, sql, code, params = []) {
    await assert.rejects(client.query(sql, params), e => [code].flat().includes(e.code));
}
async function addressLocations(client) {
    const sql = `INSERT INTO customer_address(customer_id,label,address_text,map_url,latitude,longitude)
                 VALUES(1,$1,$2,$3,$4,$5) RETURNING address_id`;
    const valid = [
        ["Text only","QA location",null,null,null],
        ["Map only",null,"https://maps.example.invalid/location",null,null],
        ["Coordinates only",null,null,0,0],
        ["Text and map","QA location","https://maps.apple.com/?q=QA",null,null],
        ["Text and coordinates","QA location",null,-90,-180],
        ["Map and coordinates",null,"https://location.example.invalid/qa",90,180],
        ["All representations","QA location","http://location.example.invalid/qa",1,2],
        ["Blank text with map"," \t\n","https://example.invalid/location",null,null],
        ["Blank map with coordinates",null," \t\n",1,2],
    ];
    let mapOnly;
    for (const location of valid) {
        const row = (await client.query(sql,location)).rows[0];
        if (location[0] === "Map only") mapOnly = row.address_id;
    }
    for (const location of [
        ["Empty",null,null,null,null],
        ["Blank"," \t\n"," \t\n",null,null],
        ["Blank text"," \t\n",null,null,null],
        ["Blank map",null," \t\n",null,null],
        ["Only latitude",null,null,1,null],
        ["Only longitude",null,null,null,2],
        ["Bad latitude",null,null,91,2],
        ["Bad longitude",null,null,1,-181],
        ["Half pair even with text","QA location",null,1,null],
        ["Bad range even with map",null,"https://example.invalid/qa",91,2],
        ["", "QA location",null,null,null],
    ]) await fails(client,sql,"23514",location);
    await fails(client,sql,"23502",[null,"QA location",null,null,null]);
    await fails(client,"UPDATE customer_address SET map_url=NULL WHERE address_id=$1","23514",[mapOnly]);
    await client.query(`UPDATE appointment SET customer_address_id=$1,address_label_snapshot='Map only',
        address_text_snapshot=NULL,map_url_snapshot='https://maps.example.invalid/location',
        latitude_snapshot=NULL,longitude_snapshot=NULL WHERE appointment_id=2`,[mapOnly]);
    await client.query("UPDATE customer_address SET address_text='Later text',map_url='https://example.invalid/changed' WHERE address_id=$1",[mapOnly]);
    assert.deepEqual((await client.query(`SELECT address_label_snapshot,address_text_snapshot,map_url_snapshot,
        latitude_snapshot,longitude_snapshot FROM appointment WHERE appointment_id=2`)).rows[0],{
        address_label_snapshot:"Map only",address_text_snapshot:null,
        map_url_snapshot:"https://maps.example.invalid/location",latitude_snapshot:null,longitude_snapshot:null,
    });
}
async function invariants(client) {
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM payment")).rows[0].n, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM customer_address")).rows[0].n, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM appointment_pet_addon")).rows[0].n, 0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM service WHERE service_kind <> 'BASE'")).rows[0].n, 0);
    assert.equal((await client.query(String.raw`
        SELECT COUNT(*)::int AS n FROM appointment WHERE travel_fee_amount IS NOT NULL OR travel_fee_label IS NOT NULL
            OR travel_fee_note IS NOT NULL OR customer_address_id IS NOT NULL
            OR address_label_snapshot IS NOT NULL OR address_text_snapshot IS NOT NULL
            OR map_url_snapshot IS NOT NULL OR latitude_snapshot IS NOT NULL
            OR longitude_snapshot IS NOT NULL OR payment_tracking_started_at IS NOT NULL
    `)).rows[0].n, 0);
    assert.equal((await client.query(String.raw`
        SELECT COUNT(*)::int AS n FROM appointment_pet WHERE service_name_snapshot IS NOT NULL
            OR base_price_snapshot IS NOT NULL OR quoted_amount IS NOT NULL
    `)).rows[0].n, 0);
    assert.equal((await client.query(String.raw`
        SELECT SUM(ap.amount)::text AS total FROM appointment a
        JOIN appointment_pet ap USING (appointment_id) WHERE a.status = 'COMPLETED'
    `)).rows[0].total, "123.74");
    assert.equal((await client.query("SHOW server_encoding")).rows[0].server_encoding,"UTF8");
    assert.equal((await client.query("SHOW client_encoding")).rows[0].client_encoding,"UTF8");
    const options = (await client.query("SELECT label,amount,is_active,sort_order FROM travel_fee_option ORDER BY sort_order")).rows;
    assert.deepEqual(options.map(o=>[o.label,o.amount,o.is_active,o.sort_order]),[
        ["5公里以内","2.00",true,10],["5–7公里","5.00",true,20],["7–10公里","10.00",true,30],
        ["10–15公里","20.00",true,40],["15公里以上",null,true,50],
    ]);

}
async function integrity(client) {
    await fails(client, "UPDATE service SET service_kind='INVALID' WHERE service_id=1", "23514");
    await fails(client, "UPDATE appointment SET travel_fee_amount=-1 WHERE appointment_id=1", "23514");
    await fails(client, "UPDATE appointment SET travel_fee_amount='NaN' WHERE appointment_id=1", "23514");
    await fails(client, "UPDATE appointment_pet SET quoted_amount=-1 WHERE appointment_pet_id=1", "23514");
    await fails(client, "UPDATE appointment_pet SET base_price_snapshot=-1 WHERE appointment_pet_id=1", "23514");
    await fails(client,"UPDATE travel_fee_option SET amount=-1 WHERE sort_order=10","23514");
    await fails(client,"UPDATE travel_fee_option SET amount='NaN' WHERE sort_order=10","23514");
    await fails(client,"UPDATE travel_fee_option SET label=' ' WHERE sort_order=10","23514");
    await fails(client,"UPDATE appointment SET travel_fee_amount=0 WHERE appointment_id=1","23514");
    await client.query("UPDATE appointment SET travel_fee_label='免交通费',travel_fee_amount=0 WHERE appointment_id=1");
    assert.equal((await client.query("SELECT travel_fee_amount::text AS amount FROM appointment WHERE appointment_id=1")).rows[0].amount,"0.00");
    await client.query("UPDATE appointment SET travel_fee_label=NULL,travel_fee_amount=NULL WHERE appointment_id=1");
    const addressSql = "INSERT INTO customer_address(customer_id,label,address_text,latitude,longitude,is_default,is_active) VALUES($1,$2,'QA address',$3,$4,$5,$6) RETURNING address_id";
    const insertAddress = (customer, label, lat, lon, def, active) => client.query(addressSql, [customer,label,lat,lon,def,active]);
    const home = (await insertAddress(1,"Home",null,null,true,true)).rows[0].address_id;
    await insertAddress(1,"Work",90,180,false,true);
    await insertAddress(1,"Inactive default",-90,-180,true,false);
    await insertAddress(2,"Other default",null,null,true,true);
    await fails(client, addressSql, "23505", [1,"Second default",null,null,true,true]);
    await fails(client, addressSql, "23514", [1,"Bad latitude",91,0,false,true]);
    await fails(client, addressSql, "23514", [1,"Bad longitude",0,181,false,true]);
    await fails(client, addressSql, "23514", [1,"Half pair",0,null,false,true]);
    await fails(client, addressSql, "23514", [1,"Blank label",null,null,false,true].map((v,i)=>i===1?" ":v));
    await fails(client, addressSql, "23503", [999999,"No customer",null,null,false,true]);
    await addressLocations(client);
    await client.query("UPDATE appointment SET customer_address_id=$1,address_label_snapshot='Original',address_text_snapshot='Original address',latitude_snapshot=1,longitude_snapshot=2 WHERE appointment_id=1", [home]);
    await client.query("UPDATE customer_address SET label='Changed',address_text='Changed address' WHERE address_id=$1", [home]);
    assert.equal((await client.query("SELECT address_text_snapshot FROM appointment WHERE appointment_id=1")).rows[0].address_text_snapshot,"Original address");
    await fails(client, "UPDATE appointment SET longitude_snapshot=NULL WHERE appointment_id=1", "23514");
    await fails(client, "UPDATE appointment SET latitude_snapshot=91 WHERE appointment_id=1", "23514");
    await fails(client, "DELETE FROM customer_address WHERE address_id=$1", "23503", [home]);
    const addonId = (await client.query("INSERT INTO service(service_name,default_price,service_kind) VALUES('QA Addon',5,'ADDON') RETURNING service_id")).rows[0].service_id;
    const addonSql = "INSERT INTO appointment_pet_addon(appointment_pet_id,service_id,service_name_snapshot,price_snapshot) VALUES($1,$2,'Booked addon',$3)";
    await client.query(addonSql,[1,addonId,5]);
    await fails(client, addonSql, "23505", [1,addonId,5]);
    await fails(client, addonSql, "23514", [2,addonId,-1]);
    await fails(client, addonSql, "23503", [999999,addonId,5]);
    await fails(client, addonSql, "23503", [2,999999,5]);
    await client.query("UPDATE service SET service_name='Changed addon',default_price=99 WHERE service_id=$1",[addonId]);
    assert.equal((await client.query("SELECT price_snapshot::text FROM appointment_pet_addon")).rows[0].price_snapshot,"5.00");
    // Final due does NOT add the informational addon snapshot.
    await client.query("UPDATE appointment SET travel_fee_label='QA fee',travel_fee_amount=2 WHERE appointment_id=1");
    assert.equal((await client.query("SELECT (SUM(ap.amount)+COALESCE(a.travel_fee_amount,0))::text AS due FROM appointment a JOIN appointment_pet ap USING(appointment_id) WHERE a.appointment_id=1 GROUP BY a.appointment_id")).rows[0].due,"125.74");
    const paymentSql = "INSERT INTO payment(appointment_id,amount,payment_method,paid_at,created_by_user_id,request_key) VALUES($1,$2,$3,CURRENT_TIMESTAMP,$4,$5) RETURNING payment_id";
    const key = randomUUID();
    await client.query(paymentSql,[1,20,"CASH",1,key]);
    await fails(client,paymentSql,"23505",[1,20,"CASH",1,key]);
    await fails(client,paymentSql,"23514",[1,0,"CASH",1,randomUUID()]);
    await fails(client,paymentSql,"23514",[1,-1,"CASH",1,randomUUID()]);
    await fails(client,paymentSql,"23514",[1,"NaN","CASH",1,randomUUID()]);
    await fails(client,paymentSql,"23514",[1,1,"CARD",1,randomUUID()]);
    await fails(client,paymentSql,"23502",[1,1,"CASH",1,null]);
    await fails(client,paymentSql,"23503",[999999,1,"CASH",1,randomUUID()]);
    await fails(client,paymentSql,"23503",[1,1,"CASH",999999,randomUUID()]);
    for (const method of ["BANK_TRANSFER","EWALLET","OTHER"]) await client.query(paymentSql,[1,1,method,null,randomUUID()]);
    await fails(client,"DELETE FROM appointment WHERE appointment_id=1",["23503", "23001"]);
    await client.query("DELETE FROM app_user WHERE user_id=1");
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM payment WHERE created_by_user_id IS NOT NULL")).rows[0].n,0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM app_session")).rows[0].n,0);
    await client.query("DELETE FROM appointment_pet WHERE appointment_pet_id=1");
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM appointment_pet_addon")).rows[0].n,0);
}
try {
    await admin.connect();
    const actual = (await admin.query("SHOW data_directory")).rows[0].data_directory;
    const normal = value => resolve(value).replaceAll("\\", "/").toLowerCase();
    assert.equal(normal(actual), normal(resolve(cluster,"data")), "Wrong cluster; refused to create test databases.");
    const fresh = await database("fresh");
    await fresh.query("BEGIN");
    await fresh.query(read("database/schema.sql"));
    await fresh.query("COMMIT");
    const upgrade = await database("upgrade");
    await baseline(upgrade);
    await fixtures(upgrade);
    const before = await snapshot(upgrade);
    await upgrade.query(read("database/migrations/004_business_v2.sql"));
    assert.deepEqual(await snapshot(upgrade,before),before,"Legacy rows/values changed.");
    await fixtures(fresh);
    await invariants(fresh);
    await invariants(upgrade);
    const freshShape = await fingerprint(fresh);
    assert.deepEqual(await fingerprint(upgrade), freshShape, "Fresh and upgrade schema definitions diverge.");
    assert.equal(new Set(freshShape.columns.map(c=>c.table_name)).size,14);
    assert.equal(freshShape.columns.some(c=>c.column_name==="payment_status"),false);
    assert.equal(freshShape.columns.some(c=>c.table_name==="service" && c.column_name==="pet_type"),false);
    assert.equal(freshShape.columns.some(c=>c.table_name==="appointment" && (c.column_name==="travel_fee_option_id" || c.column_name==="travel_fee_rule_id")),false);
    assert.ok(freshShape.columns.some(c=>c.table_name==="appointment" && c.column_name==="travel_fee_amount" && !c.attnotnull && c.default_expression === null));
    for (const [column, required] of [["label",true],["address_text",false],["map_url",false]]) {
        assert.equal(freshShape.columns.find(c=>c.table_name==="customer_address"&&c.column_name===column).attnotnull,required);
    }
    assert.ok(freshShape.constraints.some(c=>c.table_name==="customer_address"&&c.conname==="chk_customer_address_location"));
    for (const name of ["uq_appointment_pet_addon","idx_customer_address_customer","idx_customer_address_active_default","idx_payment_appointment","idx_payment_paid_at","idx_travel_fee_option_active_sort","idx_expense_date","idx_inventory_transaction_item_created"]) {
        assert.ok(freshShape.indexes.some(index=>index.indexname===name),"Missing index "+name);
    }
    await integrity(fresh);
    await integrity(upgrade);
    const rollback = await database("rollback");
    await baseline(rollback);
    await fixtures(rollback);
    const rollbackBefore = await snapshot(rollback);
    await rollback.query("CREATE TABLE payment (sentinel integer)");
    await fails(rollback,read("database/migrations/004_business_v2.sql"),"42P07");
    await rollback.query("ROLLBACK");
    assert.deepEqual(await snapshot(rollback,rollbackBefore),rollbackBefore);
    assert.equal((await rollback.query("SELECT to_regclass('travel_fee_option') AS table_name")).rows[0].table_name,null);
    assert.equal((await rollback.query("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='service' AND column_name='service_kind'")).rows[0].n,0);
    console.log("PASS: fresh schema alone (14 tables); legacy upgrade; all original columns/rows preserved; defaults/NULLs; five exact Unicode templates, nullable/explicit-zero travel charges; fresh/upgrade schema equivalence; optional address text/map, all usable location combinations and empty/pair/range rejection; indexes; constraint rejection; map-only snapshot retention; cascades; payment preservation; transactional rollback.");
} finally {
    for (const client of clients) await client.end();
    for (const name of databases) await admin.query('DROP DATABASE "'+name+'"');
    await admin.end();
}
