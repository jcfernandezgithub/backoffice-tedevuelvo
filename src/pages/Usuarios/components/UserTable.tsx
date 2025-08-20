import { useState } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { User, UserListParams } from '../types/userTypes';
import { UserRowActions } from './UserRowActions';
import { Skeleton } from '@/components/ui/skeleton';

interface UserTableProps {
  users: User[];
  loading?: boolean;
  params: UserListParams;
  onParamsChange: (params: UserListParams) => void;
  selectedUsers: string[];
  onSelectionChange: (userIds: string[]) => void;
  onUserSelect: (user: User) => void;
}

const roleLabels = {
  ADMIN: 'Administrador',
  CONSULTANT: 'Consultor'
};

const stateLabels = {
  ACTIVE: 'Activo',
  BLOCKED: 'Bloqueado',
  PENDING: 'Pendiente'
};

const stateVariants = {
  ACTIVE: 'default' as const,
  BLOCKED: 'destructive' as const,
  PENDING: 'secondary' as const
};

export function UserTable({
  users,
  loading,
  params,
  onParamsChange,
  selectedUsers,
  onSelectionChange,
  onUserSelect
}: UserTableProps) {
  const handleSort = (field: keyof User) => {
    const isCurrentSort = params.sortBy === field;
    const newDirection = isCurrentSort && params.sortDir === 'asc' ? 'desc' : 'asc';
    
    onParamsChange({
      ...params,
      sortBy: field,
      sortDir: newDirection
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(users.map(u => u.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedUsers, userId]);
    } else {
      onSelectionChange(selectedUsers.filter(id => id !== userId));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSortIcon = (field: keyof User) => {
    if (params.sortBy !== field) return null;
    return params.sortDir === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Seleccionar todos los usuarios"
              />
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('name')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Nombre
                {getSortIcon('name')}
              </Button>
            </TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('role')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Perfil
                {getSortIcon('role')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('state')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Estado
                {getSortIcon('state')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('lastLoginAt')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Último acceso
                {getSortIcon('lastLoginAt')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('createdAt')}
                className="h-auto p-0 font-medium hover:bg-transparent"
              >
                Creación
                {getSortIcon('createdAt')}
              </Button>
            </TableHead>
            <TableHead className="w-12">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow 
              key={user.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onUserSelect(user)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                  aria-label={`Seleccionar ${user.name}`}
                />
              </TableCell>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell className="text-muted-foreground">{user.phone}</TableCell>
              <TableCell>
                <Badge variant="outline">{roleLabels[user.role]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={stateVariants[user.state]}>
                  {stateLabels[user.state]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <UserRowActions user={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}