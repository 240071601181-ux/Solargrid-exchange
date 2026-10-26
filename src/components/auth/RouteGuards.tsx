import { ArrowRight, LockKeyhole, SunMedium } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { homeForRole, useAuth } from "../../context/AuthProvider";
import type { AuthRole } from "../../types/api";
import { Button } from "../common/Button";

export function FullPageGate({ message = "Restoring your secure session…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-ink-900 shadow-raised">
          <SunMedium className="size-6 text-energy-500" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-ink-900">SolarGrid Exchange</p>
        <p className="mt-1 text-xs text-slate-500">{message}</p>
        <span className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-energy-500" />
        </span>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageGate />;
  if (status === "anonymous") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: AuthRole }) {
  const { user, status } = useAuth();
  if (status === "loading") return <FullPageGate />;
  if (status === "anonymous" || !user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <ForbiddenPanel role={role} />;
  }
  return <Outlet />;
}

function ForbiddenPanel({ role }: { role: AuthRole }) {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="card w-full max-w-md px-6 py-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-critical-50 text-critical-500">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-900">This workspace is restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account is signed in as {user?.role ?? "another role"}. The {role} workspace is not available to this
          account.
        </p>
        <div className="mt-5 flex justify-center">
          <Link to={user ? homeForRole(user.role) : "/login"}>
            <Button variant="primary" icon={<ArrowRight className="size-4" />}>
              Go to my workspace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageGate message="Checking for an existing session…" />;
  if (status === "authenticated" && user) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}
