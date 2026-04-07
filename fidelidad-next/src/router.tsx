import { createBrowserRouter, Navigate } from "react-router-dom";
import React, { Suspense } from 'react';

// Cargador de carga (Fallback)
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
);

// Administrador - Carga Diferida
const LoginPage = React.lazy(() => import("./modules/admin/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = React.lazy(() => import("./modules/admin/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ConfigPage = React.lazy(() => import("./modules/admin/pages/ConfigPage").then(m => ({ default: m.ConfigPage })));
const ClientsPage = React.lazy(() => import("./modules/admin/pages/ClientsPage").then(m => ({ default: m.ClientsPage })));
const CampaignsPage = React.lazy(() => import("./modules/admin/pages/CampaignsPage").then(m => ({ default: m.CampaignsPage })));
const PrizesPage = React.lazy(() => import("./modules/admin/pages/PrizesPage").then(m => ({ default: m.PrizesPage })));
const MetricsPage = React.lazy(() => import("./modules/admin/pages/MetricsPage").then(m => ({ default: m.MetricsPage })));
const WhatsAppPage = React.lazy(() => import("./modules/admin/pages/WhatsAppPage").then(m => ({ default: m.WhatsAppPage })));
const PushPage = React.lazy(() => import("./modules/admin/pages/PushPage").then(m => ({ default: m.PushPage })));
const AdminProfilePage = React.lazy(() => import("./modules/admin/pages/AdminProfilePage").then(m => ({ default: m.AdminProfilePage })));
const SystemLogsPage = React.lazy(() => import("./modules/admin/pages/SystemLogsPage").then(m => ({ default: m.SystemLogsPage })));

// Cliente - Carga Diferida
const ClientHomePage = React.lazy(() => import("./modules/client/pages/ClientHomePage").then(m => ({ default: m.ClientHomePage })));
const ClientRewardsPage = React.lazy(() => import("./modules/client/pages/ClientRewardsPage").then(m => ({ default: m.ClientRewardsPage })));
const ClientLoginPage = React.lazy(() => import("./modules/client/pages/ClientLoginPage").then(m => ({ default: m.ClientLoginPage })));
const ClientRegisterPage = React.lazy(() => import("./modules/client/pages/ClientRegisterPage").then(m => ({ default: m.ClientRegisterPage })));
const ClientProfilePage = React.lazy(() => import("./modules/client/pages/ClientProfilePage").then(m => ({ default: m.ClientProfilePage })));
const ClientActivityPage = React.lazy(() => import("./modules/client/pages/ClientActivityPage").then(m => ({ default: m.ClientActivityPage })));
const ClientInboxPage = React.lazy(() => import("./modules/client/pages/ClientInboxPage").then(m => ({ default: m.ClientInboxPage })));
const ClientPromosPage = React.lazy(() => import("./modules/client/pages/ClientPromosPage").then(m => ({ default: m.ClientPromosPage })));
const ClientReferralsPage = React.lazy(() => import("./modules/client/pages/ClientReferralsPage").then(m => ({ default: m.ClientReferralsPage })));

// Componentes Core (Se mantienen estáticos para evitar parpadeos en Layouts)
import { AdminLayout } from "./modules/admin/components/AdminLayout";
import { AuthGuard } from "./modules/admin/components/AuthGuard";
import { ClientLayout } from "./modules/client/components/ClientLayout";
import { ClientAuthGuard } from "./modules/client/components/ClientAuthGuard";
import { ClientAuthProvider } from "./modules/client/contexts/ClientAuthContext";

export const router = createBrowserRouter([
    // Client App (PWA)
    {
        path: "/login",
        element: <Suspense fallback={<PageLoader />}><ClientLoginPage /></Suspense>
    },
    {
        path: "/register",
        element: <Suspense fallback={<PageLoader />}><ClientRegisterPage /></Suspense>
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
                element: <Suspense fallback={<PageLoader />}><ClientHomePage /></Suspense>
            },
            {
                path: "promos",
                element: <Suspense fallback={<PageLoader />}><ClientPromosPage /></Suspense>
            },
            {
                path: "rewards",
                element: <Suspense fallback={<PageLoader />}><ClientRewardsPage /></Suspense>
            },
            {
                path: "profile",
                element: <Suspense fallback={<PageLoader />}><ClientProfilePage /></Suspense>
            },
            {
                path: "activity",
                element: <Suspense fallback={<PageLoader />}><ClientActivityPage /></Suspense>
            },
            {
                path: "inbox",
                element: <Suspense fallback={<PageLoader />}><ClientInboxPage /></Suspense>
            },
            {
                path: "referrals",
                element: <Suspense fallback={<PageLoader />}><ClientReferralsPage /></Suspense>
            },
        ]
    },

    {
        path: "/admin",
        element: <Navigate to="/admin/login" replace />,
    },
    {
        path: "/admin/login",
        element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>,
    },
    {
        path: "/admin",
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

