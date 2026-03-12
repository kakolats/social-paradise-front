export interface EventMoneyEntry {
    id: number;
    label: string;
    amount: number;
    createdAt: string | Date;
    note?: string;
}

export interface EventAccounting {
    initialBalance: number;
    totalExpenses: number;
    totalIncomesManual: number;
    totalPaidFromDemands: number;
    currentBalance: number;
    expenses: EventMoneyEntry[];
    incomes: EventMoneyEntry[];
}

