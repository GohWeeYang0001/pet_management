export const expenseCategories = [
    { value: "INVENTORY", label: "Inventory" },
    { value: "TRANSPORT", label: "Transport" },
    { value: "TOOLS", label: "Tools" },
    { value: "UTILITIES", label: "Utilities" },
    { value: "MARKETING", label: "Marketing" },
    { value: "OTHER", label: "Other" },
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
