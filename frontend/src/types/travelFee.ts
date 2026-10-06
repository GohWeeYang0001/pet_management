export interface TravelFeeOption {
    travel_fee_option_id: string;
    label: string;
    /** NULL marks a manual-price template. */
    amount: number | null;
    is_active: boolean;
    sort_order: number;
}
export type TravelFeeOptionInput = Omit<TravelFeeOption,"travel_fee_option_id">;
