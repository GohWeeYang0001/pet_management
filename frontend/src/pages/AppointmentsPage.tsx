import { useEffect, useState } from "react";

import { getAppointments } from "../services/appointmentService";
import type { Appointment } from "../types/appointment";
import { appointmentStatusLabels, displayPetType } from "../utils/displayLabels";

function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadAppointments() {
            try {
                const data = await getAppointments();

                setAppointments(data);
            } catch (error) {
                console.error(error);

                setError("预约加载失败");
            } finally {
                setLoading(false);
            }
        }

        loadAppointments();
    }, []);

    if (loading) {
        return <p>预约加载中...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div>
            <h1>预约</h1>

            {appointments.map((appointment) => (
                <div key={appointment.appointment_id}>
                    <h2>{appointment.customer_name}</h2>

                    <p>
                        日期： {appointment.appointment_date}
                    </p>

                    <p>
                        时间： {appointment.start_time}
                    </p>

                    <p>
                        电话号码： {appointment.customer_hp}
                    </p>

                    <p>
                        状态： {appointmentStatusLabels[appointment.status]}
                    </p>

                    {appointment.remark && (
                        <p>
                            预约备注： {appointment.remark}
                        </p>
                    )}

                    <h3>宠物</h3>

                    {appointment.pets.map((pet) => (
                        <div key={pet.appointment_pet_id}>
                            <p>
                                宠物： {pet.pet_name}
                                {pet.pet_type && ` (${displayPetType(pet.pet_type)})`}
                            </p>

                            <p>
                                服务： {pet.service_name}
                            </p>

                            <p>
                                默认价格：RM
                                {pet.default_price ?? "-"}
                            </p>

                            {pet.remark && (
                                <p>
                                    备注： {pet.remark}
                                </p>
                            )}

                            <hr />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default AppointmentsPage;
