export interface EventMoneyEntry {
    id: number;
    label: string;
    amount: number;
    createdAt: string | Date;
    note?: string;
}

export interface TicketsByPriceEntry {
    priceId: number;
    name: string | null;
    amount: number;
    startDate: string | Date;
    endDate: string | Date;
    ticketsSold: number;
}

export interface EventAccounting {
    initialBalance: number;
    totalExpenses: number;
    totalIncomesManual: number;
    totalPaidFromDemands: number;
    currentBalance: number;
    ticketsByPrice: TicketsByPriceEntry[];
    expenses: EventMoneyEntry[];
    incomes: EventMoneyEntry[];
}

