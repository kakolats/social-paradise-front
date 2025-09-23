export interface Payment {
    id?: number;
    amount?: number;
    date?: Date;
    phoneNumber?: string;
    paymentCanal: PaymentCanal
}

export enum PaymentCanal {
    WAVE = "WAVE",
    ORANGE_MONEY = "ORANGE_MONEY",
    CASH = "CASH"
}
