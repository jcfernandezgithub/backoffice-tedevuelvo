import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { TopBar } from "@/components/app/TopBar";
import { AuthProvider } from "@/state/AuthContext";
import ProtectedRoute from "@/routes/ProtectedRoute";
import AdminRoute from "@/routes/AdminRoute";
import Login from "@/pages/auth/Login";
import Dashboard from "@/pages/Dashboard";
import SolicitudesList from "@/pages/Solicitudes/List";
import SolicitudDetail from "@/pages/Solicitudes/Detail";
import GestionCallCenterList from "@/pages/GestionCallCenter/List";
import GestionCallCenterDetail from "@/pages/GestionCallCenter/Detail";
import AlianzasList from "@/pages/Alianzas/List";
import AlianzaDetail from "@/pages/Alianzas/Detail";
import Operacion from "@/pages/Operacion";
import UsuariosPage from "@/pages/Usuarios";
import RefundsList from "@/pages/Refunds/List";
import RefundDetail from "@/pages/Refunds/Detail";
import CalculadoraPage from "@/pages/Calculadora";
import AjustesPage from "@/pages/Ajustes";
const queryClient = new QueryClient();

const Shell = () => (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <div className="flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Shell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/solicitudes" element={<SolicitudesList />} />
                <Route path="/solicitudes/:id" element={<SolicitudDetail />} />
                <Route path="/gestion-callcenter" element={<GestionCallCenterList />} />
                <Route path="/gestion-callcenter/:id" element={<GestionCallCenterDetail />} />
                <Route path="/alianzas" element={<AlianzasList />} />
                <Route path="/alianzas/:id" element={<AlianzaDetail />} />
                
                <Route path="/operacion" element={<Operacion />} />
                <Route path="/usuarios" element={<UsuariosPage />} />
                <Route path="/calculadora" element={<CalculadoraPage />} />
                <Route path="/ajustes" element={<AjustesPage />} />
              </Route>
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<Shell />}>
                <Route path="/refunds" element={<RefundsList />} />
                <Route path="/refunds/:id" element={<RefundDetail />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
