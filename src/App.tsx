import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ActiveSession from "./pages/ActiveSession";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import NotionConfig from "./pages/NotionConfig";
import AllAppointments from "./pages/AllAppointments";
import AllClients from "./pages/AllClients";
import ProfileSetup from "./pages/ProfileSetup"; // New import

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/active-session" element={<ActiveSession />} />
          <Route path="/notion-config" element={<NotionConfig />} />
          <Route path="/all-appointments" element={<AllAppointments />} />
          <Route path="/all-clients" element={<AllClients />} />
          <Route path="/profile-setup" element={<ProfileSetup />} /> {/* New route */}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;