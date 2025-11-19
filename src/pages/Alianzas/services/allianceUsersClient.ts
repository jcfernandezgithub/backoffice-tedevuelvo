import { allAllianceUsers, allianceUserAuditEventsMock } from '../mocks/allianceUsers.seed';
import type { 
  AllianceUser, 
  AllianceUserListParams, 
  AllianceUserListResponse,
  AllianceUserAuditEvent 
} from '../types/allianceUserTypes';
import type { AllianceUserInput } from '../schemas/allianceUserSchema';
import { authenticatedFetch } from '@/services/apiClient';

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
    try {
      const queryParams = new URLSearchParams({
        partnerId: alianzaId,
      });

      // Add optional query parameters
      if (params.search) queryParams.set('q', params.search);
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.pageSize) queryParams.set('limit', params.pageSize.toString());
      if (params.sortBy) {
        const sortDir = params.sortDir === 'desc' ? '-' : '';
        queryParams.set('sort', `${sortDir}${params.sortBy}`);
      }
      if (params.role && params.role.length > 0) {
        queryParams.set('role', params.role.join(','));
      }
      if (params.state && params.state.length > 0) {
        queryParams.set('status', params.state.join(','));
      }

      const response = await authenticatedFetch(`/partner-users?${queryParams}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al obtener usuarios de alianza');
      }

      const data = await response.json();
      
      // Map backend response to frontend format
      const mappedUsers: AllianceUser[] = (data.items || []).map((user: any) => ({
        id: user._id || user.publicId,
        alianzaId,
        name: user.name,
        rut: user.rut || '',
        email: user.email,
        role: user.role === 'PARTNER_ADMIN' ? 'ALIANZA_ADMIN' : 'ALIANZA_OPERADOR',
        state: user.status === 'ACTIVE' ? 'ACTIVE' : 'BLOCKED',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || new Date().toISOString(),
        passwordLastChangedAt: user.passwordLastChangedAt,
      }));

      // Use pagination info from response
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const total = data.total || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        users: mappedUsers,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      console.error('Error listing alliance users:', error);
      throw error;
    }
  },

  async countAllianceUsers(alianzaId: string): Promise<number> {
    try {
      const queryParams = new URLSearchParams({
        partnerId: alianzaId,
        page: '1',
        limit: '1', // Solo necesitamos el total
      });

      const response = await authenticatedFetch(`/partner-users?${queryParams}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Error al obtener conteo de usuarios');
      }

      const data = await response.json();
      return data.total || 0;
    } catch (error) {
      console.error('Error counting alliance users:', error);
      return 0;
    }
  },

  async createAllianceUser(alianzaId: string, input: AllianceUserInput): Promise<AllianceUser> {
    try {
      // Map frontend role to backend role
      const backendRole = input.role === 'ALIANZA_ADMIN' ? 'PARTNER_ADMIN' : 'PARTNER_AGENT';
      
      const payload = {
        rut: input.rut,
        email: input.email,
        name: input.name,
        role: backendRole,
        password: input.password,
        partnerId: alianzaId,
      };

      const response = await authenticatedFetch('/partner-users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear usuario de alianza');
      }

      const data = await response.json();
      
      // Map backend response to frontend format
      const newUser: AllianceUser = {
        id: data.id || data.publicId,
        alianzaId,
        name: data.name,
        rut: data.rut,
        email: data.email,
        role: data.role === 'PARTNER_ADMIN' ? 'ALIANZA_ADMIN' : 'ALIANZA_OPERADOR',
        state: data.status === 'ACTIVE' ? 'ACTIVE' : 'BLOCKED',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      return newUser;
    } catch (error) {
      console.error('Error creating alliance user:', error);
      throw error;
    }
  },

  async updateAllianceUser(
    alianzaId: string, 
    userId: string, 
    input: Partial<AllianceUserInput>
  ): Promise<AllianceUser> {
    try {
      // Build payload - only include fields that are provided
      const payload: any = {
        partnerId: alianzaId,
      };

      if (input.name) payload.name = input.name;
      if (input.email) payload.email = input.email;
      if (input.rut) payload.rut = input.rut;
      
      // Map frontend role to backend role if provided
      if (input.role) {
        payload.role = input.role === 'ALIANZA_ADMIN' ? 'PARTNER_ADMIN' : 'PARTNER_AGENT';
      }

      const response = await authenticatedFetch(`/partner-users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar usuario de alianza');
      }

      const data = await response.json();
      
      // Map backend response to frontend format
      const updatedUser: AllianceUser = {
        id: data._id || data.publicId,
        alianzaId,
        name: data.name,
        rut: data.rut || '',
        email: data.email,
        role: data.role === 'PARTNER_ADMIN' ? 'ALIANZA_ADMIN' : 'ALIANZA_OPERADOR',
        state: data.status === 'ACTIVE' ? 'ACTIVE' : data.status === 'DISABLED' ? 'BLOCKED' : 'BLOCKED',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        passwordLastChangedAt: data.passwordLastChangedAt,
      };

      return updatedUser;
    } catch (error) {
      console.error('Error updating alliance user:', error);
      throw error;
    }
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
    try {
      const response = await authenticatedFetch(`/partner-users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar usuario de alianza');
      }
    } catch (error) {
      console.error('Error deleting alliance user:', error);
      throw error;
    }
  },

  async getAllianceUserAudit(alianzaId: string, userId: string): Promise<AllianceUserAuditEvent[]> {
    await delay(200);
    return auditEvents.filter(event => 
      event.allianceId === alianzaId && event.userId === userId
    );
  },
};