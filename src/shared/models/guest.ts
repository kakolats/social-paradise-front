export interface Guest {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    age: number;
    slug?: number;
    state: boolean;
    isMainGuest: boolean;
}
