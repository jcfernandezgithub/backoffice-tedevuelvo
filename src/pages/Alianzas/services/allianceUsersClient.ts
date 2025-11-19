import { allAllianceUsers, allianceUserAuditEventsMock } from '../mocks/allianceUsers.seed';
import type { 
  AllianceUser, 
  AllianceUserListParams, 
  AllianceUserListResponse,
  AllianceUserAuditEvent 
} from '../types/allianceUserTypes';
import type { AllianceUserInput } from '../schemas/allianceUserSchema';

let users: AllianceUser[] = [...allAllianceUsers];
let auditEvents: AllianceUserAuditEvent[] = [...allianceUserAuditEventsMock];

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));
const generateId = () => `AU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Simulate occasional errors for testing
const shouldError = () => Math.random() < 0.05;
const throwRandomError = () => {
  if (shouldError()) {
    throw new Error('Error de conexión. Inténtalo nuevamente.');
  }
};

export const allianceUsersClient = {
  async listAllianceUsers(
    alianzaId: string, 
    params: AllianceUserListParams = {}
  ): Promise<AllianceUserListResponse> {
    await delay();
    throwRandomError();

    let filteredUsers = users.filter(user => user.alianzaId === alianzaId);

    // Apply search filter
    if (params.search) {
      const searchTerm = params.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
    }

    // Apply role filter
    if (params.role && params.role.length > 0) {
      filteredUsers = filteredUsers.filter(user => params.role!.includes(user.role));
    }

    // Apply state filter
    if (params.state && params.state.length > 0) {
      filteredUsers = filteredUsers.filter(user => params.state!.includes(user.state));
    }

    // Apply date filters
    if (params.createdFrom) {
      filteredUsers = filteredUsers.filter(user => 
        new Date(user.createdAt) >= new Date(params.createdFrom!)
      );
    }
    if (params.createdTo) {
      filteredUsers = filteredUsers.filter(user => 
        new Date(user.createdAt) <= new Date(params.createdTo!)
      );
    }

    // Apply sorting
    if (params.sortBy) {
      filteredUsers.sort((a, b) => {
        const aValue = a[params.sortBy!];
        const bValue = b[params.sortBy!];
        const direction = params.sortDir === 'desc' ? -1 : 1;

        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return direction;
        if (bValue === undefined) return -direction;

        if (aValue < bValue) return -direction;
        if (aValue > bValue) return direction;
        return 0;
      });
    }

    // Apply pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

    return {
      users: paginatedUsers,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async countAllianceUsers(alianzaId: string): Promise<number> {
    await delay(100);
    return users.filter(user => user.alianzaId === alianzaId).length;
  },

  async createAllianceUser(alianzaId: string, input: AllianceUserInput): Promise<AllianceUser> {
    await delay();
    throwRandomError();

    // Check for duplicate email within the alliance
    const existingUser = users.find(user => 
      user.alianzaId === alianzaId && user.email.toLowerCase() === input.email.toLowerCase()
    );
    if (existingUser) {
      throw new Error('Ya existe un usuario con este email en la alianza');
    }

    const now = new Date().toISOString();
    const newUser: AllianceUser = {
      id: generateId(),
      alianzaId,
      name: input.name,
      rut: input.rut,
      email: input.email,
      role: input.role,
      state: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    users.unshift(newUser);

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId: newUser.id,
      type: 'USER_CREATED',
      at: now,
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
    };
    auditEvents.unshift(auditEvent);

    return newUser;
  },

  async updateAllianceUser(
    alianzaId: string, 
    userId: string, 
    input: Partial<AllianceUserInput>
  ): Promise<AllianceUser> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    const user = users[userIndex];
    const updatedUser = {
      ...user,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    users[userIndex] = updatedUser;

    // Add audit event if role changed
    if (input.role && input.role !== user.role) {
      const auditEvent: AllianceUserAuditEvent = {
        id: `AE-${Date.now()}`,
        allianceId: alianzaId,
        userId,
        type: 'ROLE_CHANGED',
        at: new Date().toISOString(),
        actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
        note: `Rol cambiado de ${user.role} a ${input.role}`,
      };
      auditEvents.unshift(auditEvent);
    }

    return updatedUser;
  },

  async blockAllianceUser(alianzaId: string, userId: string, note?: string): Promise<void> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    // Check if it's the last admin
    const admins = users.filter(user => 
      user.alianzaId === alianzaId && 
      user.role === 'ALIANZA_ADMIN' && 
      user.state === 'ACTIVE'
    );
    
    if (admins.length === 1 && admins[0].id === userId) {
      throw new Error('No se puede bloquear al último administrador de la alianza');
    }

    users[userIndex] = {
      ...users[userIndex],
      state: 'BLOCKED',
      updatedAt: new Date().toISOString(),
    };

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'BLOCK',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
      note,
    };
    auditEvents.unshift(auditEvent);
  },

  async unblockAllianceUser(alianzaId: string, userId: string): Promise<void> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    users[userIndex] = {
      ...users[userIndex],
      state: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'UNBLOCK',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
    };
    auditEvents.unshift(auditEvent);
  },

  async resetAllianceUserPassword(alianzaId: string, userId: string): Promise<void> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    users[userIndex] = {
      ...users[userIndex],
      passwordLastChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'PASSWORD_RESET',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
    };
    auditEvents.unshift(auditEvent);
  },

  async resendAllianceInvitation(alianzaId: string, userId: string): Promise<void> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    const user = users[userIndex];
    if (user.state !== 'PENDING') {
      throw new Error('Solo se pueden reenviar invitaciones a usuarios pendientes');
    }

    users[userIndex] = {
      ...user,
      invitation: {
        status: 'PENDING',
        sentAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'INVITATION_RESENT',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
    };
    auditEvents.unshift(auditEvent);
  },

  async revokeAlliancePortalSessions(alianzaId: string, userId: string): Promise<void> {
    await delay();
    throwRandomError();

    const user = users.find(user => user.id === userId && user.alianzaId === alianzaId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'SESSIONS_REVOKED',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
    };
    auditEvents.unshift(auditEvent);
  },

  async deleteAllianceUser(alianzaId: string, userId: string): Promise<void> {
    await delay();
    throwRandomError();

    const userIndex = users.findIndex(user => user.id === userId && user.alianzaId === alianzaId);
    if (userIndex === -1) {
      throw new Error('Usuario no encontrado');
    }

    const user = users[userIndex];

    // Check if it's the last admin
    const admins = users.filter(user => 
      user.alianzaId === alianzaId && 
      user.role === 'ALIANZA_ADMIN' && 
      user.state === 'ACTIVE'
    );
    
    if (admins.length === 1 && admins[0].id === userId) {
      throw new Error('No se puede eliminar al último administrador de la alianza');
    }

    users.splice(userIndex, 1);

    // Add audit event
    const auditEvent: AllianceUserAuditEvent = {
      id: `AE-${Date.now()}`,
      allianceId: alianzaId,
      userId,
      type: 'USER_DELETED',
      at: new Date().toISOString(),
      actor: { id: 'current-admin', name: 'Admin Actual', role: 'ADMIN' },
      note: `Usuario ${user.name} eliminado`,
    };
    auditEvents.unshift(auditEvent);
  },

  async getAllianceUserAudit(alianzaId: string, userId: string): Promise<AllianceUserAuditEvent[]> {
    await delay(200);
    return auditEvents.filter(event => 
      event.allianceId === alianzaId && event.userId === userId
    );
  },
};