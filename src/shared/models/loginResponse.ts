export interface LoginResponse {
    success: boolean;
    data: {
        access_token: string;
    },
    message: string;
}
