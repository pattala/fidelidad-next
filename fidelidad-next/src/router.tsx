import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "./modules/admin/pages/LoginPage";
import { AdminLayout } from "./modules/admin/components/AdminLayout";
import { DashboardPage } from "./modules/admin/pages/DashboardPage";
import { ConfigPage } from "./modules/admin/pages/ConfigPage";
import { ClientsPage } from "./modules/admin/pages/ClientsPage";
import { AuthGuard } from "./modules/admin/components/AuthGuard";
import { CampaignsPage } from "./modules/admin/pages/CampaignsPage";
import { PrizesPage } from "./modules/admin/pages/PrizesPage";
import { MetricsPage } from "./modules/admin/pages/MetricsPage";
import { WhatsAppPage } from "./modules/admin/pages/WhatsAppPage";
import { PushPage } from "./modules/admin/pages/PushPage"; // Added import
import { ClientLayout } from "./modules/client/components/ClientLayout";
import { ClientHomePage } from "./modules/client/pages/ClientHomePage";
import { ClientRewardsPage } from "./modules/client/pages/ClientRewardsPage";
import { ClientLoginPage } from "./modules/client/pages/ClientLoginPage";
import { ClientRegisterPage } from "./modules/client/pages/ClientRegisterPage";
import { ClientProfilePage } from "./modules/client/pages/ClientProfilePage";
import { ClientActivityPage } from "./modules/client/pages/ClientActivityPage";
import { ClientInboxPage } from "./modules/client/pages/ClientInboxPage";
import { ClientPromosPage } from "./modules/client/pages/ClientPromosPage";
import { ClientAuthGuard } from "./modules/client/components/ClientAuthGuard";

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
        path: "/",
        element: (
            <ClientAuthGuard>
                <ClientLayout />
            </ClientAuthGuard>
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
                path: "profile",
                element: <ClientProfilePage />
            },
            {
                path: "activity",
                element: <ClientActivityPage />
            },
            {
                path: "inbox",
                element: <ClientInboxPage />
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
                element: <DashboardPage />
            },
            {
                path: "clients",
                element: <ClientsPage />
            },
            {
                path: "campaigns",
                element: <CampaignsPage />
            },
            {
                path: "prizes",
                element: <PrizesPage />
            },
            {
                path: "metrics",
                element: <MetricsPage />
            },
            {
                path: "config",
                element: <ConfigPage />
            },
            {
                path: "whatsapp",
                element: <WhatsAppPage />
            },
            {
                path: "push",
                element: <PushPage />
            }
        ]
    }
]);
