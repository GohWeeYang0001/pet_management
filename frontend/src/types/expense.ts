export const expenseCategories = [
    { value: "INVENTORY", label: "库存" },
    { value: "TRANSPORT", label: "交通" },
    { value: "TOOLS", label: "工具" },
    { value: "UTILITIES", label: "水电/杂费" },
    { value: "MARKETING", label: "营销" },
    { value: "OTHER", label: "其他" },
] as const;

export type ExpenseCategory = typeof expenseCategories[number]["value"];

export interface Expense {
    expense_id: string;
    expense_date: string;
    category: ExpenseCategory;
    item_name: string;
    amount: number;
    remark: string | null;
    source: string;
}

export type ExpenseInput = Pick<Expense, "expense_date" | "category" | "item_name" | "amount" | "remark">;
