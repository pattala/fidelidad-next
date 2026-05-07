import { createBrowserRouter, Navigate } from "react-router-dom";
import React, { lazy, Suspense } from "react";
import { LoginPage } from "./modules/admin/pages/LoginPage";
import { AdminLayout } from "./modules/admin/components/AdminLayout";
import { AuthGuard } from "./modules/admin/components/AuthGuard";
import { ClientLayout } from "./modules/client/components/ClientLayout";
import { ClientHomePage } from "./modules/client/pages/ClientHomePage";
import { ClientRewardsPage } from "./modules/client/pages/ClientRewardsPage";
import { ClientLoginPage } from "./modules/client/pages/ClientLoginPage";
import { ClientRegisterPage } from "./modules/client/pages/ClientRegisterPage";
import { ClientProfilePage } from "./modules/client/pages/ClientProfilePage";
import { ClientActivityPage } from "./modules/client/pages/ClientActivityPage";
import { ClientInboxPage } from "./modules/client/pages/ClientInboxPage";
import { ClientPromosPage } from "./modules/client/pages/ClientPromosPage";
import { ClientReferralsPage } from "./modules/client/pages/ClientReferralsPage";
import { ClientAuthGuard } from "./modules/client/components/ClientAuthGuard";
import { ClientAuthProvider } from "./modules/client/contexts/ClientAuthContext";

// Lazy Loading para Módulos de Administración (Pesados)
const DashboardPage = lazy(() => import("./modules/admin/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ConfigPage = lazy(() => import("./modules/admin/pages/ConfigPage").then(m => ({ default: m.ConfigPage })));
const ClientsPage = lazy(() => import("./modules/admin/pages/ClientsPage").then(m => ({ default: m.ClientsPage })));
const CampaignsPage = lazy(() => import("./modules/admin/pages/CampaignsPage").then(m => ({ default: m.CampaignsPage })));
const PrizesPage = lazy(() => import("./modules/admin/pages/PrizesPage").then(m => ({ default: m.PrizesPage })));
const MetricsPage = lazy(() => import("./modules/admin/pages/MetricsPage").then(m => ({ default: m.MetricsPage })));
const WhatsAppPage = lazy(() => import("./modules/admin/pages/WhatsAppPage").then(m => ({ default: m.WhatsAppPage })));
const PushPage = lazy(() => import("./modules/admin/pages/PushPage").then(m => ({ default: m.PushPage })));
const AdminProfilePage = lazy(() => import("./modules/admin/pages/AdminProfilePage").then(m => ({ default: m.AdminProfilePage })));
const SystemLogsPage = lazy(() => import("./modules/admin/pages/SystemLogsPage").then(m => ({ default: m.SystemLogsPage })));

// Componente para manejar la carga de los módulos lazy
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

export const router = createBrowserRouter([
    // Client App (PWA)
    {
        path: "/login",
        element: <ClientLoginPage />
    },
    {
        path: "/register",
        element: <ClientRegisterPage />
    },
    {
        element: (
            <ClientAuthProvider>
                <ClientAuthGuard>
                    <ClientLayout />
                </ClientAuthGuard>
            </ClientAuthProvider>
        ),
        children: [
            {
                index: true,
                element: <ClientHomePage />
            },
            {
                path: "promos",
                element: <ClientPromosPage />
            },
            {
                path: "rewards",
                element: <ClientRewardsPage />
            },
            {
                path: "perfil",
                element: <ClientProfilePage />
            },
            {
                path: "profile",
                element: <Navigate to="/perfil" replace />
            },
            {
                path: "activity",
                element: <ClientActivityPage />
            },
            {
                path: "inbox",
                element: <ClientInboxPage />
            },
            {
                path: "referrals",
                element: <ClientReferralsPage />
            },
        ]
    },

    {
        path: "/admin",
        element: <Navigate to="/admin/login" replace />,
    },
    {
        path: "/admin/login",
        element: <LoginPage />,
    },
    {
        path: "/admin", // Parent route for authenticated pages
        element: <AuthGuard><AdminLayout /></AuthGuard>,
        children: [
            {
                path: "dashboard",
                element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>
            },
            {
                path: "clients",
                element: <Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>
            },
            {
                path: "campaigns",
                element: <Suspense fallback={<PageLoader />}><CampaignsPage /></Suspense>
            },
            {
                path: "prizes",
                element: <Suspense fallback={<PageLoader />}><PrizesPage /></Suspense>
            },
            {
                path: "metrics",
                element: <Suspense fallback={<PageLoader />}><MetricsPage /></Suspense>
            },
            {
                path: "config",
                element: <Suspense fallback={<PageLoader />}><ConfigPage /></Suspense>
            },
            {
                path: "logs",
                element: <Suspense fallback={<PageLoader />}><SystemLogsPage /></Suspense>
            },
            {
                path: "whatsapp",
                element: <Suspense fallback={<PageLoader />}><WhatsAppPage /></Suspense>
            },
            {
                path: "push",
                element: <Suspense fallback={<PageLoader />}><PushPage /></Suspense>
            },
            {
                path: "profile",
                element: <Suspense fallback={<PageLoader />}><AdminProfilePage /></Suspense>
            }
        ]
    }
]);


