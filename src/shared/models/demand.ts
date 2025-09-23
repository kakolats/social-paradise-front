import { Payment } from './payment';
import { Guest } from './guest';
import { Event } from './event';

export interface Demand {
    id?: number;
    date: Date;
    slug: string;
    demandStatus: DemandStatus;
    type: DemandType;
    payments?: Payment[];
    guests?: Guest[];
    event?: Event
    eventSlug?: string
}


export enum DemandStatus {
    SOUMISE = 'SOUMISE',
    VALIDEE = 'VALIDEE',
    REFUSEE = 'REFUSEE',
    PAYEE = 'PAYEE',
    PAIEMENT_NOTIFIE = 'PAIEMENT_NOTIFIE',
}

export enum DemandType {
    UNIQUE = 'UNIQUE',
    GROUP = 'GROUP',
}
