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
    rut: '18.234.567-8',
    email: 'maria.garcia@sindicatoandes.cl',
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
    rut: '19.456.789-0',
    email: 'carlos.mendoza@sindicatoandes.cl',
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
    rut: '17.890.123-4',
    email: 'ana.silva@sindicatoandes.cl',
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
    rut: '20.123.456-7',
    email: 'roberto.fernandez@brokerpacifico.cl',
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
    rut: '16.789.012-3',
    email: 'patricia.gonzalez@brokerpacifico.cl',
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
    
    // Generate random RUT
    const rutNumber = Math.floor(Math.random() * 15000000) + 10000000;
    const rutFormatted = `${Math.floor(rutNumber / 1000000)}.${Math.floor((rutNumber % 1000000) / 1000)}.${rutNumber % 1000}-${Math.floor(Math.random() * 10)}`;
    
    const user: AllianceUser = {
      id: `AU-${String(i + 6).padStart(3, '0')}`,
      alianzaId,
      name: `Usuario Test ${i + 1}`,
      rut: rutFormatted,
      email: `usuario${i + 1}@alianza.com`,
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

// Export all users including generated ones
export const allAllianceUsers: AllianceUser[] = [
  ...allianceUsersMock,
  ...generateAllianceUsers(0), // Set to 0 to not generate additional users by default
];

// Audit events mock data
export const allianceUserAuditEventsMock: AllianceUserAuditEvent[] = [
  {
    id: 'AE-001',
    allianceId: 'AL-001',
    userId: 'AU-001',
    type: 'USER_CREATED',
    at: '2025-06-10T10:00:00Z',
    actor: { id: 'ADM-001', name: 'Admin Sistema', role: 'ADMIN' },
  },
  {
    id: 'AE-002',
    allianceId: 'AL-001',
    userId: 'AU-003',
    type: 'INVITATION_SENT',
    at: '2025-01-10T12:00:00Z',
    actor: { id: 'ADM-001', name: 'Admin Sistema', role: 'ADMIN' },
    note: 'Invitación inicial enviada',
  },
];
