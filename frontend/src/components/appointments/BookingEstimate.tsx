import type { BookingPetDraft } from "../../utils/businessV2";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { petDraftQuote, previewTotal } from "../../utils/businessV2";
import { formatMoney } from "../../utils/appointmentFormat";

export default function BookingEstimate({ rows,pets,services,travel,travelSelected = true,editing = false }: {
    rows: BookingPetDraft[]; pets: Pet[]; services: Service[]; travel: number | null; editing?: boolean; travelSelected?: boolean;
}) {
    const quotes = rows.map(row => petDraftQuote(row,services));
    const total = previewTotal(quotes,travel);
    return <section className="form-card" aria-label="预约预计费用" aria-live="polite">
        <h3>{editing ? "保存后预计费用" : "预约预计费用"}</h3>
        {rows.map((row,index) => <p className="v2-price-line" key={row.key}>
            <span>{pets.find(p => String(p.pet_id) === row.pet_id)?.pet_name ?? `宠物 ${index + 1}`}</span>
            <span>{quotes[index] === null ? "暂无法估算" : formatMoney(quotes[index])}</span>
        </p>)}
        <p className="v2-price-line"><span>上门交通费</span><span>{!travelSelected ? "未选择" : travel === null ? "待填写" : formatMoney(travel)}</span></p>
        <p className="v2-price-line v2-quote"><span>预约预计总额</span><strong>{total === null ? "暂无法估算" : formatMoney(total)}</strong></p>
        <p className="form-hint">加购已计入每只宠物费用，交通费仅计一次。保存后以系统返回的预计费用为准。</p>
    </section>;
}
