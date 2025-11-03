import { Price } from './price';
import { Table } from './table';

export interface Event {
    id?: number;
    name: string;
    date: Date;
    location?: string;
    coverImage?: string;
    description?: string;
    slug?: string;
    prices?: Price[];
    tables?: Table[];
}
