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
import Login from "@/pages/auth/Login";
import Dashboard from "@/pages/Dashboard";
import SolicitudesList from "@/pages/Solicitudes/List";
import SolicitudDetail from "@/pages/Solicitudes/Detail";

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
                <Route path="/alianzas" element={<div className="p-4">Alianzas (en construcción)</div>} />
                <Route path="/alianzas/:id" element={<div className="p-4">Detalle de Alianza (en construcción)</div>} />
                <Route path="/certificados" element={<div className="p-4">Certificados (en construcción)</div>} />
                <Route path="/usuarios" element={<div className="p-4">Usuarios (en construcción)</div>} />
                <Route path="/reportes" element={<div className="p-4">Reportes (en construcción)</div>} />
                <Route path="/ajustes" element={<div className="p-4">Ajustes (en construcción)</div>} />
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
