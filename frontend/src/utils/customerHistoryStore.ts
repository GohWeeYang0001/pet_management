import { getCustomerAppointments } from "../services/customerService";
import type { CustomerAppointmentPage } from "../types/customer";
import type { Appointment } from "../types/appointment";

export interface HistoryState {
    appointments: Appointment[];
    loaded: boolean;
    loading: boolean;
    error: boolean;
    nextOffset: number | null;
}

// One cache per CustomersPage lifetime. Closing/reopening a section or customer
// reuses pages/in-flight requests; leaving the page discards the cache.
export function createCustomerHistoryStore(fetchPage = getCustomerAppointments) {
    const states = new Map<string,HistoryState>();
    const listeners = new Map<string,Set<() => void>>();
    const requests = new Map<string,Promise<void>>();
    const generations = new Map<string,number>();
    function get(id: string): HistoryState {
        if (!states.has(id)) states.set(id,{appointments:[],loaded:false,loading:false,error:false,nextOffset:null});
        return states.get(id)!;
    }
    function publish(id: string,state: HistoryState) {
        states.set(id,state); listeners.get(id)?.forEach(listener => listener());
    }
    function load(id: string,more: boolean): Promise<void> {
        if (requests.has(id)) return requests.get(id)!;
        const current = get(id);
        if ((!more && current.loaded) || (more && current.loaded && current.nextOffset === null)) return Promise.resolve();
        const offset = more && current.loaded ? current.nextOffset! : 0;
        const generation = generations.get(id) ?? 0;
        publish(id,{...current,loading:true,error:false});
        const request = Promise.resolve().then(() => fetchPage(id,10,offset)).then((page: CustomerAppointmentPage) => {
            if ((generations.get(id) ?? 0) !== generation) return;
            const previous = offset === 0 ? [] : get(id).appointments;
            const known = new Set(previous.map(appointment => appointment.appointment_id));
            publish(id,{appointments:[...previous,...page.appointments.filter(appointment => !known.has(appointment.appointment_id))],
                loaded:true,loading:false,error:false,nextOffset:page.has_more ? page.next_offset : null});
        }).catch(() => {
            if ((generations.get(id) ?? 0) === generation) publish(id,{...get(id),loading:false,error:true});
        }).finally(() => { if (requests.get(id) === request) requests.delete(id); });
        requests.set(id,request);
        return request;
    }
    return {
        get,
        subscribe(id: string,listener: () => void) {
            if (!listeners.has(id)) listeners.set(id,new Set());
            listeners.get(id)!.add(listener);
            return () => { listeners.get(id)?.delete(listener); };
        },
        loadFirst: (id: string) => load(id,false),
        loadMore: (id: string) => load(id,true),
        invalidate(id: string) {
            generations.set(id,(generations.get(id) ?? 0)+1); requests.delete(id);
            publish(id,{appointments:[],loaded:false,loading:false,error:false,nextOffset:null});
        },
    };
}
export type CustomerHistoryStore = ReturnType<typeof createCustomerHistoryStore>;
