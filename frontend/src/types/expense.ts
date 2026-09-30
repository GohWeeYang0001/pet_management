export interface Expense {
    expense_id: string;
    expense_date: string;
    category: string;
    item_name: string;
    amount: number;
    remark: string | null;
    source: string;
}

export type ExpenseInput = Pick<Expense, "expense_date" | "category" | "item_name" | "amount" | "remark">;
