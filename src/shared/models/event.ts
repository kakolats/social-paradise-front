import { Price } from './price';

export interface Event {
    id?: number;
    name: string;
    date: Date;
    slug?: string;
    prices?: Price[];
}
