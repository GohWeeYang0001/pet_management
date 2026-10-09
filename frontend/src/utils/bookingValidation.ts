import type { Appointment } from "../types/appointment";
import type { Pet } from "../types/pet";
import type { Service } from "../types/service";
import { validatePetDrafts,validateTravelDraft,type BookingPetDraft,type BookingExtrasDraft } from "./businessV2";

export interface BookingIssue {field:string;label:string;message:string;missing:boolean}
export interface BookingValidationInput {
    customerId:string;date:string;time:string;rows:BookingPetDraft[];pets:Pet[];services:Service[];
    extras:BookingExtrasDraft;appointment?:Appointment;
}
export function bookingIssues(input:BookingValidationInput):BookingIssue[] {
    const {customerId,date,time,rows,pets,services,extras,appointment}=input;
    const issues:BookingIssue[]=[];
    const add=(field:string,label:string,message:string,missing=true)=>issues.push({field,label,message,missing});
    if(!customerId)add("customer","客户","请选择客户");
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+"T00:00:00") : null;
    if(!parsed || Number.isNaN(parsed.getTime()) || parsed.getFullYear()!==Number(date.slice(0,4)) || parsed.getMonth()+1!==Number(date.slice(5,7)) || parsed.getDate()!==Number(date.slice(8,10)))add("date","预约日期","请选择有效的预约日期",!date);
    if(!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))add("time","预约时间","请选择预约时间",!time);
    if(!extras.addressId)add("address","服务地址","请选择服务地址");
    else if(!extras.addressReady)add("address","服务地址","地址尚未加载完成，请等待或重试",false);
    if(!rows.length)add("pets","宠物","请至少选择一只宠物");
    rows.forEach((row,index)=>{
        const pet=pets.find(p=>String(p.pet_id)===row.pet_id);
        const name=pet?.pet_name ?? `宠物 ${index+1}`;
        const retained=appointment?.pets.some(p=>p.appointment_pet_id===row.appointment_pet_id && String(p.pet_id)===row.pet_id);
        if(!row.pet_id || !pet){add(`pet-${row.key}`,name,"请选择宠物");return;}
        if(pet.is_archived && !retained){add(`pet-${row.key}`,name,"该宠物已归档，请选择其他宠物",false);return;}
        if(!row.service_id){add(`base-${row.key}`,`${name} 的基础服务`,"请选择基础服务");return;}
        const problem=validatePetDrafts([row],pets,services,appointment?.pets);
        if(problem)add(problem.includes("加购")?`addons-${row.key}`:`base-${row.key}`,`${name} 的${problem.includes("加购")?"加购项目":"基础服务"}`,problem,false);
    });
    const travel=validateTravelDraft(extras,appointment);
    if(travel)add("travel","上门交通费",travel.includes("请选择")?"请选择上门交通费":travel,travel.includes("请选择"));
    else if(!extras.travelReady)add("travel","上门交通费","交通费选项尚未加载完成，请等待或重试",false);
    return issues;
}
export function bookingFieldSignature(input:BookingValidationInput,field:string):string {
    if(field==="customer")return input.customerId;
    if(field==="date")return input.date;
    if(field==="time")return input.time;
    if(field==="address")return input.customerId+":"+input.extras.addressId;
    if(field==="travel")return JSON.stringify([input.extras.optionId,input.extras.travelLabel,input.extras.manualAmount,input.extras.presetAmount]);
    if(field==="pets")return JSON.stringify([input.customerId,input.rows.map(row=>[row.key,row.pet_id])]);
    const key=Number(field.split("-")[1]),row=input.rows.find(row=>row.key===key);
    return JSON.stringify([input.customerId,row?.pet_id,field.startsWith("base-")?row?.service_id:field.startsWith("addons-")?row?.addonIds:null]);
}
export function mapBookingField(field:string,rows:BookingPetDraft[]):string|null {
    if(["customer","date","time","address","pets","travel"].includes(field))return field;
    const match=/^pets\.(\d+)\.(pet_id|service_id|addons)$/.exec(field);const row=match?rows[Number(match[1])]:undefined;
    return match && row ? `${match[2]==="pet_id"?"pet":match[2]==="service_id"?"base":"addons"}-${row.key}` : null;
}
