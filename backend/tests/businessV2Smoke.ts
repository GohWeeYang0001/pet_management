import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { baseUrl, withSession } from "./authFixture";
import { quotedPetAmount } from "../src/business/money";

interface Service { service_id: string; service_name: string; default_price: number; service_kind: "BASE"|"ADDON"; is_active: boolean }
interface Address { address_id: string; label: string; address_text: string|null; is_default: boolean; is_active: boolean; latitude: number|null; longitude: number|null; map_url: string|null }
interface Appointment {
    appointment_id: string; appointment_date: string; start_time: string; remark: string|null; status: string;
    amount_due: number|null; quoted_total: number|null; quoted_pet_total: number|null; pet_charges: number|null;
    travel_fee_amount: number|null; travel_fee_label: string|null;
    customer_address_id: string|null; address_text_snapshot: string|null; payment_tracking_started_at: string|null;
    address_label_snapshot: string|null; map_url_snapshot: string|null; latitude_snapshot: number|null; longitude_snapshot: number|null;
    pets: Array<{ appointment_pet_id: number; pet_id: number; service_id: number; service_name: string;
        service_name_snapshot: string|null; base_price_snapshot: number|null; quoted_amount: number|null; amount: number|null;
        addons: Array<{ service_id: number; service_name_snapshot: string; price_snapshot: number }> }>;
}

export async function runBusinessV2Workflow(cookie: string): Promise<void> {
    const marker="Business V2 QA "+randomUUID();
    const customers: Array<{id:string;name:string}>=[];
    const services: string[]=[];
    const options: string[]=[];
    interface Option { travel_fee_option_id:string;label:string;amount:number|null;is_active:boolean;sort_order:number }
    const optionUrl="/api/travel-fee-options";
    const json=(method:string,body:object):RequestInit=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    async function request<T>(url:string,init?:RequestInit):Promise<T> {
        const response=await fetch(baseUrl+url,withSession(cookie,init));
        if (!response.ok) throw new Error(url+" returned "+response.status+": "+await response.text());
        return response.json() as Promise<T>;
    }
    async function expect(url:string,init:RequestInit,status:number) {
        const response=await fetch(baseUrl+url,withSession(cookie,init));
        assert.equal(response.status,status,url+" "+await response.text());
    }
    async function catalog(name:string,price:number,kind:"BASE"|"ADDON"="BASE"):Promise<Service> {
        const value=await request<Service>("/api/services",json("POST",{service_name:marker+" "+name,default_price:price,service_kind:kind}));
        services.push(String(value.service_id)); return value;
    }
    async function update(service:Service,changes:Partial<Service>) {
        const value=await request<Service>("/api/services/"+service.service_id,json("PUT",{...service,...changes}));
        Object.assign(service,value);return value;
    }
    async function customer(suffix:string) {
        const name=marker+" "+suffix;
        const value=await request<{customer_id:string}>("/api/customers",json("POST",{customer_name:name,customer_hp:"000"}));
        customers.push({id:String(value.customer_id),name});return String(value.customer_id);
    }
    const detail=(id:string)=>request<Appointment>("/api/appointments/"+id);
    try {
        assert.equal(quotedPetAmount("0.10",["0.20"]),"0.30");
        assert.throws(()=>quotedPetAmount("1.001",[]));
        assert.throws(()=>quotedPetAmount("-1",[]));
        for (const url of ["/api/travel-fee-options","/api/customers/1/addresses","/api/customers/1/overview","/api/customers/1/appointments?limit=10&offset=0","/api/appointments/1"]) {
            assert.equal((await fetch(baseUrl+url)).status,401,"New APIs require authentication");
        }
        await expect("/api/payments",json("POST",{}),404); // No payment API in Phase 2.
        const owner=await customer("owner"), other=await customer("other");
        const dog=await request<{pet_id:string}>("/api/customers/"+owner+"/pets",json("POST",{pet_name:"QA Dog",pet_type:"金毛",pet_remark:"怕吹风、后腿敏感"}));
        const cat=await request<{pet_id:string}>("/api/customers/"+owner+"/pets",json("POST",{pet_name:"QA Cat",pet_type:"Cat"}));
        const unknown=await request<{pet_id:string}>("/api/customers/"+owner+"/pets",json("POST",{pet_name:"QA Unknown",pet_type:"Dog/Cat"}));
        const foreign=await request<{pet_id:string}>("/api/customers/"+other+"/pets",json("POST",{pet_name:"QA Other",pet_type:"Dog"}));
        const base=await catalog("base",100), dogBase=await catalog("dog base",70,"BASE");
        const catBase=await catalog("cat base",50,"BASE");
        const addonA=await catalog("addon A",4.10,"ADDON"),addonB=await catalog("addon B",5.20,"ADDON");
        const catAddon=await catalog("cat addon",2,"ADDON");
        const inactive=await catalog("inactive",1,"ADDON");await update(inactive,{is_active:false});
        const mutable=await catalog("unreferenced",1);await update(mutable,{service_kind:"ADDON"});
        assert.equal(mutable.service_kind,"ADDON");
        const legacyDefaults=await request<Service>("/api/services",json("POST",{service_name:marker+" defaults",default_price:1}));
        services.push(String(legacyDefaults.service_id));assert.equal(legacyDefaults.service_kind,"BASE");assert.ok(!("pet_type" in legacyDefaults));
        for (const change of [{service_kind:"OTHER"},{default_price:1.234},{default_price:-1},{default_price:100000000},{default_price:"1.00"}]) {
            await expect("/api/services",json("POST",{service_name:marker+" invalid",default_price:1,...change}),400);
            await expect("/api/services/"+base.service_id,json("PUT",{...base,...change}),400);
        }
        assert.ok(!(await request<Service[]>("/api/services")).some(s=>String(s.service_id)===String(inactive.service_id)));
        assert.ok((await request<Service[]>("/api/services?include_inactive=true")).some(s=>String(s.service_id)===String(inactive.service_id)));
        assert.ok((await request<Service[]>("/api/services?service_kind=ADDON")).every(s=>s.service_kind==="ADDON"));
        await expect("/api/services?service_kind=other",{method:"GET"},400);
        const defaultTravel=await request<Option>(optionUrl,json("POST",{label:marker+" explicit zero",amount:0,is_active:true,sort_order:999}));
        options.push(String(defaultTravel.travel_fee_option_id));
        const normal={travel_fee_option_id:defaultTravel.travel_fee_option_id,travel_fee_label:defaultTravel.label,travel_fee_amount:0,customer_id:owner,appointment_date:"2099-05-01",start_time:"10:00",remark:marker,
            pets:[{pet_id:dog.pet_id,service_id:base.service_id}]};
        await expect("/api/appointments/9223372036854775807",{method:"GET"},404);
        await expect("/api/appointments/not-an-id",{method:"GET"},400);
        for (const row of [
            {pet_id:dog.pet_id,service_id:"9223372036854775807"},
            {pet_id:foreign.pet_id,service_id:base.service_id},
            {pet_id:dog.pet_id,service_id:addonA.service_id},
            {pet_id:dog.pet_id,service_id:base.service_id,addons:[{service_id:base.service_id}]},
            {pet_id:dog.pet_id,service_id:base.service_id,addons:[{service_id:inactive.service_id}]},
            {pet_id:dog.pet_id,service_id:base.service_id,addons:[{service_id:addonA.service_id},{service_id:Number(addonA.service_id)}]},
            {pet_id:dog.pet_id,service_id:base.service_id,addons:[{service_id:"9223372036854775808"}]},
        ]) await expect("/api/appointments",json("POST",{...normal,pets:[row]}),400);
        const unknownAppointment=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,pets:[{pet_id:unknown.pet_id,service_id:base.service_id}]}));
        assert.equal((await detail(unknownAppointment.appointment_id)).pets.length,1);
        const savedPets=await request<Array<{pet_id:string;pet_type:string;pet_remark:string}>>("/api/customers/"+owner+"/pets");
        assert.equal(savedPets.find(p=>String(p.pet_id)===String(dog.pet_id))?.pet_type,"金毛");
        assert.equal(savedPets.find(p=>String(p.pet_id)===String(dog.pet_id))?.pet_remark,"怕吹风、后腿敏感");
        for (const selected of [base,dogBase,catBase]) {
            const allowed=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,
                pets:[{pet_id:dog.pet_id,service_id:selected.service_id,addons:[{service_id:addonA.service_id},{service_id:addonB.service_id},{service_id:catAddon.service_id}]}]}));
            assert.equal((await detail(allowed.appointment_id)).pets[0].addons.length,3);
        }
        const addressUrl="/api/customers/"+owner+"/addresses";
        const home=await request<Address>(addressUrl,json("POST",{label:"Home",address_text:"Original address",
            map_url:"https://maps.example.invalid/qa",latitude:3.123456,longitude:101.123456}));
        assert.equal(home.is_default,true);
        const work=await request<Address>(addressUrl,json("POST",{label:"Work",address_text:"Work address"}));
        assert.equal(work.is_default,false);
        assert.equal(work.map_url,null);assert.equal(work.latitude,null);assert.equal(work.longitude,null);
        // Labels remain free text; a location can be supplied in any usable combination.
        const mapOnly=await request<Address>(addressUrl,json("POST",{label:"住家",address_text:null,
            map_url:"  https://maps.apple.com/?q=QA  "}));
        assert.equal(mapOnly.address_text,null);assert.equal(mapOnly.map_url,"https://maps.apple.com/?q=QA");
        const coordinatesOnly=await request<Address>(addressUrl,json("POST",{label:"Coordinates",latitude:0,longitude:0}));
        assert.equal(coordinatesOnly.address_text,null);assert.equal(coordinatesOnly.map_url,null);
        assert.equal(coordinatesOnly.latitude,0);assert.equal(coordinatesOnly.longitude,0);
        for (const location of [
            {address_text:"  Text and map  ",map_url:"https://maps.google.com/?q=QA"},
            {address_text:"Text and coordinates",latitude:-90,longitude:-180},
            {map_url:"http://location.example.invalid/whatsapp",latitude:90,longitude:180},
            {address_text:" \t\n",map_url:"https://location.example.invalid/qa"},
            {address_text:"",map_url:" \t\n",latitude:1,longitude:2},
        ]) {
            const value=await request<Address>(addressUrl,json("POST",{label:"其他",...location}));
            assert.equal(value.address_text,location.address_text?.trim() || null);
            assert.equal(value.map_url,location.map_url?.trim() || null);
        }
        for (const location of [
            {},{address_text:null,map_url:null},{address_text:" \t\n",map_url:" \t\n"},
            {address_text:" \t\n"},{map_url:" \t\n"},{latitude:1},{longitude:1},
            {latitude:91,longitude:1},{latitude:1,longitude:-181},
            {address_text:123},{map_url:123},{map_url:"ftp://example.invalid/location"},
        ]) await expect(addressUrl,json("POST",{label:"Empty or invalid",...location}),400);
        const mapBooking=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,customer_address_id:mapOnly.address_id}));
        const mapSnapshot=await detail(mapBooking.appointment_id);
        assert.equal(mapSnapshot.address_text_snapshot,null);assert.equal(mapSnapshot.address_label_snapshot,"住家");
        assert.equal(mapSnapshot.map_url_snapshot,mapOnly.map_url);assert.equal(mapSnapshot.latitude_snapshot,null);
        await expect(addressUrl+"/"+mapOnly.address_id,json("PUT",{label:"住家",map_url:" \t\n",address_text:null,
            latitude:null,longitude:null,is_default:true}),400);
        assert.equal((await request<Address[]>(addressUrl)).find(a=>String(a.address_id)===String(mapOnly.address_id))?.map_url,mapOnly.map_url);
        await expect(addressUrl+"/"+coordinatesOnly.address_id,json("PUT",{label:"Coordinates",latitude:1}),400);
        await expect(addressUrl+"/"+coordinatesOnly.address_id,json("PUT",{label:"Coordinates",longitude:1}),400);
        const clearedCoordinates=await request<Address>(addressUrl+"/"+coordinatesOnly.address_id,json("PUT",{
            label:"Text now",address_text:"Replacement text",latitude:null,longitude:null}));
        assert.equal(clearedCoordinates.latitude,null);assert.equal(clearedCoordinates.longitude,null);
        await request<Address>(addressUrl+"/"+mapOnly.address_id,json("PUT",{label:"Map changed",map_url:"https://location.example.invalid/changed",
            address_text:"Text added later",is_active:false}));
        const mapEdit={appointment_date:mapSnapshot.appointment_date,start_time:"10:30",customer_address_id:mapOnly.address_id,
            pets:mapSnapshot.pets.map(p=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id}))};
        await request("/api/appointments/"+mapSnapshot.appointment_id,json("PATCH",mapEdit));
        const stableMapSnapshot=await detail(mapSnapshot.appointment_id);
        for (const key of ["customer_address_id","address_label_snapshot","address_text_snapshot","map_url_snapshot","latitude_snapshot","longitude_snapshot"] as const) {
            assert.equal(stableMapSnapshot[key],mapSnapshot[key],"Map-only snapshot must remain stable: "+key);
        }
        await expect("/api/appointments",json("POST",{...normal,customer_address_id:mapOnly.address_id}),400);
        const mapWithoutText=await request<Address>(addressUrl,json("POST",{label:"Map retained",map_url:"https://location.example.invalid/retain"}));
        const deactivatedMap=await request<Address>(addressUrl+"/"+mapWithoutText.address_id,json("PUT",{label:"Map retained",is_active:false}));
        assert.equal(deactivatedMap.address_text,null);assert.equal(deactivatedMap.map_url,mapWithoutText.map_url);
        assert.equal(deactivatedMap.is_default,false);
        await request(addressUrl+"/"+work.address_id,json("PUT",{label:"Work",address_text:"Work address",is_default:true}));
        let addresses=await request<Address[]>(addressUrl);
        assert.equal(addresses.filter(a=>a.is_active&&a.is_default).length,1);
        assert.equal(addresses.find(a=>String(a.address_id)===String(work.address_id))?.is_default,true);
        // Two concurrent requests selecting a default serialize on their customer.
        await Promise.all([
            request(addressUrl+"/"+home.address_id,json("PUT",{label:"Home",address_text:"Original address",is_default:true})),
            request(addressUrl+"/"+work.address_id,json("PUT",{label:"Work",address_text:"Work address",is_default:true})),
        ]);
        assert.equal((await request<Address[]>(addressUrl)).filter(a=>a.is_active&&a.is_default).length,1);
        const foreignAddress=await request<Address>("/api/customers/"+other+"/addresses",json("POST",{label:"Other",address_text:"Other address"}));
        const concurrentOwner=await customer("concurrent addresses");
        const concurrentAddressUrl="/api/customers/"+concurrentOwner+"/addresses";
        await Promise.all([
            request<Address>(concurrentAddressUrl,json("POST",{label:"First A",address_text:"Address A"})),
            request<Address>(concurrentAddressUrl,json("POST",{label:"First B",address_text:"Address B"})),
        ]);
        assert.equal((await request<Address[]>(concurrentAddressUrl)).filter(a=>a.is_active&&a.is_default).length,1);
        await expect(addressUrl+"/"+foreignAddress.address_id,json("PUT",{label:"Wrong owner",address_text:"Wrong"}),404);
        await expect("/api/customers/9223372036854775807/addresses",json("POST",{label:"Missing",address_text:"Missing"}),404);
        for (const change of [{latitude:1},{longitude:1},{latitude:91,longitude:1},{latitude:1,longitude:181},{latitude:"1",longitude:1},
            {address_text:""},{label:""},{map_url:"javascript:alert(1)"},{map_url:"https://user:secret@example.invalid"},
            {label:"x".repeat(101)},{address_text:"x".repeat(4001)},{is_default:"true"}]) {
            await expect(addressUrl,json("POST",{label:"Invalid",address_text:"Address",...change}),400);
        }
        await expect("/api/appointments",json("POST",{...normal,customer_address_id:foreignAddress.address_id}),400);
        const travelOptions=await request<Option[]>(optionUrl);
        const official=["5公里以内","5–7公里","7–10公里","10–15公里","15公里以上"].map(label=>travelOptions.find(o=>o.label===label)!);
        assert.ok(official.every(Boolean));assert.deepEqual(official.map(o=>o.amount),[2,5,10,20,null]);
        assert.ok(!official.some(o=>o.amount===15));
        for (let i=1;i<travelOptions.length;i++) assert.ok(travelOptions[i-1].sort_order<=travelOptions[i].sort_order);
        for (const change of [
            {travel_fee_option_id:undefined,travel_fee_label:undefined,travel_fee_amount:undefined},
            {travel_fee_option_id:null,travel_fee_label:null,travel_fee_amount:null},
            {travel_fee_option_id:undefined},{travel_fee_label:null},{travel_fee_amount:null},
            {travel_fee_option_id:"9223372036854775807"},{travel_fee_label:"fabricated label"},
        ]) await expect("/api/appointments",json("POST",{...normal,...change}),400);
        for (const option of official.slice(0,4)) {
            const booked=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,travel_fee_option_id:option.travel_fee_option_id,travel_fee_label:option.label,travel_fee_amount:option.amount}));
            const value=await detail(booked.appointment_id);
            assert.equal(value.travel_fee_amount,option.amount);assert.equal(value.travel_fee_label,option.label);
            assert.ok(!("travel_fee_option_id" in value));
        }
        for (const amount of [-1,1.234,100000000,"2",null]) await expect("/api/appointments",json("POST",{...normal,travel_fee_option_id:official[4].travel_fee_option_id,travel_fee_label:"15公里以上",travel_fee_amount:amount}),400);
        await expect("/api/appointments",json("POST",{...normal,travel_fee_option_id:official[4].travel_fee_option_id,travel_fee_label:"15公里以上",travel_fee_amount:undefined}),400);
        const manualCharge=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,
            travel_fee_option_id:official[4].travel_fee_option_id,travel_fee_label:"15公里以上",travel_fee_amount:27.35,travel_fee_note:"Agreed manual fee"}));
        let manualAppointment=await detail(manualCharge.appointment_id);
        assert.equal(manualAppointment.travel_fee_amount,27.35);assert.equal(manualAppointment.quoted_total,127.35);
        const manualEdit={appointment_date:manualAppointment.appointment_date,start_time:"10:15",
            pets:manualAppointment.pets.map(p=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id}))};
        await expect("/api/appointments/"+manualAppointment.appointment_id,json("PATCH",{...manualEdit,travel_fee_amount:1.234}),400);
        await request("/api/appointments/"+manualAppointment.appointment_id,json("PATCH",{...manualEdit,travel_fee_option_id:official[4].travel_fee_option_id,travel_fee_label:official[4].label,travel_fee_amount:30.10}));
        manualAppointment=await detail(manualAppointment.appointment_id);assert.equal(manualAppointment.quoted_total,130.10);
        await expect("/api/appointments/"+manualAppointment.appointment_id,json("PATCH",{...manualEdit,travel_fee_label:null,travel_fee_amount:null}),400);
        assert.equal((await detail(manualAppointment.appointment_id)).travel_fee_amount,30.10);
        await expect("/api/appointments",json("POST",{...normal,travel_fee_amount:5}),400);
        async function createOption(amount:number|null,suffix:string) {
            const option=await request<Option>(optionUrl,json("POST",{label:marker+" "+suffix,amount,is_active:true,sort_order:999}));
            options.push(String(option.travel_fee_option_id));return option;
        }
        for (const input of [{label:"",amount:1},{label:marker,amount:-1},{label:marker,amount:1.234},{label:marker,amount:"1"},{label:marker,amount:1,sort_order:-1}]) {
            await expect(optionUrl,json("POST",input),400);
        }
        const free=await createOption(0,"免交通费");
        const freeBooking=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,travel_fee_option_id:free.travel_fee_option_id,travel_fee_label:free.label,travel_fee_amount:free.amount}));
        assert.equal((await detail(freeBooking.appointment_id)).travel_fee_amount,0);
        assert.equal((await detail(freeBooking.appointment_id)).travel_fee_label,free.label);
        const custom=await createOption(null,"manual");
        assert.equal(custom.amount,null);
        const local=await createOption(3,"configurable");
        const historicalOption=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,travel_fee_option_id:local.travel_fee_option_id,travel_fee_label:local.label,travel_fee_amount:local.amount}));
        const repriced=await request<Option>(optionUrl+"/"+local.travel_fee_option_id,json("PUT",{label:local.label,amount:9,is_active:true,sort_order:1000}));
        const newPricedBooking=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,travel_fee_option_id:repriced.travel_fee_option_id,travel_fee_label:repriced.label,travel_fee_amount:repriced.amount}));
        assert.equal((await detail(newPricedBooking.appointment_id)).travel_fee_amount,9);
        assert.equal((await detail(historicalOption.appointment_id)).travel_fee_amount,3);
        await request(optionUrl+"/"+local.travel_fee_option_id,json("PUT",{label:local.label,amount:9,is_active:false,sort_order:1000}));
        assert.ok(!(await request<Option[]>(optionUrl)).some(o=>o.travel_fee_option_id===local.travel_fee_option_id));
        assert.ok((await request<Option[]>(optionUrl+"?include_inactive=true")).some(o=>o.travel_fee_option_id===local.travel_fee_option_id && o.amount===9));
        await expect("/api/appointments",json("POST",{...normal,travel_fee_option_id:local.travel_fee_option_id,travel_fee_label:local.label,travel_fee_amount:9}),400);
        await expect("/api/appointments",json("POST",{...normal,travel_fee_option_id:official[1].travel_fee_option_id,travel_fee_label:official[1].label,travel_fee_amount:6}),400);
        let historic=await detail(historicalOption.appointment_id);
        await request("/api/appointments/"+historic.appointment_id,json("PATCH",{appointment_date:historic.appointment_date,start_time:"10:15",pets:historic.pets.map(p=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id})),travel_fee_note:"note only"}));
        historic=await detail(historic.appointment_id);assert.equal(historic.travel_fee_amount,3);assert.equal(historic.travel_fee_label,local.label);
        // COMPLETED is service completion, independent of any payment record.
        const ninety=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,travel_fee_option_id:official[1].travel_fee_option_id,travel_fee_label:"5–7公里",travel_fee_amount:5}));
        const ninetyDetail=await detail(ninety.appointment_id);
        await request("/api/appointments/"+ninety.appointment_id+"/complete",json("PATCH",{pets:[{appointment_pet_id:ninetyDetail.pets[0].appointment_pet_id,amount:90}]}));
        assert.equal((await detail(ninety.appointment_id)).amount_due,95);
        const created=await request<{appointment_id:string}>("/api/appointments",json("POST",{
            ...normal,customer_address_id:home.address_id,travel_fee_option_id:official[3].travel_fee_option_id,travel_fee_label:official[3].label,travel_fee_amount:official[3].amount,
            pets:[{pet_id:dog.pet_id,service_id:base.service_id,addons:[{service_id:addonA.service_id},{service_id:addonB.service_id}]},
                {pet_id:dog.pet_id,service_id:dogBase.service_id}],
        }));
        let appointment=await detail(created.appointment_id);
        assert.equal(appointment.pets[0].quoted_amount,109.30);assert.equal(appointment.pets[1].quoted_amount,70);
        assert.equal(appointment.quoted_pet_total,179.30);assert.equal(appointment.quoted_total,199.30);
        assert.equal(appointment.amount_due,null);assert.equal(appointment.travel_fee_amount,20);
        assert.equal(appointment.address_label_snapshot,"Home");assert.equal(appointment.map_url_snapshot,home.map_url);
        assert.equal(appointment.latitude_snapshot,3.123456);assert.equal(appointment.longitude_snapshot,101.123456);
        assert.ok(appointment.pets.every(p=>p.amount===null));assert.equal(appointment.pets[0].base_price_snapshot,100);
        assert.equal(appointment.pets[0].service_name_snapshot,base.service_name);assert.deepEqual(appointment.pets[0].addons.map(a=>a.price_snapshot),[4.10,5.20]);
        assert.deepEqual(appointment.pets[0].addons.map(a=>a.service_name_snapshot),[addonA.service_name,addonB.service_name]);
        const listed=await request<Appointment[]>("/api/appointments");
        assert.deepEqual(listed.find(a=>String(a.appointment_id)===String(appointment.appointment_id)),appointment);
        await expect("/api/services/"+base.service_id,json("PUT",{...base,service_kind:"ADDON"}),409);
        await expect("/api/services/"+addonA.service_id,json("PUT",{...addonA,service_kind:"BASE"}),409);
        await request(addressUrl+"/"+home.address_id,json("PUT",{label:"Home changed",address_text:"Changed address",is_active:false}));
        const deactivated=(await request<Address[]>(addressUrl)).find(a=>String(a.address_id)===String(home.address_id))!;
        assert.equal(deactivated.is_default,false);assert.equal(deactivated.latitude,3.123456);assert.equal(deactivated.longitude,101.123456);
        assert.equal((await detail(appointment.appointment_id)).address_text_snapshot,"Original address");
        await expect("/api/appointments",json("POST",{...normal,customer_address_id:home.address_id}),400);
        function editBody(value:Appointment) {
            return {appointment_date:value.appointment_date,start_time:"11:00",remark:marker,
                pets:value.pets.map(p=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id}))};
        }
        await request("/api/appointments/"+appointment.appointment_id,json("PATCH",{...editBody(appointment),customer_address_id:home.address_id}));
        appointment=await detail(appointment.appointment_id);
        assert.equal(appointment.address_text_snapshot,"Original address");assert.equal(appointment.pets[0].addons.length,2);
        assert.equal(appointment.address_label_snapshot,"Home");assert.equal(appointment.map_url_snapshot,home.map_url);
        await request("/api/appointments/"+appointment.appointment_id,json("PATCH",{...editBody(appointment),customer_address_id:work.address_id}));
        appointment=await detail(appointment.appointment_id);assert.equal(appointment.address_text_snapshot,"Work address");
        assert.equal(appointment.address_label_snapshot,"Work");assert.equal(appointment.latitude_snapshot,null);
        await update(base,{service_name:marker+" base repriced",default_price:110,is_active:false});
        await update(addonA,{service_name:marker+" addon repriced",default_price:6.10,is_active:false});
        const unchangedSnapshots=await detail(appointment.appointment_id);
        assert.equal(unchangedSnapshots.pets[0].quoted_amount,109.30);
        assert.equal(unchangedSnapshots.pets[0].base_price_snapshot,100);
        assert.deepEqual(unchangedSnapshots.pets[0].addons.map(a=>a.price_snapshot),[4.10,5.20]);
        // Grandfather unchanged selections on the same pet; refresh their quotes.
        await request("/api/appointments/"+appointment.appointment_id,json("PATCH",editBody(appointment)));
        appointment=await detail(appointment.appointment_id);
        assert.equal(appointment.pets[0].quoted_amount,121.30);assert.equal(appointment.pets[0].service_name,base.service_name);
        await expect("/api/appointments",json("POST",normal),400);
        await expect("/api/appointments/"+appointment.appointment_id,json("PATCH",{...editBody(appointment),pets:appointment.pets.map((p,i)=>({appointment_pet_id:p.appointment_pet_id,pet_id:i===0?cat.pet_id:p.pet_id,service_id:p.service_id}))}),400);
        await request("/api/appointments/"+appointment.appointment_id,json("PATCH",{...editBody(appointment),customer_address_id:null,
            pets:appointment.pets.map((p,i)=>({appointment_pet_id:p.appointment_pet_id,pet_id:p.pet_id,service_id:p.service_id,addons:i===0?[{service_id:addonB.service_id}]:[]}))}));
        appointment=await detail(appointment.appointment_id);
        assert.equal(appointment.pets[0].quoted_amount,115.20);assert.equal(appointment.quoted_total,205.20);
        assert.equal(appointment.customer_address_id,null);assert.equal(appointment.address_text_snapshot,null);
        assert.equal(appointment.address_label_snapshot,null);assert.equal(appointment.map_url_snapshot,null);
        assert.equal(appointment.latitude_snapshot,null);assert.equal(appointment.longitude_snapshot,null);
        assert.equal(appointment.travel_fee_amount,20);
        const beforeCompletion=JSON.stringify(appointment.pets.map(p=>p.addons));
        const baseline=await request<{revenue:number}>("/api/reports/monthly?month=2099-05");
        const payload={pets:appointment.pets.map((p,i)=>({appointment_pet_id:p.appointment_pet_id,amount:i===0?120.29:50,remark:null}))};
        await expect("/api/appointments/"+appointment.appointment_id+"/complete",json("PATCH",{pets:payload.pets.map(p=>({...p,amount:1.234}))}),400);
        await expect("/api/appointments/"+appointment.appointment_id+"/complete",json("PATCH",{pets:[payload.pets[0]]}),400);
        assert.equal((await detail(appointment.appointment_id)).status,"CONFIRMED");
        await request("/api/appointments/"+appointment.appointment_id+"/complete",json("PATCH",payload));
        const completed=await detail(appointment.appointment_id);
        assert.equal(completed.pet_charges,170.29);assert.equal(completed.amount_due,190.29);
        assert.equal(completed.quoted_total,null);assert.ok(completed.payment_tracking_started_at);
        assert.equal(JSON.stringify(completed.pets.map(p=>p.addons)),beforeCompletion);
        await update(addonB,{service_name:marker+" addon after completion",default_price:9.99});
        assert.equal(JSON.stringify((await detail(completed.appointment_id)).pets.map(p=>p.addons)),beforeCompletion);
        await expect("/api/appointments/"+completed.appointment_id,json("PATCH",editBody(completed)),409);
        await expect("/api/appointments/"+completed.appointment_id+"/complete",json("PATCH",payload),409);
        const after=await request<{revenue:number}>("/api/reports/monthly?month=2099-05");
        assert.ok(Math.abs(after.revenue-baseline.revenue-190.29)<0.00001);
        const overview=await request<{total_spending:number}>("/api/customers/"+owner+"/overview");
        assert.equal(overview.total_spending,285.29);
        assert.ok(!("appointment_history" in overview),"Overview must not include detailed history");
        interface HistoryPage {appointments:Appointment[];has_more:boolean;next_offset:number|null;limit:number;offset:number}
        const first=await request<HistoryPage>("/api/customers/"+owner+"/appointments?limit=10&offset=0");
        assert.equal(first.appointments.length,10);assert.equal(first.has_more,true);
        const history=[...first.appointments];let nextOffset=first.next_offset;
        while (nextOffset !== null) {
            const page=await request<HistoryPage>("/api/customers/"+owner+"/appointments?limit=10&offset="+nextOffset);
            assert.ok(page.appointments.length<=10);history.push(...page.appointments);nextOffset=page.next_offset;
        }
        assert.equal(new Set(history.map(entry=>String(entry.appointment_id))).size,history.length);
        assert.equal(history.find(entry=>String(entry.appointment_id)===String(completed.appointment_id))?.amount_due,190.29);
        assert.equal(history.find(entry=>String(entry.appointment_id)===String(ninety.appointment_id))?.amount_due,95);
        assert.deepEqual((await request<HistoryPage>("/api/customers/"+other+"/appointments")).appointments,[]);
        for (const query of ["limit=0","limit=21","limit=1.2","limit=abc","offset=-1","offset=1.2","offset=2147483648"]) {
            await expect("/api/customers/"+owner+"/appointments?"+query,{method:"GET"},400);
        }
        await expect("/api/customers/9223372036854775807/appointments",{method:"GET"},404);
        // Legacy completed rows remain untracked and use catalog-name fallback.
        const old=(await pool.query("INSERT INTO appointment(customer_id,appointment_date,start_time,status,remark) VALUES($1,'2099-05-02','12:00','COMPLETED',$2) RETURNING appointment_id",[owner,marker])).rows[0].appointment_id;
        await pool.query("INSERT INTO appointment_pet(appointment_id,pet_id,service_id,amount) VALUES($1,$2,$3,12.34)",[old,dog.pet_id,dogBase.service_id]);
        const legacy=await detail(old);
        assert.equal(legacy.pets[0].service_name_snapshot,null);assert.equal(legacy.pets[0].service_name,dogBase.service_name);
        assert.equal(legacy.payment_tracking_started_at,null);assert.equal(legacy.amount_due,12.34);assert.equal(legacy.pets[0].quoted_amount,null);
        assert.equal(legacy.travel_fee_amount,null);
        const oldConfirmed=(await pool.query("INSERT INTO appointment(customer_id,appointment_date,start_time,remark) VALUES($1,'2099-05-03','12:00',$2) RETURNING appointment_id",[owner,marker])).rows[0].appointment_id;
        await pool.query("INSERT INTO appointment_pet(appointment_id,pet_id,service_id) VALUES($1,$2,$3)",[oldConfirmed,dog.pet_id,dogBase.service_id]);
        const legacyBody={appointment_date:"2099-05-03",start_time:"12:30",pets:[{pet_id:dog.pet_id,service_id:dogBase.service_id}]};
        await expect("/api/appointments/"+oldConfirmed,json("PATCH",legacyBody),400);
        await request("/api/appointments/"+oldConfirmed,json("PATCH",{...legacyBody,travel_fee_option_id:defaultTravel.travel_fee_option_id,travel_fee_label:defaultTravel.label,travel_fee_amount:0}));
        assert.equal((await detail(oldConfirmed)).travel_fee_amount,0);
        assert.ok(Math.abs((await request<{revenue:number}>("/api/reports/monthly?month=2099-05")).revenue-after.revenue-12.34)<0.00001);
        assert.equal((await request<{total_spending:number}>("/api/customers/"+owner+"/overview")).total_spending,297.63);
        const legacyQuote=(await pool.query("INSERT INTO appointment(customer_id,appointment_date,start_time,remark) VALUES($1,'2099-05-02','13:00',$2) RETURNING appointment_id",[owner,marker])).rows[0].appointment_id;
        await pool.query("INSERT INTO appointment_pet(appointment_id,pet_id,service_id) VALUES($1,$2,$3)",[legacyQuote,cat.pet_id,catBase.service_id]);
        assert.equal((await detail(legacyQuote)).quoted_total,null);
        const nullable=(await pool.query("INSERT INTO service(service_name,default_price) VALUES($1,NULL) RETURNING service_id",[marker+" null price"])).rows[0].service_id;
        services.push(String(nullable));
        const nullQuote=await request<{appointment_id:string}>("/api/appointments",json("POST",{...normal,pets:[{pet_id:dog.pet_id,service_id:nullable}]}));
        const unknownQuote=await detail(nullQuote.appointment_id);assert.equal(unknownQuote.quoted_total,null);assert.equal(unknownQuote.pets[0].base_price_snapshot,null);
        const huge=await catalog("max price",99999999.99),penny=await catalog("penny",0.01,"ADDON");
        await expect("/api/appointments",json("POST",{...normal,pets:[{pet_id:dog.pet_id,service_id:huge.service_id,addons:[{service_id:penny.service_id}]}]}),400);
        const raceService=await catalog("kind race",1);
        const results=await Promise.all([
            fetch(baseUrl+"/api/appointments",withSession(cookie,json("POST",{...normal,pets:[{pet_id:dog.pet_id,service_id:raceService.service_id}]}))),
            fetch(baseUrl+"/api/services/"+raceService.service_id,withSession(cookie,json("PUT",{...raceService,service_kind:"ADDON"}))),
        ]);
        assert.ok((results[0].status===201&&results[1].status===409)||(results[0].status===400&&results[1].status===200),
            "Catalog kind change and booking must serialize safely");
        assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM payment p JOIN appointment a USING(appointment_id) WHERE a.customer_id=ANY($1::bigint[])",[customers.map(c=>c.id)])).rows[0].n,0);
        console.log("PASS: Business V2 service eligibility/kind locking, quote snapshots/addons, precision, canonical totals, address/default concurrency, nullable configurable travel options, completion tracking, legacy revenue and no payment endpoints");
    } finally {
        const client=await pool.connect();
        try {
            await client.query("BEGIN");
            for (const customer of customers) {
                const found=await client.query("SELECT customer_id FROM customer WHERE customer_id=$1 AND customer_name=$2 FOR UPDATE",[customer.id,customer.name]);
                assert.equal(found.rowCount,1,"QA customer marker mismatch; cleanup stopped");
                await client.query("DELETE FROM appointment WHERE customer_id=$1",[customer.id]);
                await client.query("DELETE FROM customer WHERE customer_id=$1 AND customer_name=$2",[customer.id,customer.name]);
            }
            for (const id of services) {
                const found=await client.query("SELECT service_id FROM service WHERE service_id=$1 AND service_name LIKE $2 FOR UPDATE",[id,marker+"%"]);
                assert.equal(found.rowCount,1,"QA service marker mismatch; cleanup stopped");
                await client.query("DELETE FROM service WHERE service_id=$1",[id]);
            }
            for (const id of options) {
                const found=await client.query("SELECT travel_fee_option_id FROM travel_fee_option WHERE travel_fee_option_id=$1 AND label LIKE $2 FOR UPDATE",[id,marker+"%"]);
                assert.equal(found.rowCount,1,"QA option marker mismatch; cleanup stopped");
                await client.query("DELETE FROM travel_fee_option WHERE travel_fee_option_id=$1",[id]);
            }
            await client.query("COMMIT");console.log("PASS: only Business V2 QA fixture records removed");
        } catch (error) { await client.query("ROLLBACK");throw error; }
        finally { client.release(); }
    }
}
