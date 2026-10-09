import { isDateOnly, isTime } from "../validation";
import { isBusinessId } from "./catalog";
import { BusinessError, type FieldError } from "./errors";

export function validateBookingRequired(body: Record<string,unknown>,editing: boolean,current?: Record<string,unknown>): void {
    const errors: FieldError[]=[];
    if (!editing && !isBusinessId(body.customer_id)) errors.push({field:"customer",message:"请选择客户"});
    if (!isDateOnly(body.appointment_date)) errors.push({field:"date",message:"请选择有效的预约日期"});
    if (!isTime(body.start_time)) errors.push({field:"time",message:"请选择预约时间"});
    const address=Object.hasOwn(body,"customer_address_id") ? body.customer_address_id : current?.customer_address_id;
    if ((!editing || current) && !isBusinessId(address)) errors.push({field:"address",message:"请选择服务地址"});
    if (!Array.isArray(body.pets) || !body.pets.length) errors.push({field:"pets",message:"请至少选择一只宠物"});
    else body.pets.forEach((row,index)=>{
        if (!row || !isBusinessId(row.pet_id)) errors.push({field:`pets.${index}.pet_id`,message:"请选择宠物"});
        if (!row || !isBusinessId(row.service_id)) errors.push({field:`pets.${index}.service_id`,message:"请选择基础服务"});
    });
    const needsTravel=!editing || (current && (current.travel_fee_label == null || current.travel_fee_amount == null))
        || Object.hasOwn(body,"travel_fee_option_id") || Object.hasOwn(body,"travel_fee_amount") || Object.hasOwn(body,"travel_fee_label");
    if (needsTravel && (!isBusinessId(body.travel_fee_option_id) || body.travel_fee_label == null || body.travel_fee_amount == null)) {
        errors.push({field:"travel",message:"请选择上门交通费并填写金额"});
    }
    if(errors.length)throw new BusinessError(400,"请完成以下必填项","BOOKING_VALIDATION",errors);
}
