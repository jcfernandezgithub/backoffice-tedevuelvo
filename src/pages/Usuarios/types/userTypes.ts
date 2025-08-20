export type Role = 'ADMIN' | 'CONSULTANT';
export type UserState = 'ACTIVE' | 'BLOCKED' | 'PENDING';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  state: UserState;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  invitation?: { 
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'; 
    sentAt?: string; 
  };
  security?: { 
    mfaEnabled: boolean; 
    passwordLastChangedAt?: string; 
  };
}

export interface AuditEvent {
  id: string;
  userId: string;
  type:
    | 'LOGIN' | 'LOGOUT'
    | 'BLOCK' | 'UNBLOCK'
    | 'PASSWORD_RESET' | 'ROLE_CHANGED'
    | 'INVITATION_SENT' | 'INVITATION_RESENT' | 'INVITATION_ACCEPTED'
    | 'SESSIONS_REVOKED' | 'USER_CREATED' | 'USER_DELETED';
  at: string;
  actor: { id: string; name: string; role: Role };
  note?: string;
}

export interface UserFilters {
  search?: string;
  role?: Role[];
  state?: UserState[];
  createdFrom?: string;
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
}

export interface UserListParams extends UserFilters {
  page?: number;
  pageSize?: number;
  sortBy?: keyof User;
  sortDir?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}