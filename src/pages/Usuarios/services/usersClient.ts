import type { 
  User, 
  UserListParams, 
  UserListResponse, 
  AuditEvent, 
  UserFilters 
} from '../types/userTypes';
import type { UserFormData, PasswordFormData } from '../schemas/userSchema';
import { usersMock, auditEventsMock, currentUserMock } from '../mocks/seed';

// In-memory store (simulates database)
let usersStore: User[] = [...usersMock];
let auditStore: AuditEvent[] = [...auditEventsMock];

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

function filterUsers(users: User[], filters: UserFilters): User[] {
  return users.filter(user => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!user.name.toLowerCase().includes(searchLower) && 
          !user.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    
    if (filters.role && filters.role.length > 0) {
      if (!filters.role.includes(user.role)) return false;
    }
    
    if (filters.state && filters.state.length > 0) {
      if (!filters.state.includes(user.state)) return false;
    }
    
    if (filters.createdFrom) {
      if (new Date(user.createdAt) < new Date(filters.createdFrom)) return false;
    }
    
    if (filters.createdTo) {
      if (new Date(user.createdAt) > new Date(filters.createdTo)) return false;
    }
    
    if (filters.lastLoginFrom && user.lastLoginAt) {
      if (new Date(user.lastLoginAt) < new Date(filters.lastLoginFrom)) return false;
    }
    
    if (filters.lastLoginTo && user.lastLoginAt) {
      if (new Date(user.lastLoginAt) > new Date(filters.lastLoginTo)) return false;
    }
    
    return true;
  });
}

function sortUsers(users: User[], sortBy?: keyof User, sortDir: 'asc' | 'desc' = 'asc'): User[] {
  if (!sortBy) return users;
  
  return [...users].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    if (aVal > bVal) comparison = 1;
    
    return sortDir === 'desc' ? -comparison : comparison;
  });
}

function addAuditEvent(
  userId: string, 
  type: AuditEvent['type'], 
  note?: string
): void {
  const event: AuditEvent = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    type,
    at: new Date().toISOString(),
    actor: currentUserMock,
    note
  };
  auditStore.unshift(event);
}

export const usersClient = {
  async listUsers(params: UserListParams = {}): Promise<UserListResponse> {
    await delay();
    
    // Simulate occasional errors
    if (Math.random() < 0.02) {
      throw new Error('Error de conexión. Intenta nuevamente.');
    }
    
    const {
      page = 1,
      pageSize = 10,
      sortBy,
      sortDir = 'asc',
      ...filters
    } = params;
    
    let filtered = filterUsers(usersStore, filters);
    let sorted = sortUsers(filtered, sortBy, sortDir);
    
    const total = sorted.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const users = sorted.slice(start, start + pageSize);
    
    return {
      users,
      total,
      page,
      pageSize,
      totalPages
    };
  },

  async createUser(data: UserFormData): Promise<User> {
    await delay();
    
    // Check for duplicate email
    if (usersStore.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('Ya existe un usuario con este correo electrónico');
    }
    
    const now = new Date().toISOString();
    const newUser: User = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      state: data.sendInvitation ? 'PENDING' : 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      invitation: data.sendInvitation ? {
        status: 'PENDING',
        sentAt: now
      } : undefined,
      security: {
        mfaEnabled: false,
        passwordLastChangedAt: now
      }
    };
    
    usersStore.unshift(newUser);
    addAuditEvent(newUser.id, 'USER_CREATED');
    
    if (data.sendInvitation) {
      addAuditEvent(newUser.id, 'INVITATION_SENT');
    }
    
    return newUser;
  },

  async updateUser(id: string, data: Partial<UserFormData>): Promise<User> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    // Check for duplicate email (excluding current user)
    if (data.email && usersStore.some(u => u.id !== id && u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('Ya existe un usuario con este correo electrónico');
    }
    
    const currentUser = usersStore[userIndex];
    const updatedUser: User = {
      ...currentUser,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    usersStore[userIndex] = updatedUser;
    
    if (data.role && data.role !== currentUser.role) {
      addAuditEvent(id, 'ROLE_CHANGED', `Cambio de ${currentUser.role} a ${data.role}`);
    }
    
    return updatedUser;
  },

  async blockUser(id: string, reason?: string): Promise<User> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    const updatedUser: User = {
      ...usersStore[userIndex],
      state: 'BLOCKED',
      updatedAt: new Date().toISOString()
    };
    
    usersStore[userIndex] = updatedUser;
    addAuditEvent(id, 'BLOCK', reason);
    
    return updatedUser;
  },

  async unblockUser(id: string): Promise<User> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    const updatedUser: User = {
      ...usersStore[userIndex],
      state: 'ACTIVE',
      updatedAt: new Date().toISOString()
    };
    
    usersStore[userIndex] = updatedUser;
    addAuditEvent(id, 'UNBLOCK');
    
    return updatedUser;
  },

  async resetPassword(id: string, newPassword?: string): Promise<void> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    const user = usersStore[userIndex];
    user.security = {
      ...user.security,
      passwordLastChangedAt: new Date().toISOString()
    };
    user.updatedAt = new Date().toISOString();
    
    addAuditEvent(id, 'PASSWORD_RESET');
  },

  async deleteUser(id: string): Promise<void> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    usersStore.splice(userIndex, 1);
    addAuditEvent(id, 'USER_DELETED');
  },

  async resendInvitation(id: string): Promise<void> {
    await delay();
    
    const userIndex = usersStore.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }
    
    const user = usersStore[userIndex];
    if (user.invitation) {
      user.invitation.sentAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
    
    addAuditEvent(id, 'INVITATION_RESENT');
  },

  async revokeSessions(id: string): Promise<void> {
    await delay();
    addAuditEvent(id, 'SESSIONS_REVOKED');
  },

  async getUserAudit(userId: string): Promise<AuditEvent[]> {
    await delay();
    return auditStore.filter(event => event.userId === userId);
  },

  async bulkAction(userIds: string[], action: 'block' | 'unblock'): Promise<void> {
    await delay();
    
    for (const id of userIds) {
      if (action === 'block') {
        await this.blockUser(id, 'Acción masiva');
      } else {
        await this.unblockUser(id);
      }
    }
  }
};