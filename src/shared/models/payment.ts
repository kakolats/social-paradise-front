export interface Payment {
    id?: number;
    amount?: number;
    date?: Date;
    phoneNumber?: string;
    paymentCanal: PaymentCanal,
    paymentPlace?: PaymentPlace
}

export enum PaymentCanal {
    WAVE = "WAVE",
    ORANGE_MONEY = "ORANGE_MONEY",
    CASH = "CASH"
}

export enum PaymentPlace {
    FRUIT_STORE = "FRUIT_STORE",
    HEMISPHERE = "HEMISPHERE",
    IROKO_BEACH = "IROKO_BEACH",
    GROOV = "GROOV",
    FITLAB = "FITLAB"
}
