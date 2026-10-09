import type { Appointment } from "../../types/appointment";
import { appointmentLocation, quoteLabel } from "../../utils/businessV2";
import { formatMoney } from "../../utils/appointmentFormat";
import LocationDisplay from "../addresses/LocationDisplay";
import { displayPetType } from "../../utils/displayLabels";

export default function AppointmentV2Details({ appointment, compact = false }: { appointment: Appointment; compact?: boolean }) {
    const location = appointmentLocation(appointment);
    const hasLocation = location.label || location.address_text || location.map_url || location.latitude != null;
    return <div className={compact ? "v2-details" : "detail-pets v2-details"}>
        {appointment.pets.map((pet,index) => <section className={compact ? "v2-history-pet" : "detail-pet"} key={pet.appointment_pet_id ?? index}>
            <h3>{pet.pet_name}{pet.is_archived&&<span className="record-tag">已归档</span>}</h3>
            {pet.pet_type && <p className="form-hint">品种：{displayPetType(pet.pet_type)}</p>}
            <p className="v2-price-line"><span>基础服务：{pet.service_name_snapshot ?? pet.service_name}</span><span>{quoteLabel(pet.base_price_snapshot)}</span></p>
            {pet.base_price_snapshot == null && <p className="form-hint">原基础价格未记录。</p>}
            {(pet.addons ?? []).map(addon => <p className="v2-price-line compact-line" key={addon.appointment_pet_addon_id}>
                <span>加购：{addon.service_name_snapshot}</span><span>{formatMoney(addon.price_snapshot)}</span>
            </p>)}
            <p className="compact-line">预计服务费：{quoteLabel(pet.quoted_amount)}</p>
            {appointment.status === "COMPLETED" && <p className="compact-line">宠物最终服务费：{quoteLabel(pet.amount)}</p>}
            {pet.remark && <p className="compact-line">备注：{pet.remark}</p>}
        </section>)}
        {hasLocation && <section className={compact ? "v2-history-pet" : "detail-pet"}><h3>服务地址</h3><LocationDisplay location={location} /></section>}
        <section className={compact ? "v2-history-pet" : "detail-pet"}>
            <h3>上门交通费</h3>
            <p className="v2-price-line"><span>{appointment.travel_fee_label ?? "原交通费"}</span><span>{appointment.travel_fee_amount == null ? "未记录" : formatMoney(appointment.travel_fee_amount)}</span></p>
            {appointment.travel_fee_note && <p className="compact-line">{appointment.travel_fee_note}</p>}
            {appointment.status === "CONFIRMED" && <p className="v2-quote">预约预计总额：{quoteLabel(appointment.quoted_total)}</p>}
            {appointment.status === "COMPLETED" && <p className="v2-quote">最终应收：{quoteLabel(appointment.amount_due ?? ("amount" in appointment ? Number(appointment.amount) : null))}</p>}
        </section>
    </div>;
}
