import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  UserPlus,
  Download,
  Users,
  AlertCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { AllianceUser, AllianceUserListParams } from '../types/allianceUserTypes';
import type { AllianceUserInput } from '../schemas/allianceUserSchema';
import { AllianceUserFilters } from './AllianceUserFilters';
import { AllianceUserRowActions } from './AllianceUserRowActions';
import { AllianceUserForm } from './AllianceUserForm';

interface AllianceUsersTableProps {
  users: AllianceUser[];
  total: number;
  page: number;
  pageSize: number;
  params: AllianceUserListParams;
  onParamsChange: (params: AllianceUserListParams) => void;
  onCreateUser: (data: AllianceUserInput) => void;
  onEditUser: (userId: string, data: any) => void;
  onBlockUser: (userId: string, note?: string) => void;
  onUnblockUser: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  onResendInvitation: (userId: string) => void;
  onRevokeSessions: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onExport: () => void;
  loading?: boolean;
  alianceName: string;
}

export function AllianceUsersTable({
  users,
  total,
  page,
  pageSize,
  params,
  onParamsChange,
  onCreateUser,
  onEditUser,
  onBlockUser,
  onUnblockUser,
  onResetPassword,
  onResendInvitation,
  onRevokeSessions,
  onDeleteUser,
  onExport,
  loading = false,
  alianceName
}: AllianceUsersTableProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  const getStateDisplay = (state: AllianceUser['state']) => {
    switch (state) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>;
      case 'BLOCKED':
        return <Badge variant="destructive">Bloqueado</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getRoleDisplay = (role: AllianceUser['role']) => {
    return role === 'ALIANZA_ADMIN' ? 'Administrador' : 'Operador';
  };

  const handleSort = (field: any) => {
    const newSortDir = params.sortBy === field && params.sortDir === 'asc' ? 'desc' : 'asc';
    onParamsChange({
      ...params,
      sortBy: field,
      sortDir: newSortDir,
    });
  };

  const handlePageChange = (newPage: number) => {
    onParamsChange({
      ...params,
      page: newPage,
    });
  };

  const handlePageSizeChange = (newPageSize: string) => {
    onParamsChange({
      ...params,
      page: 1,
      pageSize: parseInt(newPageSize),
    });
  };

  const handleFiltersChange = (filters: any) => {
    onParamsChange({
      ...params,
      ...filters,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    onParamsChange({
      page: 1,
      pageSize: params.pageSize,
    });
  };

  const handleViewDetails = (userId: string) => {
    // Details are handled within the row actions component
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios de {alianceName}
            </CardTitle>
            <CardDescription>
              Gestiona los usuarios que acceden al Portal de Alianzas para crear y gestionar solicitudes.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onExport} disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => setShowCreateForm(true)} disabled={loading}>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <AllianceUserFilters
          filters={params}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
        />

        {/* Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Portal de Alianzas</p>
              <p className="text-blue-700 mt-1">
                Los usuarios de esta alianza crean y gestionan solicitudes en el Portal de Alianzas, 
                no tienen acceso al backoffice.
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay usuarios</h3>
            <p className="text-muted-foreground mb-4">
              {total === 0 
                ? 'Esta alianza aún no tiene usuarios registrados.'
                : 'No se encontraron usuarios con los filtros aplicados.'
              }
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear primer usuario
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('name')}
                      className="hover:bg-transparent p-0 h-auto font-medium"
                    >
                      Nombre
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('role')}
                      className="hover:bg-transparent p-0 h-auto font-medium"
                    >
                      Rol
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('state')}
                      className="hover:bg-transparent p-0 h-auto font-medium"
                    >
                      Estado
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('lastPortalLoginAt')}
                      className="hover:bg-transparent p-0 h-auto font-medium"
                    >
                      Último acceso
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('createdAt')}
                      className="hover:bg-transparent p-0 h-auto font-medium"
                    >
                      Creación
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{getRoleDisplay(user.role)}</TableCell>
                    <TableCell>{getStateDisplay(user.state)}</TableCell>
                    <TableCell>{formatDate(user.lastPortalLoginAt)}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <AllianceUserRowActions
                        user={user}
                        onEdit={onEditUser}
                        onBlock={onBlockUser}
                        onUnblock={onUnblockUser}
                        onResetPassword={onResetPassword}
                        onResendInvitation={onResendInvitation}
                        onRevokeSessions={onRevokeSessions}
                        onDelete={onDeleteUser}
                        onViewDetails={handleViewDetails}
                        loading={loading}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} de {total}
                </span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <AllianceUserForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSubmit={onCreateUser}
        loading={loading}
      />
    </Card>
  );
}