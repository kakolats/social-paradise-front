import { Price } from './price';

export interface Event {
    id?: number;
    name: string;
    date: Date;
    location?: string;
    coverImage?: string;
    description?: string;
    slug?: string;
    prices?: Price[];
}
