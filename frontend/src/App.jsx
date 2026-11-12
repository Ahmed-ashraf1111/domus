import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
// workspace pages are loaded only when they are opened
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Properties = lazy(() => import("@/pages/Properties"));
const PropertyForm = lazy(() => import("@/pages/PropertyForm"));
const Leads = lazy(() => import("@/pages/Leads"));
const LeadDetails = lazy(() => import("@/pages/LeadDetails"));
const Visits = lazy(() => import("@/pages/Visits"));
const Deals = lazy(() => import("@/pages/Deals"));
const Staff = lazy(() => import("@/pages/Staff"));
const StaffForm = lazy(() => import("@/pages/StaffForm"));
import ErrorPage from "@/pages/ErrorPage";
import WorkspaceLayout from "@/layouts/WorkspaceLayout";
import PublicLayout from "@/layouts/PublicLayout";
import Home from "@/pages/Home";
import PublicProperties from "@/pages/PublicProperties";
import PublicPropertyDetails from "@/pages/PublicPropertyDetails";
import Contact from "@/pages/Contact";
import { useAuth } from "@/context/AuthContext";

// Temporary placeholder until each real page is built
function Placeholder({ title }) {
  return <h1 className="text-2xl font-semibold">{title}</h1>;
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <ErrorPage type="forbidden" />;
  return children;
}

function App() {
  return (
    <Suspense fallback={null}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WorkspaceLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="properties" element={<Properties />} />
        <Route
          path="properties/new"
          element={
            <ProtectedRoute adminOnly>
              <PropertyForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="properties/:id/edit"
          element={
            <ProtectedRoute adminOnly>
              <PropertyForm />
            </ProtectedRoute>
          }
        />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetails />} />
        <Route path="visits" element={<Visits />} />
        <Route path="deals" element={<Deals />} />
        <Route
          path="staff"
          element={
            <ProtectedRoute adminOnly>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="staff/new"
          element={
            <ProtectedRoute adminOnly>
              <StaffForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="staff/:id/edit"
          element={
            <ProtectedRoute adminOnly>
              <StaffForm />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<ErrorPage type="notFound" />} />
      </Route>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/properties" element={<PublicProperties />} />
        <Route path="/properties/:slug" element={<PublicPropertyDetails />} />
        <Route path="/contact" element={<Contact />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  );
}

export default App;