import type { AllianceUser, AllianceUserAuditEvent, AllianceRole, AllianceUserState } from '../types/allianceUserTypes';

const roles: AllianceRole[] = ['ALIANZA_ADMIN', 'ALIANZA_OPERADOR'];
const states: AllianceUserState[] = ['ACTIVE', 'BLOCKED', 'PENDING'];

// Generate alliance users for different alliances
export const allianceUsersMock: AllianceUser[] = [
  // AL-001 users
  {
    id: 'AU-001',
    alianzaId: 'AL-001',
    name: 'María García López',
    email: 'maria.garcia@sindicatoandes.cl',
    phone: '+56 9 8765 4321',
    role: 'ALIANZA_ADMIN',
    state: 'ACTIVE',
    lastPortalLoginAt: '2025-01-15T09:30:00Z',
    passwordLastChangedAt: '2024-12-01T10:00:00Z',
    createdAt: '2025-06-10T10:00:00Z',
    updatedAt: '2025-06-10T10:00:00Z',
  },
  {
    id: 'AU-002',
    alianzaId: 'AL-001',
    name: 'Carlos Mendoza Ruiz',
    email: 'carlos.mendoza@sindicatoandes.cl',
    phone: '+56 9 7654 3210',
    role: 'ALIANZA_OPERADOR',
    state: 'ACTIVE',
    lastPortalLoginAt: '2025-01-14T14:20:00Z',
    passwordLastChangedAt: '2024-11-15T09:30:00Z',
    createdAt: '2025-06-12T11:30:00Z',
    updatedAt: '2025-06-12T11:30:00Z',
  },
  {
    id: 'AU-003',
    alianzaId: 'AL-001',
    name: 'Ana Silva Torres',
    email: 'ana.silva@sindicatoandes.cl',
    phone: '+56 9 6543 2109',
    role: 'ALIANZA_OPERADOR',
    state: 'PENDING',
    invitation: {
      status: 'PENDING',
      sentAt: '2025-01-10T12:00:00Z',
    },
    createdAt: '2025-01-10T12:00:00Z',
    updatedAt: '2025-01-10T12:00:00Z',
  },
  // AL-002 users
  {
    id: 'AU-004',
    alianzaId: 'AL-002',
    name: 'Roberto Fernández Castro',
    email: 'roberto.fernandez@brokerpacifico.cl',
    phone: '+56 2 2345 6789',
    role: 'ALIANZA_ADMIN',
    state: 'ACTIVE',
    lastPortalLoginAt: '2025-01-15T08:45:00Z',
    passwordLastChangedAt: '2024-10-20T16:15:00Z',
    createdAt: '2025-07-01T15:30:00Z',
    updatedAt: '2025-07-01T15:30:00Z',
  },
  {
    id: 'AU-005',
    alianzaId: 'AL-002',
    name: 'Patricia González Morales',
    email: 'patricia.gonzalez@brokerpacifico.cl',
    phone: '+56 9 5432 1098',
    role: 'ALIANZA_OPERADOR',
    state: 'BLOCKED',
    passwordLastChangedAt: '2024-09-10T11:20:00Z',
    createdAt: '2025-07-05T09:15:00Z',
    updatedAt: '2025-01-05T13:45:00Z',
  },
];

// Generate additional users for testing
function generateAllianceUsers(count: number): AllianceUser[] {
  const users: AllianceUser[] = [];
  const existingAlianceIds = ['AL-001', 'AL-002'];
  
  for (let i = 0; i < count; i++) {
    const alianzaId = existingAlianceIds[i % existingAlianceIds.length];
    const state = states[i % states.length];
    const role = roles[i % roles.length];
    const baseDate = new Date('2024-06-01');
    const createdAt = new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)).toISOString();
    
    const user: AllianceUser = {
      id: `AU-${String(i + 6).padStart(3, '0')}`,
      alianzaId,
      name: `Usuario Test ${i + 1}`,
      email: `usuario${i + 1}@alianza.com`,
      phone: `+56 9 ${String(Math.floor(Math.random() * 9000) + 1000)} ${String(Math.floor(Math.random() * 9000) + 1000)}`,
      role,
      state,
      createdAt,
      updatedAt: createdAt,
    };

    // Add login date for active users
    if (state === 'ACTIVE') {
      const loginDate = new Date(createdAt);
      loginDate.setDate(loginDate.getDate() + Math.floor(Math.random() * 30));
      user.lastPortalLoginAt = loginDate.toISOString();
      
      const passwordDate = new Date(createdAt);
      passwordDate.setDate(passwordDate.getDate() + Math.floor(Math.random() * 60));
      user.passwordLastChangedAt = passwordDate.toISOString();
    }

    // Add invitation for pending users
    if (state === 'PENDING') {
      const inviteDate = new Date();
      inviteDate.setDate(inviteDate.getDate() - Math.floor(Math.random() * 7));
      user.invitation = {
        status: 'PENDING',
        sentAt: inviteDate.toISOString(),
      };
    }

    users.push(user);
  }
  
  return users;
}

// Combine seed data with generated data
export const allAllianceUsers = [...allianceUsersMock, ...generateAllianceUsers(20)];

// Audit events mock
export const allianceUserAuditEventsMock: AllianceUserAuditEvent[] = [
  {
    id: 'AE-001',
    allianceId: 'AL-001',
    userId: 'AU-001',
    type: 'USER_CREATED',
    at: '2025-06-10T10:00:00Z',
    actor: { id: 'admin-1', name: 'Sistema Admin', role: 'ADMIN' },
  },
  {
    id: 'AE-002',
    allianceId: 'AL-001',
    userId: 'AU-003',
    type: 'INVITATION_SENT',
    at: '2025-01-10T12:00:00Z',
    actor: { id: 'admin-1', name: 'Sistema Admin', role: 'ADMIN' },
    note: 'Invitación enviada por correo',
  },
  {
    id: 'AE-003',
    allianceId: 'AL-002',
    userId: 'AU-005',
    type: 'BLOCK',
    at: '2025-01-05T13:45:00Z',
    actor: { id: 'admin-2', name: 'Juan Pérez', role: 'ADMIN' },
    note: 'Usuario bloqueado por inactividad',
  },
];