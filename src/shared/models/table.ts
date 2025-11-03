export interface Table {
    id?: number;
    name: string;
    amount: number;
    capacity: number;
}

export interface TableItem {
    id: number;
    table: Table;
    quantity: number;
}