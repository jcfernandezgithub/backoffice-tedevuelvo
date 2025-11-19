export type AllianceRole = 'ALIANZA_ADMIN' | 'ALIANZA_OPERADOR';
export type AllianceUserState = 'ACTIVE' | 'BLOCKED' | 'PENDING';

export interface AllianceUser {
  id: string;
  alianzaId: string;
  name: string;
  rut: string;
  email: string;
  role: AllianceRole;
  state: AllianceUserState;
  lastPortalLoginAt?: string;
  passwordLastChangedAt?: string;
  invitation?: { 
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'; 
    sentAt?: string; 
  };
  createdAt: string;
  updatedAt: string;
}

export interface AllianceUserAuditEvent {
  id: string;
  allianceId: string;
  userId: string;
  type:
    | 'INVITATION_SENT' | 'INVITATION_RESENT' | 'INVITATION_ACCEPTED'
    | 'BLOCK' | 'UNBLOCK'
    | 'PASSWORD_RESET' | 'ROLE_CHANGED'
    | 'SESSIONS_REVOKED' | 'USER_CREATED' | 'USER_DELETED';
  at: string;
  actor: { id: string; name: string; role: 'ADMIN' | 'CONSULTANT' };
  note?: string;
}

export interface AllianceUserFilters {
  search?: string;
  role?: AllianceRole[];
  state?: AllianceUserState[];
  createdFrom?: string;
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
}

export interface AllianceUserListParams extends AllianceUserFilters {
  page?: number;
  pageSize?: number;
  sortBy?: keyof Pick<AllianceUser, 'name' | 'role' | 'state' | 'lastPortalLoginAt' | 'createdAt'>;
  sortDir?: 'asc' | 'desc';
}

export interface AllianceUserListResponse {
  users: AllianceUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}