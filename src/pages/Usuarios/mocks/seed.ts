import type { User, AuditEvent, Role, UserState } from '../types/userTypes';

// Seeded random generator for deterministic results
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff;
  };
}

const roles: Role[] = ['ADMIN', 'CONSULTANT'];
const states: UserState[] = ['ACTIVE', 'BLOCKED', 'PENDING'];

const sampleNames = [
  'María García López', 'Juan Carlos Rodríguez', 'Ana Patricia Silva',
  'Carlos Eduardo Martínez', 'Fernanda Alejandra Torres', 'Roberto Andrés Herrera',
  'Valentina Isabel Morales', 'Diego Sebastián Vargas', 'Camila Antonia Ruiz',
  'Matías Ignacio Castro', 'Javiera Esperanza Núñez', 'Nicolás Benjamín Soto',
  'Isidora Magdalena Contreras', 'Tomás Cristóbal Figueroa', 'Antonella Belén Peña',
  'Maximiliano Agustín Rojas', 'Constanza Emilia Guerrero', 'Vicente Alonso Medina',
  'Sofía Rosario Vega', 'Emilio Francisco Prado'
];

function generateUsers(count: number, seed = 1337): User[] {
  const rnd = seededRandom(seed);
  const users: User[] = [];
  
  for (let i = 0; i < count; i++) {
    const name = sampleNames[Math.floor(rnd() * sampleNames.length)];
    const email = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z.]/g, '') + '@tedevuelvo.cl';
    
    const role = roles[Math.floor(rnd() * roles.length)];
    const state = (() => {
      const p = rnd();
      if (p < 0.7) return 'ACTIVE';
      if (p < 0.85) return 'PENDING';
      return 'BLOCKED';
    })();
    
    const createdDaysAgo = Math.floor(rnd() * 365);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - createdDaysAgo);
    
    const lastLoginDaysAgo = state === 'ACTIVE' ? Math.floor(rnd() * 30) : null;
    const lastLoginAt = lastLoginDaysAgo !== null ? (() => {
      const date = new Date();
      date.setDate(date.getDate() - lastLoginDaysAgo);
      return date.toISOString();
    })() : undefined;
    
    const phone = `+56 9 ${Math.floor(1000 + rnd() * 9000)} ${Math.floor(1000 + rnd() * 9000)}`;
    
    users.push({
      id: `USR-${(1000 + i).toString().padStart(4, '0')}`,
      name,
      email,
      phone,
      role,
      state,
      lastLoginAt,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      invitation: state === 'PENDING' ? {
        status: 'PENDING',
        sentAt: createdAt.toISOString()
      } : undefined,
      security: {
        mfaEnabled: rnd() > 0.7,
        passwordLastChangedAt: createdAt.toISOString()
      }
    });
  }
  
  return users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function generateAuditEvents(users: User[], seed = 1338): AuditEvent[] {
  const rnd = seededRandom(seed);
  const events: AuditEvent[] = [];
  const eventTypes = [
    'LOGIN', 'LOGOUT', 'BLOCK', 'UNBLOCK', 'PASSWORD_RESET', 
    'ROLE_CHANGED', 'INVITATION_SENT', 'USER_CREATED'
  ] as const;
  
  const actors = users.filter(u => u.role === 'ADMIN').slice(0, 3);
  
  users.forEach(user => {
    // User creation event
    events.push({
      id: `EVT-${events.length + 1}`,
      userId: user.id,
      type: 'USER_CREATED',
      at: user.createdAt,
      actor: actors[Math.floor(rnd() * actors.length)] || actors[0]
    });
    
    // Random additional events
    const numEvents = Math.floor(rnd() * 8) + 2;
    for (let i = 0; i < numEvents; i++) {
      const eventType = eventTypes[Math.floor(rnd() * eventTypes.length)];
      const daysAfterCreation = Math.floor(rnd() * 30);
      const eventDate = new Date(user.createdAt);
      eventDate.setDate(eventDate.getDate() + daysAfterCreation);
      
      events.push({
        id: `EVT-${events.length + 1}`,
        userId: user.id,
        type: eventType,
        at: eventDate.toISOString(),
        actor: actors[Math.floor(rnd() * actors.length)] || actors[0],
        note: eventType === 'BLOCK' ? 'Acceso suspendido por política de seguridad' : undefined
      });
    }
  });
  
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

export const usersMock = generateUsers(250, 1337);
export const auditEventsMock = generateAuditEvents(usersMock, 1338);

// Current user mock (for "who performs action")
export const currentUserMock: User = usersMock.find(u => u.role === 'ADMIN') || usersMock[0];