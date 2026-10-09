// Browser QA only: loopback servers and disposable in-memory fixtures. No DB or real API.
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const today = new Date().toLocaleDateString('en-CA');
let nextId = 100;
const writes = [];
const reads = [];
const customers = [
    { customer_id:'1',customer_name:'QA 多宠客户',customer_hp:'0100000001',pet_count:2 },
    { customer_id:'2',customer_name:'QA 无地址客户',customer_hp:'0100000002',pet_count:1 },
    { customer_id:'3',customer_name:'QA 旧预约客户',customer_hp:'0100000003',pet_count:1 },
];
const pets = [
    { pet_id:'1',customer_id:'1',pet_name:'Bobby',pet_type:'金毛',pet_remark:null },
    { pet_id:'2',customer_id:'1',pet_name:'Kitty',pet_type:'英短',pet_remark:null },
    { pet_id:'3',customer_id:'2',pet_name:'Legacy',pet_type:'未知',pet_remark:null },
    { pet_id:'4',customer_id:'3',pet_name:'Legacy',pet_type:'混种',pet_remark:null },
];
const services = [
    ['1','狗狗洗护',70,'BASE'],['2','猫咪洗护',45,'BASE'],['3','通用护理',30,'BASE'],
    ['4','头部造型',10,'ADDON'],['5','身体造型',10,'ADDON'],['6','猫咪梳毛',5,'ADDON'],
    ['7','旧狗狗加购',8,'ADDON',false],
].map(([service_id,service_name,default_price,service_kind,is_active=true]) =>
    ({service_id,service_name,default_price,service_kind,is_active}));
const options = [
    ['1','5公里以内',2],['2','5–7公里',5],['3','7–10公里',10],['4','10–15公里',20],['5','15公里以上',null],
].map(([travel_fee_option_id,label,amount],sort_order)=>({travel_fee_option_id,label,amount,is_active:true,sort_order}));
const addresses = [
    { address_id:'1',customer_id:'1',label:'住家',address_text:'123 Jalan Example, Muar',map_url:null,latitude:null,longitude:null,is_default:true,is_active:true },
    { address_id:'2',customer_id:'1',label:'公司',address_text:null,map_url:'https://maps.apple.com/?q=Muar',latitude:null,longitude:null,is_default:false,is_active:true },
];
function petSnapshot(row) {
    const pet = pets.find(p => p.pet_id === String(row.pet_id));
    const base = services.find(s => s.service_id === String(row.service_id));
    const addons = (row.addons ?? []).map(item => {
        const service = services.find(s => s.service_id === String(item.service_id));
        return { appointment_pet_addon_id:nextId++,service_id:Number(service.service_id),service_name_snapshot:service.service_name,price_snapshot:service.default_price };
    });
    return { is_archived:pet.is_archived??false,appointment_pet_id:row.appointment_pet_id ?? nextId++,pet_id:Number(pet.pet_id),pet_name:pet.pet_name,pet_type:pet.pet_type,
        service_id:Number(base.service_id),service_name:base.service_name,default_price:base.default_price,service_name_snapshot:base.service_name,
        base_price_snapshot:base.default_price,quoted_amount:base.default_price + addons.reduce((sum,a) => sum+a.price_snapshot,0),addons,amount:null,remark:row.remark ?? null };
}
function totals(appointment) {
    appointment.quoted_total = appointment.pets.some(p => p.quoted_amount == null) ? null
        : appointment.pets.reduce((sum,p) => sum+p.quoted_amount,appointment.travel_fee_amount ?? 0);
    appointment.amount_due = appointment.status === 'COMPLETED'
        ? appointment.pets.reduce((sum,p) => sum+(p.amount ?? 0),appointment.travel_fee_amount ?? 0) : null;
    return appointment;
}
const appointments = [totals({ appointment_id:'1',appointment_date:today,start_time:'10:00:00',status:'CONFIRMED',remark:'QA 快照',customer_id:'1',customer_name:customers[0].customer_name,customer_hp:customers[0].customer_hp,
    customer_address_id:'1',address_label_snapshot:'原住家',address_text_snapshot:'旧地址快照',map_url_snapshot:null,travel_fee_label:'7–10公里',travel_fee_amount:10,travel_fee_note:null,
    pets:[petSnapshot({ pet_id:'1',service_id:'1',addons:[{service_id:'4'},{service_id:'5'}] }),petSnapshot({pet_id:'2',service_id:'2'})] }),
    totals({ appointment_id:'2',appointment_date:today,start_time:'12:00:00',status:'CONFIRMED',remark:null,customer_id:'2',customer_name:customers[1].customer_name,customer_hp:customers[1].customer_hp,travel_fee_amount:null,travel_fee_label:null,
        pets:[{ ...petSnapshot({pet_id:'3',service_id:'3'}),quoted_amount:null,base_price_snapshot:null,service_name_snapshot:null }] }),
];
// Many-history QA fixtures, outside the current calendar month. Customer 2 stays empty.
Object.assign(appointments[1],{customer_id:'3',customer_name:customers[2].customer_name,customer_hp:customers[2].customer_hp});
Object.assign(appointments[1].pets[0],{pet_id:4,pet_type:'混种'}); // Legacy NULL; customer 2 stays empty.
for (let i=0;i<23;i++) appointments.push(totals({...appointments[0],appointment_id:String(300+i),appointment_date:'2025-01-'+String(i+1).padStart(2,'0'),status:i%2?'CONFIRMED':'COMPLETED',pets:appointments[0].pets.map(p=>({...p,amount:i%2?null:p.quoted_amount}))}));
function customerMeta(c) {
    const ownPets=pets.filter(p=>p.customer_id===c.customer_id);
    const ownAddresses=addresses.filter(a=>a.customer_id===c.customer_id);
    const history=appointments.some(a=>a.customer_id===c.customer_id||a.pets.some(p=>ownPets.some(own=>String(own.pet_id)===String(p.pet_id))));
    return {...c,is_archived:c.is_archived??false,pet_count:ownPets.length,address_count:ownAddresses.length,has_appointment_history:history,can_delete:!history};
}
function petMeta(p) {
    const history=appointments.some(a=>a.pets.some(ap=>String(ap.pet_id)===String(p.pet_id)));
    return {...p,is_archived:p.is_archived??false,has_appointment_history:history,can_delete:!history};
}
const api = createHttpServer(async (request,response) => {
    const url = new URL(request.url,'http://127.0.0.1');
    const method = request.method;
    const send = (value,status=200) => { response.writeHead(status,{'Content-Type':'application/json'}); response.end(JSON.stringify(value)); };
    try {
        let body = '';
        for await (const chunk of request) body += chunk;
        const input = body ? JSON.parse(body) : {};
        if (method === 'GET') reads.push({path:url.pathname,query:url.search});
        if (method !== 'GET') writes.push({method,path:url.pathname,input});
        if (url.pathname === '/__qa/state') return send({writes,reads,appointments,addresses,services,options,today});
        if (url.pathname === '/api/auth/me') return send({user_id:'1',username:'QA',role:'ADMIN'});
        if (url.pathname === '/api/services' && method === 'GET') return send(services.filter(s => url.searchParams.get('include_inactive') === 'true' || s.is_active));
        if (url.pathname === '/api/services' && method === 'POST') { const value = { ...input,service_id:String(nextId++),is_active:true }; services.push(value); return send(value,201); }
        const serviceMatch = url.pathname.match(/^\/api\/services\/(\d+)$/);
        if (serviceMatch && method === 'PUT') {
            const service = services.find(s => s.service_id === serviceMatch[1]);
            if (service.service_id === '1' && input.service_kind !== service.service_kind) return send({error:'Referenced kind is locked'},409);
            Object.assign(service,input); return send(service);
        }
        if (url.pathname === '/api/travel-fee-options' && method === 'GET') return send(options.filter(o=>url.searchParams.get('include_inactive')==='true'||o.is_active));
        if (url.pathname === '/api/travel-fee-options' && method === 'POST') {
            const value={...input,travel_fee_option_id:String(nextId++)}; options.push(value);return send(value,201);
        }
        const optionMatch=url.pathname.match(/^\/api\/travel-fee-options\/(\d+)$/);
        if (optionMatch && method === 'PUT') {
            const option=options.find(o=>o.travel_fee_option_id===optionMatch[1]); Object.assign(option,input);return send(option);
        }
        if (url.pathname === '/api/customers' && method === 'GET') return send(customers.filter(c=>(url.searchParams.get('include_archived')==='true'||!c.is_archived)&&`${c.customer_name} ${c.customer_hp}`.includes(url.searchParams.get('search')??'')).map(customerMeta));
        if (url.pathname === '/api/customers' && method === 'POST') {const c={...input,customer_id:String(nextId++),is_archived:false};customers.push(c);return send(customerMeta(c),201);}
        const recordMatch=url.pathname.match(/^\/api\/customers\/(\d+)(?:\/pets\/(\d+))?(\/archive)?$/);
        if(recordMatch){
            const [,id,petId,archive]=recordMatch;
            const record=petId?pets.find(p=>p.customer_id===id&&p.pet_id===petId):customers.find(c=>c.customer_id===id);
            if(!record)return send({},404);
            const meta=petId?petMeta(record):customerMeta(record);
            if(method==='GET')return send(meta);
            if(archive&&method==='PATCH'){record.is_archived=input.is_archived;return send({...meta,is_archived:record.is_archived});}
            if(method==='PUT'){Object.assign(record,input);return send(petId?petMeta(record):customerMeta(record));}
            if(method==='DELETE'){
                if(!meta.can_delete)return send({code:'HAS_HISTORY'},409);
                if(petId)pets.splice(pets.indexOf(record),1);
                else {customers.splice(customers.indexOf(record),1);for(let i=pets.length-1;i>=0;i--)if(pets[i].customer_id===id)pets.splice(i,1);for(let i=addresses.length-1;i>=0;i--)if(addresses[i].customer_id===id)addresses.splice(i,1);}
                return send({deleted:meta});
            }
        }
        const customerMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/(pets|overview|addresses|appointments)(?:\/(\d+))?$/);
        if (customerMatch) {
            const [,customerId,section,addressId] = customerMatch;
            if (section === 'pets') {
                if(method==='POST'){const p={...input,pet_id:String(nextId++),customer_id:customerId,is_archived:false};pets.push(p);return send(petMeta(p),201);}
                return send(pets.filter(p=>p.customer_id===customerId&&(url.searchParams.get('include_archived')==='true'||!p.is_archived)).map(petMeta));
            }
            if (section === 'appointments') {
                const limit=Number(url.searchParams.get('limit') ?? 10),offset=Number(url.searchParams.get('offset') ?? 0);
                const data=appointments.filter(a=>a.customer_id===customerId).slice().sort((a,b)=>b.appointment_date.localeCompare(a.appointment_date)||b.start_time.localeCompare(a.start_time)||Number(b.appointment_id)-Number(a.appointment_id));
                return send({appointments:data.slice(offset,offset+limit),limit,offset,has_more:offset+limit<data.length,next_offset:offset+limit<data.length?offset+limit:null});
            }
            if (section === 'overview') return send({customer:customerMeta(customers.find(c => c.customer_id === customerId)),pets:pets.filter(p => p.customer_id === customerId).map(petMeta),
                completed_visits:appointments.filter(a => a.customer_id === customerId && a.status === 'COMPLETED').length,
                total_spending:appointments.filter(a => a.customer_id === customerId).reduce((sum,a) => sum+(a.amount_due ?? 0),0),
});
            if (method === 'GET') return send(addresses.filter(a => a.customer_id === customerId));
            const address = addressId ? addresses.find(a => a.address_id === addressId && a.customer_id === customerId)
                : { address_id:String(nextId++),customer_id:customerId,latitude:null,longitude:null,is_default:!addresses.some(a => a.customer_id === customerId && a.is_active),is_active:true };
            const wasActive = addressId ? address.is_active : false;
            Object.assign(address,input);
            if (address.is_active && !wasActive && !addresses.some(a => a !== address && a.customer_id === customerId && a.is_active)) address.is_default = true;
            if (!addressId) addresses.push(address);
            if (!address.is_active) address.is_default = false;
            if (address.is_default) addresses.forEach(a => { if (a !== address && a.customer_id === customerId) a.is_default = false; });
            return send(address,addressId ? 200 : 201);
        }
        if (url.pathname === '/api/appointments' && method === 'GET') return send(appointments);
        const appointmentMatch = url.pathname.match(/^\/api\/appointments(?:\/(\d+)(?:\/(complete|cancel))?)?$/);
        if (appointmentMatch && method !== 'GET') {
            const [,id,action] = appointmentMatch;
            const appointment = id ? appointments.find(a => a.appointment_id === id)
                : { appointment_id:String(nextId++),status:'CONFIRMED',travel_fee_amount:0,customer_address_id:null };
            if (action === 'complete') { input.pets.forEach(p => Object.assign(appointment.pets.find(old => old.appointment_pet_id === p.appointment_pet_id),p)); appointment.status='COMPLETED'; }
            else if (action === 'cancel') appointment.status='CANCELLED';
            else {
                const issues=[];
                if(!id&&!input.customer_id)issues.push({field:'customer',message:'请选择客户'});
                if(!input.appointment_date)issues.push({field:'date',message:'请选择预约日期'});
                if(!input.start_time)issues.push({field:'time',message:'请选择预约时间'});
                if(!input.customer_address_id&&!appointment.customer_address_id)issues.push({field:'address',message:'请选择服务地址'});
                if(!input.pets?.length)issues.push({field:'pets',message:'请至少选择一只宠物'});
                (input.pets??[]).forEach((p,i)=>{if(!p.service_id)issues.push({field:`pets.${i}.service_id`,message:'请选择基础服务'});});
                if(issues.length)return send({code:'BOOKING_VALIDATION',field_errors:issues},400);
                if(!id&&customers.find(c=>c.customer_id===input.customer_id)?.is_archived)return send({code:'BOOKING_VALIDATION',field_errors:[{field:'customer',message:'该客户已归档'}]},409);
                const option=options.find(o=>o.travel_fee_option_id===input.travel_fee_option_id && o.is_active);
                if ((!id || appointment.travel_fee_amount == null || 'travel_fee_option_id' in input || 'travel_fee_amount' in input) && (!option || !input.travel_fee_label || input.travel_fee_amount == null || (option.amount != null && option.amount!==input.travel_fee_amount))) return send({error:'Select active travel option'},400);
                const {pets:rows,travel_fee_option_id:_selectionId,...rest} = input;
                Object.assign(appointment,rest,{pets:rows.map(petSnapshot)});
                const customer = customers.find(c => c.customer_id === appointment.customer_id);
                Object.assign(appointment,{customer_name:customer.customer_name,customer_hp:customer.customer_hp});
                if ('customer_address_id' in input) {
                    const address = addresses.find(a => a.address_id === input.customer_address_id);
                    Object.assign(appointment,{address_label_snapshot:address?.label ?? null,address_text_snapshot:address?.address_text ?? null,map_url_snapshot:address?.map_url ?? null});
                }
            }
            totals(appointment);
            if (!id) appointments.push(appointment);
            return send(appointment,id ? 200 : 201);
        }
        send({error:`No QA fixture route: ${method} ${url.pathname}`},404);
    } catch (error) { send({error:String(error)},500); }
});
await new Promise(resolve => api.listen(0,'127.0.0.1',resolve));
// Explicit process override beats any local .env setting. No fallback to the real backend.
process.env.VITE_API_BASE_URL = '';
const vite = await createViteServer({ root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${api.address().port}`},'/__qa':{target:`http://127.0.0.1:${api.address().port}`}}} });
await vite.listen();
console.log('Disposable Business V2 browser QA: http://127.0.0.1:5174 (no database)');
async function stop() { await vite.close(); api.close(); }
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
