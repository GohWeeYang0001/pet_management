import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { baseUrl,withSession } from "./authFixture";

export async function runCustomerPetManagementSmoke(cookie:string):Promise<void> {
    const marker="Management QA "+randomUUID();const owners:Array<{id:string;name:string}>=[];let serviceId:string|undefined;
    const json=(method:string,input:object):RequestInit=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
    async function api<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(baseUrl+path,withSession(cookie,init));assert.ok(r.ok,path+" "+r.status+" "+(!r.ok?await r.text():""));return r.json() as Promise<T>;}
    async function expect(path:string,init:RequestInit,status:number){const r=await fetch(baseUrl+path,withSession(cookie,init));assert.equal(r.status,status,path);return r.json() as Promise<{code?:string;field_errors?:Array<{field:string}>}>;}
    async function owner(suffix:string){const name=marker+suffix;const row=await api<{customer_id:string}>("/api/customers",json("POST",{customer_name:name,customer_hp:"000"}));owners.push({id:row.customer_id,name});return row.customer_id;}
    try {
        const missing=await expect("/api/appointments",json("POST",{}),400);
        assert.deepEqual(missing.field_errors?.map(e=>e.field),["customer","date","time","address","pets","travel"]);
        const clean=await owner(" typo"),cleanPets=[];
        for(let i=0;i<2;i++)cleanPets.push(await api<{pet_id:string}>(`/api/customers/${clean}/pets`,json("POST",{pet_name:"QA pet"+i,pet_type:"金毛"})));
        await api(`/api/customers/${clean}/addresses`,json("POST",{label:"住家",address_text:"QA address"}));
        await api(`/api/customers/${clean}`,json("PUT",{customer_name:marker+" corrected",customer_hp:"001"}));owners.find(o=>o.id===clean)!.name=marker+" corrected";
        const preview=await api<{pet_count:number;address_count:number;can_delete:boolean}>(`/api/customers/${clean}`);
        assert.deepEqual([preview.pet_count,preview.address_count,preview.can_delete],[2,1,true]);
        await expect(`/api/customers/${clean}`,json("DELETE",{expected_pet_count:0,expected_address_count:1}),409);
        await api(`/api/customers/${clean}`,json("DELETE",{expected_pet_count:2,expected_address_count:1}));owners.splice(owners.findIndex(o=>o.id===clean),1);
        assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM pet WHERE customer_id=$1",[clean])).rows[0].n,0);
        assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM customer_address WHERE customer_id=$1",[clean])).rows[0].n,0);
        const id=await owner(" history"),url=`/api/customers/${id}`;
        const pet=await api<{pet_id:string}>(url+"/pets",json("POST",{pet_name:"Bobby",pet_type:"金毛",pet_remark:"怕吹风"}));
        const unused=await api<{pet_id:string}>(url+"/pets",json("POST",{pet_name:"Typo",pet_type:"贵宾"}));
        await api(url+"/pets/"+unused.pet_id,json("PUT",{pet_name:"Corrected",pet_type:"混种",pet_remark:"QA"}));
        await api(url+"/pets/"+unused.pet_id,{method:"DELETE"});
        const address=await api<{address_id:string}>(url+"/addresses",json("POST",{label:"住家",map_url:"https://maps.apple.com/?q=QA"}));
        serviceId=(await api<{service_id:string}>("/api/services",json("POST",{service_name:marker,default_price:90,service_kind:"BASE"}))).service_id;
        const fee=(await api<Array<{travel_fee_option_id:string;label:string;amount:number|null}>>("/api/travel-fee-options")).find(f=>f.amount===5)!;
        const body={customer_id:id,appointment_date:"2099-07-01",start_time:"10:00",customer_address_id:address.address_id,travel_fee_option_id:fee.travel_fee_option_id,travel_fee_label:fee.label,travel_fee_amount:fee.amount,pets:[{pet_id:pet.pet_id,service_id:serviceId}]};
        const noAddress=await expect("/api/appointments",json("POST",{...body,customer_address_id:null}),400);assert.ok(noAddress.field_errors?.some(e=>e.field==="address"));
        const noBase=await expect("/api/appointments",json("POST",{...body,pets:[{pet_id:pet.pet_id},{pet_id:pet.pet_id}]}),400);assert.deepEqual(noBase.field_errors?.map(e=>e.field),["pets.0.service_id","pets.1.service_id"]);
        const booking=await api<{appointment_id:string}>("/api/appointments",json("POST",body));
        assert.equal((await expect(url,{method:"DELETE"},409)).code,"HAS_HISTORY");
        assert.equal((await expect(url+"/pets/"+pet.pet_id,{method:"DELETE"},409)).code,"HAS_HISTORY");
        await api(url+"/pets/"+pet.pet_id+"/archive",json("PATCH",{is_archived:true}));
        await expect("/api/appointments",json("POST",body),409);
        assert.ok(!(await api<Array<{pet_id:string}>>(url+"/pets")).some(p=>p.pet_id===pet.pet_id));
        assert.ok((await api<Array<{pet_id:string;is_archived:boolean}>>(url+"/pets?include_archived=true")).some(p=>p.pet_id===pet.pet_id&&p.is_archived));
        await api(url+"/archive",json("PATCH",{is_archived:true}));
        await expect("/api/appointments",json("POST",body),409);
        assert.ok(!(await api<Array<{customer_id:string}>>("/api/customers")).some(c=>c.customer_id===id));
        assert.ok((await api<Array<{customer_id:string;is_archived:boolean}>>("/api/customers?include_archived=true")).some(c=>c.customer_id===id&&c.is_archived));
        const before=await api<{customer_name:string;customer_is_archived:boolean;pets:Array<{appointment_pet_id:number;pet_id:number;service_id:number;is_archived:boolean;quoted_amount:number}>}>("/api/appointments/"+booking.appointment_id);
        assert.equal(before.customer_is_archived,true);assert.equal(before.pets[0].is_archived,true);assert.equal(before.pets[0].quoted_amount,90);
        await api("/api/appointments/"+booking.appointment_id,json("PATCH",{appointment_date:"2099-07-01",start_time:"11:00",pets:before.pets.map(p=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id}))}));
        await api("/api/appointments/"+booking.appointment_id+"/complete",json("PATCH",{pets:[{appointment_pet_id:before.pets[0].appointment_pet_id,amount:90}]}));
        const overview=await api<{customer:{is_archived:boolean;can_delete:boolean};total_spending:number}>(url+"/overview");assert.equal(overview.customer.is_archived,true);assert.equal(overview.customer.can_delete,false);assert.equal(overview.total_spending,95);
        const history=await api<{appointments:Array<{amount_due:number}>}>(url+"/appointments");assert.equal(history.appointments[0].amount_due,95);
        await api(url+"/archive",json("PATCH",{is_archived:false}));await api(url+"/pets/"+pet.pet_id+"/archive",json("PATCH",{is_archived:false}));
        const restored=await api<{appointment_id:string}>("/api/appointments",json("POST",body));await api("/api/appointments/"+restored.appointment_id+"/cancel",{method:"PATCH"});
        await expect(url,{method:"DELETE"},409);await expect(url+"/pets/"+pet.pet_id,{method:"DELETE"},409);
        // Legacy cross-owner references must also block cascading customer deletion.
        const other=await owner(" cross-reference"),otherPet=await api<{pet_id:string}>(`/api/customers/${other}/pets`,json("POST",{pet_name:"Legacy referenced pet"}));
        await pool.query("INSERT INTO appointment_pet(appointment_id,pet_id,service_id) VALUES($1,$2,$3)",[restored.appointment_id,otherPet.pet_id,serviceId]);
        await expect(`/api/customers/${other}`,{method:"DELETE"},409);
        // Hold the same SHARE locks as booking, then race a destructive request.
        // Deletion must wait and see the newly committed history, not delete it.
        for(const target of ["customer","pet"]){
            const race=await owner(" race "+target),racePet=await api<{pet_id:string}>(`/api/customers/${race}/pets`,json("POST",{pet_name:"Race pet"}));
            const client=await pool.connect();let pending:Promise<Response>|undefined;
            try {
                await client.query("BEGIN");await client.query("SELECT customer_id FROM customer WHERE customer_id=$1 FOR SHARE",[race]);
                await client.query("SELECT pet_id FROM pet WHERE pet_id=$1 FOR SHARE",[racePet.pet_id]);
                pending=fetch(baseUrl+`/api/customers/${race}`+(target==="pet"?`/pets/${racePet.pet_id}`:""),withSession(cookie,{method:"DELETE"}));
                const ap=(await client.query("INSERT INTO appointment(customer_id,appointment_date,start_time) VALUES($1,'2099-07-02','12:00') RETURNING appointment_id",[race])).rows[0].appointment_id;
                await client.query("INSERT INTO appointment_pet(appointment_id,pet_id,service_id) VALUES($1,$2,$3)",[ap,racePet.pet_id,serviceId]);
                await client.query("COMMIT");assert.equal((await pending).status,409);
                assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM appointment_pet WHERE appointment_id=$1",[ap])).rows[0].n,1);
            }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();if(pending)await pending;}
        }
        console.log("PASS: required-field errors, customer/pet edit/delete/archive/restore, all-status history and cross-owner FK preservation");
    } finally {
        const client=await pool.connect();try {await client.query("BEGIN");
            for(const o of owners){assert.equal((await client.query("SELECT customer_id FROM customer WHERE customer_id=$1 AND customer_name=$2 FOR UPDATE",[o.id,o.name])).rowCount,1);}
            // Remove own appointment dependencies for ALL owners before deleting pets.
            await client.query("DELETE FROM appointment WHERE customer_id=ANY($1::bigint[])",[owners.map(o=>o.id)]);
            for(const o of owners)await client.query("DELETE FROM customer WHERE customer_id=$1 AND customer_name=$2",[o.id,o.name]);
            if(serviceId)await client.query("DELETE FROM service WHERE service_id=$1 AND service_name=$2",[serviceId,marker]);
            await client.query("COMMIT");
        }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    }
}
