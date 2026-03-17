import { Price } from './price';
import { Table } from './table';
import { PaymentCanal } from './payment';

export interface EventPaymentMethod {
    name: string;
    phoneNumber: string;
    canal?: PaymentCanal | string;
}

export interface EventCashPlace {
    name: string;
    address: string;
    mapUrl?: string;
}

export interface Event {
    id?: number;
    name: string;
    date: Date;
    location?: string;
    coverImage?: string;
    description?: string;
    isActive?: boolean;
    slug?: string;
    prices?: Price[];
    tables?: Table[];
    paymentMethods?: EventPaymentMethod[];
    allowCash?: boolean;
    cashPlacesConfig?: EventCashPlace[];
    initialBalance?: number;
}
