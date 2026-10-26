import { BatteryCharging, Check, Home, Store, SunMedium } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Button } from "../../components/common/Button";
import { Input, Select, Toggle } from "../../components/common/Field";
import { InlineAlert } from "../../components/common/States";
import { describeApiError } from "../../api/client";
import { homeForRole, useAuth, type RegistrationInput } from "../../context/AuthProvider";
import { cn } from "../../utils/cn";

type Role = "seller" | "buyer";
type Errors = Partial<Record<keyof RegistrationInput | "terms" | "confirm_password", string>>;

const CATEGORIES = [
  { value: "residential", label: "Residential home" },
  { value: "apartment", label: "Apartment" },
  { value: "small_business", label: "Small business" },
  { value: "shop", label: "Shop" },
  { value: "farm", label: "Farm" },
  { value: "other", label: "Other" },
];

const DEMAND_DEFAULTS: Record<string, number> = {
  residential: 0.9,
  apartment: 0.7,
  small_business: 1.4,
  shop: 1.1,
  farm: 1.6,
  other: 0.9,
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("seller");
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [locationName, setLocationName] = useState("Perur, Coimbatore, Tamil Nadu");
  const [category, setCategory] = useState("residential");
  const [demandBase, setDemandBase] = useState(0.9);
  const [solarCapacity, setSolarCapacity] = useState(3.0);
  const [hasBattery, setHasBattery] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(5.0);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseRole = (next: Role) => {
    setRole(next);
    setErrors({});
    if (next === "buyer") {
      setSolarCapacity(0);
      setHasBattery(false);
    } else {
      setSolarCapacity(3.0);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (fullName.trim().length < 2) nextErrors.full_name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (password.length < 10) nextErrors.password = "Use at least 10 characters.";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      nextErrors.password = "Include at least one letter and one number.";
    if (password !== confirmPassword) nextErrors.confirm_password = "Passwords do not match.";
    if (locationName.trim().length < 2) nextErrors.location_name = "Enter your location.";
    if (demandBase < 0.1 || demandBase > 20) nextErrors.demand_base_kw = "Demand must be between 0.1 and 20 kW.";
    if (role === "seller" && (solarCapacity <= 0 || solarCapacity > 50))
      nextErrors.solar_capacity_kw = "Enter an installed solar capacity above 0 and up to 50 kW.";
    if (role === "seller" && hasBattery && (batteryCapacity <= 0 || batteryCapacity > 40))
      nextErrors.battery_capacity_kwh = "Battery capacity must be between 0 and 40 kWh.";
    if (!terms) nextErrors.terms = "Acknowledge the simulation and privacy terms.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setError(null);
    setSubmitting(true);
    try {
      const user = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role,
        display_name: displayName.trim() || fullName.trim(),
        location_name: locationName.trim(),
        latitude: 10.976,
        longitude: 76.914,
        solar_capacity_kw: role === "seller" ? solarCapacity : undefined,
        has_battery: role === "seller" ? hasBattery : false,
        battery_capacity_kwh: role === "seller" && hasBattery ? batteryCapacity : undefined,
        household_category: category,
        demand_base_kw: demandBase,
        terms_accepted: terms,
      });
      navigate(homeForRole(user.role), { replace: true });
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your exchange account"
      subtitle="Choose how you participate. A public account is always either a seller or a buyer; operator access is provisioned separately."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-ink-900 underline decoration-slate-300 underline-offset-4 hover:decoration-ink-900">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <div role="group" aria-label="Account type" className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-pressed={role === "seller"}
            onClick={() => chooseRole("seller")}
            className={cn(
              "focus-ring rounded-xl border p-3.5 text-left transition-colors",
              role === "seller" ? "border-energy-500 bg-energy-50/60 ring-1 ring-energy-500" : "border-slate-200 bg-white hover:bg-slate-50",
            )}
          >
            <span className="flex items-center justify-between">
              <SunMedium className={cn("size-4.5", role === "seller" ? "text-energy-600" : "text-slate-400")} aria-hidden="true" />
              {role === "seller" ? <Check className="size-3.5 text-energy-600" aria-hidden="true" /> : null}
            </span>
            <span className="mt-2 block text-[13px] font-semibold text-ink-900">Seller</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">Offer rooftop surplus</span>
          </button>
          <button
            type="button"
            aria-pressed={role === "buyer"}
            onClick={() => chooseRole("buyer")}
            className={cn(
              "focus-ring rounded-xl border p-3.5 text-left transition-colors",
              role === "buyer" ? "border-info-500 bg-info-50/60 ring-1 ring-info-500" : "border-slate-200 bg-white hover:bg-slate-50",
            )}
          >
            <span className="flex items-center justify-between">
              <Store className={cn("size-4.5", role === "buyer" ? "text-info-600" : "text-slate-400")} aria-hidden="true" />
              {role === "buyer" ? <Check className="size-3.5 text-info-600" aria-hidden="true" /> : null}
            </span>
            <span className="mt-2 block text-[13px] font-semibold text-ink-900">Buyer</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">Purchase local energy</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={errors.full_name}
            placeholder="Ravi Kumar"
          />
          <Input
            label="Display name"
            hint="Shown on marketplace offers"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={fullName || "Ravi's home"}
            error={errors.display_name}
          />
        </div>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          placeholder="you@example.com"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint="10+ characters, one letter and one number."
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={errors.confirm_password}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Location"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            error={errors.location_name}
            hint="Used for marketplace context only."
          />
          <Select
            label="Household type"
            options={CATEGORIES}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setDemandBase(DEMAND_DEFAULTS[event.target.value] ?? 0.9);
            }}
          />
        </div>
        <Input
          label="Baseline demand (kW)"
          type="number"
          min={0.1}
          max={20}
          step={0.1}
          value={demandBase}
          onChange={(event) => setDemandBase(Number(event.target.value))}
          error={errors.demand_base_kw}
          hint="Simulated hourly demand baseline. Not smart-meter data."
        />

        {role === "seller" ? (
          <div className="space-y-4 rounded-xl border border-line bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <Home className="size-4 text-slate-400" aria-hidden="true" />
              <p className="text-xs font-semibold text-ink-900">Your solar system</p>
            </div>
            <Input
              label="Installed solar capacity (kW)"
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={solarCapacity}
              onChange={(event) => setSolarCapacity(Number(event.target.value))}
              error={errors.solar_capacity_kw}
            />
            <Toggle
              label="Home battery available"
              description="Represented in the simulation; not a hardware integration."
              checked={hasBattery}
              onChange={setHasBattery}
            />
            {hasBattery ? (
              <Input
                label="Battery capacity (kWh)"
                type="number"
                min={0.1}
                max={40}
                step={0.5}
                value={batteryCapacity}
                onChange={(event) => setBatteryCapacity(Number(event.target.value))}
                error={errors.battery_capacity_kwh}
              />
            ) : null}
            <div className="flex gap-2 text-[11px] leading-5 text-slate-500">
              <BatteryCharging className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Estimated surplus reserves are calculated from your capacity and the live MCP weather forecast.</span>
            </div>
          </div>
        ) : null}

        <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5 text-[11.5px] leading-5 text-slate-600">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 text-energy-600 focus:ring-energy-500"
            aria-invalid={Boolean(errors.terms)}
          />
          <span>
            I understand that generation, demand, offers, purchases and earnings are simulated, that weather is real
            provider data retrieved through MCP, and that no financial settlement occurs.
          </span>
        </label>
        {errors.terms ? <p className="-mt-3 text-[11px] text-critical-600">{errors.terms}</p> : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full justify-center">
          Create {role} account
        </Button>
      </form>
    </AuthLayout>
  );
}
