export interface InventoryItem {
    inventory_item_id: string;
    item_name: string;
    current_quantity: number;
    unit: string;
    reorder_level: number;
    is_active: boolean;
}

export interface InventoryTransaction {
    inventory_transaction_id: string;
    inventory_item_id: string;
    transaction_type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
    quantity: number;
    amount: number | null;
    remark: string | null;
    created_at: string;
}
