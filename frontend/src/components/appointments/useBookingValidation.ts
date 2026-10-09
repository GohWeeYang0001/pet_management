import { useState } from "react";
import { ApiError } from "../../services/api";
import { bookingIssues,bookingFieldSignature,mapBookingField,type BookingIssue,type BookingValidationInput } from "../../utils/bookingValidation";

export function useBookingValidation(input:BookingValidationInput) {
    const [attempted,setAttempted]=useState(false);
    const [server,setServer]=useState<Array<{issue:BookingIssue;signature:string}>>([]);
    function focus(field:string) {
        requestAnimationFrame(()=>{
            const target=document.querySelector<HTMLElement>(`.bottom-sheet [data-validation-field="${field}"]`);
            target?.scrollIntoView({block:"start",behavior:"auto"});
            // Focus the section/label, never force a native input/picker or keyboard.
            target?.focus({preventScroll:true});
        });
    }
    const local=attempted?bookingIssues(input):[];
    const issues=[...local,...server.filter(value=>bookingFieldSignature(input,value.issue.field)===value.signature && !local.some(issue=>issue.field===value.issue.field)).map(value=>value.issue)];
    return {issues,
        validate(){setAttempted(true);setServer([]);const next=bookingIssues(input);if(next.length){focus(next[0].field);return false;}return true;},
        report(error:unknown){
            if(!(error instanceof ApiError) || !error.fieldErrors?.length)return false;
            const next=error.fieldErrors.flatMap(value=>{
                const field=mapBookingField(value.field,input.rows);if(!field)return [];
                const key=Number(field.split("-")[1]);const row=input.rows.find(row=>row.key===key);
                const name=input.pets.find(p=>String(p.pet_id)===row?.pet_id)?.pet_name ?? "宠物";
                const label=field.startsWith("base-")?`${name} 的基础服务`:field.startsWith("pet-")?name:field.startsWith("addons-")?`${name} 的加购项目`:({customer:"客户",date:"预约日期",time:"预约时间",address:"服务地址",pets:"宠物",travel:"上门交通费"} as Record<string,string>)[field];
                const issue={field,label,message:value.message,missing:false};return [{issue,signature:bookingFieldSignature(input,field)}];
            });
            if(!next.length)return false;setAttempted(true);setServer(next);focus(next[0].issue.field);return true;
        },
    };
}
