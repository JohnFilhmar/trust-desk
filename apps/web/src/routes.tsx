import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { RequireSession } from "@/components/RequireSession";
import { AccountPage } from "@/pages/AccountPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { AuditPage } from "@/pages/AuditPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/** Every route of the app. The routes under `RequireSession` need a signed-in user. */
export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: "/", element: <Navigate to="/accounts" replace /> },
      { path: "/accounts", element: <AccountsPage /> },
      { path: "/accounts/:account_id", element: <AccountPage /> },
      { path: "/audit", element: <AuditPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];
