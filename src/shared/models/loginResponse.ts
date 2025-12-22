export interface LoginResponse {
    success: boolean;
    data: {
        access_token: string;
        role: string;
    },
    message: string;
}
