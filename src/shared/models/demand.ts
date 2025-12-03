import { Payment } from './payment';
import { Guest } from './guest';
import { Event } from './event';
import { TableItem } from './table';

export interface Demand {
    id?: number;
    date: Date;
    slug: string;
    demandStatus: DemandStatus;
    type: DemandType;
    payment?: Payment;
    guests?: Guest[];
    tableItems?: TableItem[];
    event?: Event
    eventSlug?: string
}


export enum DemandStatus {
    SOUMISE = 'SOUMISE',
    VALIDEE = 'VALIDEE',
    REFUSEE = 'REFUSEE',
    PAYEE = 'PAYEE',
    PAIEMENT_NOTIFIE = 'PAIEMENT_NOTIFIE',
    OFFERT = 'OFFERT'
}

export enum DemandType {
    UNIQUE = 'UNIQUE',
    GROUP = 'GROUP',
}
