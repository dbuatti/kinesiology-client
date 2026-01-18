import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WaitingRoom from "./pages/WaitingRoom";
import NotFound from "./pages/NotFound";
import ActiveSession from "./pages/ActiveSession";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import NotionConfig from "./pages/NotionConfig";
import AllAppointments from "./pages/AllAppointments";
import AllClients from "./pages/AllClients";
import ProfileSetup from "./pages/ProfileSetup";
import ProtectedRouteLayout from "./components/ProtectedRouteLayout";
import ModeDetailsPage from "./pages/ModeDetailsPage";
import DebugZone from "./pages/DebugZone";
import ReferenceDataProvider from "./components/ReferenceDataProvider"; // Import new provider

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} /> {/* Catch-all for unmatched routes */}

          {/* Protected Routes with Layout */}
          <Route element={<ProtectedRouteLayout />}>
            <Route element={<ReferenceDataProvider />}> {/* Wrap protected routes that need reference data */}
              <Route path="/" element={<WaitingRoom />} />
              <Route path="/active-session/:appointmentId" element={<ActiveSession />} />
              <Route path="/debug-zone" element={<DebugZone />} />
              <Route path="/notion-config" element={<NotionConfig />} />
              <Route path="/all-appointments" element={<AllAppointments />} />
              <Route path="/all-clients" element={<AllClients />} />
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/mode-details/:modeId" element={<ModeDetailsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;