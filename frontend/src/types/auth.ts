export interface AuthUser {
    user_id: string;
    username: string;
    role: "ADMIN" | "EMPLOYEE";
}
