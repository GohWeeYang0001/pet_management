import type { AppointmentStatus } from "../types/appointment";
import type { AuthUser } from "../types/auth";
import type { InventoryTransaction } from "../types/inventory";
import type { ServiceKind } from "../types/service";

// Display labels only: API payloads and stored values keep their original keys.
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
    CONFIRMED: "已确认", COMPLETED: "已完成", CANCELLED: "已取消",
};
export const roleLabels: Record<AuthUser["role"], string> = {
    ADMIN: "管理员", EMPLOYEE: "员工",
};
export const inventoryTransactionLabels: Record<InventoryTransaction["transaction_type"], string> = {
    STOCK_IN: "入库", STOCK_OUT: "出库", ADJUSTMENT: "库存调整",
};
export const serviceKindLabels: Record<ServiceKind, string> = { BASE: "基础服务", ADDON: "加购项目" };
export function displayPetType(value: string | null): string {
    return value ?? "";
}
export function displayUnit(value: string): string {
    return value === "unit" ? "件" : value;
}
