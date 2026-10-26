import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Field";
import { InlineAlert } from "../../components/common/States";
import { describeApiError } from "../../api/client";
import { homeForRole, useAuth } from "../../context/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      const home = homeForRole(user.role);
      const requested = params.get("next");
      const target = requested && requested.startsWith(home) ? requested : home;
      navigate(target, { replace: true });
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to your workspace"
      subtitle="Sellers manage offers and sales. Buyers browse local surplus and track purchases. Operators keep the simulation controls."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-ink-900 underline decoration-slate-300 underline-offset-4 hover:decoration-ink-900">
            Create a seller or buyer account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          autoFocus
        />
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="focus-ring absolute right-1.5 top-[26px] rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          icon={<LogIn className="size-4" />}
          className="w-full justify-center"
        >
          Sign in
        </Button>
      </form>
      <div className="mt-5 rounded-lg border border-line bg-slate-50/80 px-3.5 py-3 text-[11px] leading-5 text-slate-500">
        Operator accounts are provisioned by the deployment administrator and cannot be created through this page.
        Sessions are stored in HttpOnly cookies.
      </div>
    </AuthLayout>
  );
}
