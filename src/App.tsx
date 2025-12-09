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
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import WhatsAppConnectPage from "./pages/WhatsAppConnectPage";
import WhatsAppStatusPage from "./pages/WhatsAppStatusPage";
import SellersPage from "./pages/SellersPage";
import NotFound from "./pages/NotFound";

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
            
            {/* Seller routes */}
            <Route 
              path="/conversas" 
              element={
                <ProtectedRoute requiredRole="vendedor">
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
            
            {/* Manager routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <DashboardPage />
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
              path="/gestor/vendedores" 
              element={
                <ProtectedRoute requiredRole="gestor">
                  <SellersPage />
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