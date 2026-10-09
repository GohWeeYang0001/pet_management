import { useEffect,useState } from "react";
import BottomSheet from "../sheets/BottomSheet";
import { getCustomerManagementState,deleteCustomer,setCustomerArchived } from "../../services/customerService";
import { getPetManagementState,deletePet,setPetArchived } from "../../services/petService";
import { ApiError } from "../../services/api";

interface State {name:string;archived:boolean;canDelete:boolean;petCount:number;addressCount:number}
interface Props {customerId:string;petId?:string;restore:boolean;onClose:()=>void;onSuccess:(deletedCustomer:boolean)=>Promise<void>}
export default function RecordActionSheet({customerId,petId,restore,onClose,onSuccess}:Props) {
    const [state,setState]=useState<State|null>(null);
    const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
    async function load(){
        setLoading(true);setError("");
        try {
            const data=petId?await getPetManagementState(customerId,petId):await getCustomerManagementState(customerId);
            if(typeof data.can_delete!=="boolean")throw new Error("Missing management state");
            if(!petId && (!("pet_count" in data)||!Number.isInteger(data.pet_count)||!("address_count" in data)||!Number.isInteger(data.address_count)))throw new Error("Missing dependent counts");
            setState({name:"pet_name" in data?data.pet_name:data.customer_name,archived:data.is_archived??false,canDelete:data.can_delete,
                petCount:"pet_count" in data?data.pet_count??0:0,addressCount:"address_count" in data?data.address_count??0:0});
        }catch{setError("无法读取记录状态，请重试。");}finally{setLoading(false);}
    }
    useEffect(()=>{
        let current=true;
        (async()=>{
            try {
                const data=petId?await getPetManagementState(customerId,petId):await getCustomerManagementState(customerId);
                if(typeof data.can_delete!=="boolean")throw new Error("Missing management state");
                if(!petId && (!("pet_count" in data)||!Number.isInteger(data.pet_count)||!("address_count" in data)||!Number.isInteger(data.address_count)))throw new Error("Missing dependent counts");
                if(current)setState({name:"pet_name" in data?data.pet_name:data.customer_name,archived:data.is_archived??false,canDelete:data.can_delete,
                    petCount:"pet_count" in data?data.pet_count??0:0,addressCount:"address_count" in data?data.address_count??0:0});
            }catch{if(current)setError("无法读取记录状态，请重试。");}finally{if(current)setLoading(false);}
        })();return()=>{current=false;};
    },[customerId,petId]);
    const permanent=!!state && state.canDelete && !restore;
    const action=restore?"恢复":permanent?"删除":"归档";
    async function confirm(){
        if(!state || saving)return;
        setSaving(true);setError("");
        try {
            if(permanent){if(petId)await deletePet(customerId,petId);else await deleteCustomer(customerId,state.petCount,state.addressCount);}
            else if(petId)await setPetArchived(customerId,petId,!restore);else await setCustomerArchived(customerId,!restore);
            await onSuccess(permanent&&!petId);
        }catch(failure){
            if(failure instanceof ApiError && failure.status===409){setState(null);setError("记录已有预约或资料已变化，无法按原状态删除。请重新读取后确认归档或删除。");}
            else setError(`${action}失败，请重试。`);
        }finally{setSaving(false);}
    }
    return <BottomSheet title={`${action}${petId?"宠物":"客户"}`} onClose={()=>{if(!saving)onClose();}}>
        <div className="sheet-form">
            {loading?<p className="form-hint">正在确认记录状态...</p>:state&&<div className="form-card">
                <h3>确定{action}「{state.name}」？</h3>
                {permanent?<><p>此操作无法恢复。</p>{!petId&&<><p>将同时删除：</p><ul><li>{state.petCount} 只宠物</li><li>{state.addressCount} 个地址</li></ul></>}</>:
                    <p>{restore?(petId?"恢复宠物后，还需确保客户未归档，才能用于新预约。":"恢复客户后，未归档的宠物可再次用于新预约。") :"已有预约记录，不能永久删除。归档后不会出现在新预约的选择中，历史记录会完整保留。"}</p>}
            </div>}
            {error&&<p className="form-error" role="alert">{error}</p>}
            {!state&&!loading&&<button type="button" className="secondary-button" onClick={load}>重新读取记录状态</button>}
            {state&&<button type="button" className={permanent?"danger-button":"primary-button"} disabled={loading||saving} onClick={confirm}>{saving?"处理中...":`确认${action}`}</button>}
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>取消</button>
        </div>
    </BottomSheet>;
}
