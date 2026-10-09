import type { AppointmentPet } from "../../types/appointment";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { eligibleServices, parseMoneyInput, petDraftQuote, quoteLabel, type BookingPetDraft } from "../../utils/businessV2";
import { formatMoney } from "../../utils/appointmentFormat";
import { FieldValidation } from "./BookingValidation";
import type { BookingIssue } from "../../utils/bookingValidation";

interface Props { row: BookingPetDraft; pets: Pet[]; services: Service[]; original?: AppointmentPet; issues?:BookingIssue[];onBase: (id: string) => void; onAddons: (ids: string[]) => void }

export default function PetServicesFields({ row,pets,services,original,onBase,onAddons,issues=[] }: Props) {
    const pet = pets.find(p => String(p.pet_id) === row.pet_id);
    const bases = eligibleServices(services,"BASE",pet,original);
    const addons = eligibleServices(services,"ADDON",pet,original);
    const quote = petDraftQuote(row,services);
    return <>
        <label tabIndex={-1} data-validation-field={`base-${row.key}`}>基础服务<select aria-label="基础服务" aria-invalid={issues.some(i=>i.field===`base-${row.key}`)} aria-describedby={`validation-base-${row.key}`} value={row.service_id} onChange={event => onBase(event.target.value)} required disabled={!pet}>
            <option value="">请选择基础服务</option>
            {bases.map(service => <option key={service.service_id} value={service.service_id}>{service.service_name} · {formatMoney(service.default_price)}{!service.is_active ? "（已停用，保留原选择）" : ""}</option>)}
        </select></label>
        <FieldValidation field={`base-${row.key}`} issues={issues} />
        {pet && bases.length === 0 && <p className="form-hint">暂无启用的基础服务，请先在服务管理中设置。</p>}
        <fieldset className="v2-addon-options" tabIndex={-1} data-validation-field={`addons-${row.key}`} disabled={!pet}>
            <legend>加购项目（可多选）</legend>
            {addons.length ? addons.map(service => <label className="check-label v2-addon-choice" key={service.service_id}>
                <input type="checkbox" checked={row.addonIds.includes(String(service.service_id))} disabled={parseMoneyInput(String(service.default_price)) === null && !row.addonIds.includes(String(service.service_id))}
                    onChange={event => onAddons(event.target.checked ? [...row.addonIds,String(service.service_id)] : row.addonIds.filter(id => id !== String(service.service_id)))} />
                <span>{service.service_name}{!service.is_active && <small>（已停用，保留原选择）</small>}</span>
                <span>{service.default_price === null ? "未设置价格" : "+" + formatMoney(service.default_price)}</span>
            </label>) : <p className="form-hint">{pet ? "暂无启用的加购项目。" : "请先选择宠物。"}</p>}
        </fieldset>
        <FieldValidation field={`addons-${row.key}`} issues={issues} />
        {original && <p className="form-hint">原预约预计服务费：{quoteLabel(original.quoted_amount)}</p>}
        <p className="v2-quote" aria-live="polite">{original ? "保存后预计（当前价格）" : "预计服务费"}：{quote === null ? "暂无法估算" : formatMoney(quote)}</p>
    </>;
}
