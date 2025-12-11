import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ConversationsPage from "./pages/ConversationsPage";
import ChatPage from "./pages/ChatPage";
import AlertsPage from "./pages/AlertsPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import SellerDashboardPage from "./pages/SellerDashboardPage";
import HistoryPage from "./pages/HistoryPage";
import WhatsAppConnectPage from "./pages/WhatsAppConnectPage";
import WhatsAppStatusPage from "./pages/WhatsAppStatusPage";
import SellerWhatsAppSettingsPage from "./pages/SellerWhatsAppSettingsPage";
import ManagerWhatsAppStatusPage from "./pages/ManagerWhatsAppStatusPage";
import SellersPage from "./pages/SellersPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FollowupsSettingsPage from "./pages/FollowupsSettingsPage";
import ManagerGoalsPage from "./pages/ManagerGoalsPage";
import SellerPerformancePage from "./pages/SellerPerformancePage";
import ManagerCycleViewPage from "./pages/ManagerCycleViewPage";
import NotFound from "./pages/NotFound";
import ClientsListPage from "./pages/ClientsListPage";
import Client360Page from "./pages/Client360Page";

// Admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminCompaniesPage from "./pages/admin/AdminCompaniesPage";
import AdminCompanyDetailsPage from "./pages/admin/AdminCompanyDetailsPage";
import AdminManagersPage from "./pages/admin/AdminManagersPage";
import AdminAIScriptsPage from "./pages/admin/AdminAIScriptsPage";
import AdminPlansPage from "./pages/admin/AdminPlansPage";
import AdminMonitorPage from "./pages/admin/AdminMonitorPage";
import AdminSystemHealthPage from "./pages/admin/AdminSystemHealthPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";

// Manager pages
import FinanceiroPage from "./pages/FinanceiroPage";
import ManagerOperationSettingsPage from "./pages/ManagerOperationSettingsPage";

// Trial pages
import TrialPage from "./pages/TrialPage";
import TrialSuccessPage from "./pages/TrialSuccessPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/trial" element={<TrialPage />} />
            <Route path="/trial-success" element={<TrialSuccessPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            
            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/empresas" element={<AdminCompaniesPage />} />
            <Route path="/admin/empresa/:id" element={<AdminCompanyDetailsPage />} />
            <Route path="/admin/gestores" element={<AdminManagersPage />} />
            <Route path="/admin/ai" element={<AdminAIScriptsPage />} />
            <Route path="/admin/planos" element={<AdminPlansPage />} />
            <Route path="/admin/monitor" element={<AdminMonitorPage />} />
            <Route path="/admin/system-health" element={<AdminSystemHealthPage />} />
            <Route path="/admin/payments" element={<AdminPaymentsPage />} />
            
            {/* Seller routes */}
            <Route 
              path="/conversas" 
              element={
                <ProtectedRoute>
                  <ConversationsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat/:id" 
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/alertas" 
              element={
                <ProtectedRoute requiredRole="vendedor">
                  <AlertsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/whatsapp-connect" 
              element={
                <ProtectedRoute requiredRole="vendedor">
                  <WhatsAppConnectPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendedor/whatsapp" 
              element={
                <ProtectedRoute requiredRole="vendedor">
                  <SellerWhatsAppSettingsPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Seller dashboard */}
            <Route 
              path="/dashboard-vendedor" 
              element={
                <ProtectedRoute requiredRole="vendedor">
                  <SellerDashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendedor/performance" 
              element={
                <ProtectedRoute requiredRole="vendedor">
                  <SellerPerformancePage />
                </ProtectedRoute>
              } 
            />
            {/* Manager routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <ManagerDashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/historico" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <HistoryPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/whatsapp-status" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <WhatsAppStatusPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/whatsapp-status" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <ManagerWhatsAppStatusPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/vendedores" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <SellersPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/followups" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <FollowupsSettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/metas" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <ManagerGoalsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/ciclos/:cycleId" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <ManagerCycleViewPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/financeiro" 
              element={
                <ProtectedRoute requiredRole="gestor" allowRestrictedAccess={true}>
                  <FinanceiroPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gestor/configuracoes" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <ManagerOperationSettingsPage />
                </ProtectedRoute>
              } 
            />

            {/* Client 360 routes - accessible by both managers and sellers */}
            <Route 
              path="/clientes" 
              element={
                <ProtectedRoute>
                  <ClientsListPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cliente/:clientId" 
              element={
                <ProtectedRoute>
                  <Client360Page />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;