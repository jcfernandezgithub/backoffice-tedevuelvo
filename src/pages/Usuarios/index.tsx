import { useState } from 'react';
import { Plus, Download, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserTable } from './components/UserTable';
import { UserForm } from './components/UserForm';
import { UserDetailsDrawer } from './components/UserDetailsDrawer';
import { UserFilters } from './components/UserFilters';
import { useUsers, useBulkAction } from './hooks/useUsers';
import type { User, UserListParams } from './types/userTypes';

function UsuariosPage() {
  const [params, setParams] = useState<UserListParams>({
    page: 1,
    pageSize: 10
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: usersData, isLoading } = useUsers(params);
  const bulkAction = useBulkAction();

  const handleParamsChange = (newParams: UserListParams) => {
    setParams(newParams);
    setSelectedUsers([]); // Clear selection when params change
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setParams({
      ...params,
      pageSize: parseInt(newPageSize),
      page: 1
    });
  };

  const handlePreviousPage = () => {
    if (params.page && params.page > 1) {
      setParams({ ...params, page: params.page - 1 });
    }
  };

  const handleNextPage = () => {
    if (usersData && params.page && params.page < usersData.totalPages) {
      setParams({ ...params, page: params.page + 1 });
    }
  };

  const handleBulkBlock = () => {
    bulkAction.mutate({
      userIds: selectedUsers,
      action: 'block'
    });
    setSelectedUsers([]);
  };

  const handleBulkUnblock = () => {
    bulkAction.mutate({
      userIds: selectedUsers,
      action: 'unblock'
    });
    setSelectedUsers([]);
  };

  const handleExport = () => {
    if (!usersData?.users) return;

    const headers = ['Nombre', 'Correo', 'Teléfono', 'Perfil', 'Estado', 'Último acceso', 'Creación'];
    const csvContent = [
      headers.join(','),
      ...usersData.users.map(user => [
        user.name,
        user.email,
        user.phone,
        user.role === 'ADMIN' ? 'Administrador' : 'Consultor',
        user.state === 'ACTIVE' ? 'Activo' : user.state === 'BLOCKED' ? 'Bloqueado' : 'Pendiente',
        user.lastLoginAt || 'Nunca',
        user.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Usuarios
          </h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios del sistema y sus permisos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!usersData?.users?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats */}
      {usersData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{usersData.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-semibold text-green-600">
                  {usersData.users.filter(u => u.state === 'ACTIVE').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-semibold text-amber-600">
                  {usersData.users.filter(u => u.state === 'PENDING').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bloqueados</p>
                <p className="text-2xl font-semibold text-red-600">
                  {usersData.users.filter(u => u.state === 'BLOCKED').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <UserFilters params={params} onParamsChange={handleParamsChange} />

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedUsers.length} usuario{selectedUsers.length > 1 ? 's' : ''} seleccionado{selectedUsers.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkBlock}
              disabled={bulkAction.isPending}
            >
              Bloquear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkUnblock}
              disabled={bulkAction.isPending}
            >
              Desbloquear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <UserTable
        users={usersData?.users || []}
        loading={isLoading}
        params={params}
        onParamsChange={handleParamsChange}
        selectedUsers={selectedUsers}
        onSelectionChange={setSelectedUsers}
        onUserSelect={setSelectedUser}
      />

      {/* Pagination */}
      {usersData && usersData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {((params.page || 1) - 1) * (params.pageSize || 10) + 1} a{' '}
              {Math.min((params.page || 1) * (params.pageSize || 10), usersData.total)} de{' '}
              {usersData.total} usuarios
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={params.pageSize?.toString() || '10'}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!params.page || params.page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!params.page || params.page >= usersData.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Forms and Dialogs */}
      <UserForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
      />

      <UserDetailsDrawer
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      />
    </div>
  );
}

export default UsuariosPage;