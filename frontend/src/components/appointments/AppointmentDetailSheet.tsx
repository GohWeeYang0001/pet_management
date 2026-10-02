import BottomSheet from "../sheets/BottomSheet";
import type { Appointment } from "../../types/appointment";
import { appointmentStatusLabels, displayPetType } from "../../utils/displayLabels";
import { formatAppointmentDate, formatAppointmentTime, formatMoney } from "../../utils/appointmentFormat";

interface Props {
    appointment: Appointment;
    onClose: () => void;
    onComplete: () => void;
    onEdit: () => void;
    onCancel: () => void;
    busy?: boolean;
}

function AppointmentDetailSheet({ appointment, onClose, onComplete, onEdit, onCancel, busy }: Props) {
    return (
        <BottomSheet title="预约详情" subtitle={appointment.customer_name} onClose={onClose}>
            <div className="detail-summary">
                <h3>{appointment.customer_name}</h3>
                <a href={`tel:${appointment.customer_hp}`}>{appointment.customer_hp}</a>
                <p>{formatAppointmentDate(appointment.appointment_date)} · {formatAppointmentTime(appointment.start_time)}</p>
                <span className={`status-badge status-${appointment.status.toLowerCase()}`}>{appointmentStatusLabels[appointment.status]}</span>
                {appointment.remark && <p><strong>预约备注：</strong> {appointment.remark}</p>}
            </div>
            <div className="detail-pets">
                {appointment.pets.map((pet) => (
                    <section className="detail-pet" key={pet.appointment_pet_id}>
                        <h3>{pet.pet_name}</h3>
                        {pet.pet_type && <p>{displayPetType(pet.pet_type)}</p>}
                        <p>{pet.service_name}</p>
                        <p>默认价格： {formatMoney(pet.default_price)}</p>
                        <p>实际金额： {pet.amount === null ? "尚未完成" : formatMoney(pet.amount)}</p>
                        {pet.remark && <p><strong>备注：</strong> {pet.remark}</p>}
                    </section>
                ))}
            </div>
            {appointment.status === "CONFIRMED" && (
                <>
                    <button className="primary-button" type="button" onClick={onComplete} disabled={busy}>完成服务</button>
                    <button className="secondary-button" type="button" onClick={onEdit} disabled={busy}>编辑预约</button>
                    <button className="danger-button" type="button" onClick={onCancel} disabled={busy}>{busy ? "取消中..." : "取消预约"}</button>
                </>
            )}
            <button className="secondary-button" type="button" onClick={onClose}>关闭</button>
        </BottomSheet>
    );
}

export default AppointmentDetailSheet;
