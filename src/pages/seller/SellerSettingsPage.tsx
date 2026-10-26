import { CheckCircle2, MapPin, Save, ShieldCheck, SunMedium } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input, Select, Toggle } from "../../components/common/Field";
import { Badge } from "../../components/common/Badge";
import { ErrorState, InlineAlert } from "../../components/common/States";
import { MetricSkeleton } from "../../components/common/Skeletons";
import { useSellerProfile } from "../../hooks/queries";
import { useSellerMutations } from "../../hooks/useAccountActions";
import { describeApiError } from "../../api/client";
import { useAuth } from "../../context/AuthProvider";
import { formatNumber } from "../../utils/format";
import type { SellerProfile } from "../../types/api";

const CATEGORIES = [
  { value: "residential", label: "Residential home" },
  { value: "apartment", label: "Apartment" },
  { value: "small_business", label: "Small business" },
  { value: "shop", label: "Shop" },
  { value: "farm", label: "Farm" },
  { value: "other", label: "Other" },
];

export function SellerSettingsPage() {
  const profile = useSellerProfile();

  if (profile.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Profile & settings" description="Loading your account profile." />
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      </PageBody>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Profile & settings" />
        <ErrorState error={profile.error} title="Profile could not be loaded" onRetry={() => void profile.refetch()} />
      </PageBody>
    );
  }
  return <SellerSettingsForm profile={profile.data} />;
}

function SellerSettingsForm({ profile }: { profile: SellerProfile }) {
  const mutations = useSellerMutations();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [locationName, setLocationName] = useState(profile.location_name);
  const [latitude, setLatitude] = useState(profile.latitude);
  const [longitude, setLongitude] = useState(profile.longitude);
  const [category, setCategory] = useState(profile.household_category);
  const [demandBase, setDemandBase] = useState(profile.demand_base_kw);
  const [solarCapacity, setSolarCapacity] = useState(profile.solar_capacity_kw);
  const [hasBattery, setHasBattery] = useState(profile.has_battery);
  const [batteryCapacity, setBatteryCapacity] = useState(profile.battery_capacity_kwh || 5);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    if (displayName.trim().length < 2) {
      setError("Display name must be at least two characters.");
      return;
    }
    if (solarCapacity <= 0 || solarCapacity > 50) {
      setError("Solar capacity must be above 0 and up to 50 kW.");
      return;
    }
    if (hasBattery && (batteryCapacity <= 0 || batteryCapacity > 40)) {
      setError("Battery capacity must be between 0 and 40 kWh.");
      return;
    }
    try {
      await mutations.updateProfile.mutateAsync({
        display_name: displayName.trim(),
        location_name: locationName.trim(),
        latitude,
        longitude,
        household_category: category,
        demand_base_kw: demandBase,
        solar_capacity_kw: solarCapacity,
        has_battery: hasBattery,
        battery_capacity_kwh: hasBattery ? batteryCapacity : 0,
      });
      setSaved(true);
    } catch (caught) {
      setError(describeApiError(caught));
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="Profile & settings"
        description="Your account identity and registered solar system. These values drive the account's private simulation estimates."
        meta={<Badge tone="navy" className="capitalize">{user?.role} account</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          {saved ? (
            <InlineAlert tone="info">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Profile saved and simulation estimates refreshed.
              </span>
            </InlineAlert>
          ) : null}

          <Card>
            <CardHeader title="Account profile" subtitle="Displayed on your marketplace offers" icon={<SunMedium className="size-4" aria-hidden="true" />} />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <div>
                  <p className="mb-1.5 block text-xs font-medium text-slate-700">Sign-in email</p>
                  <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    {user?.email}
                  </div>
                </div>
              </div>
              <Input label="Location" value={locationName} onChange={(event) => setLocationName(event.target.value)} hint="Context label; coordinates drive the MCP forecast." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Latitude" type="number" step={0.001} value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} />
                <Input label="Longitude" type="number" step={0.001} value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Household type"
                  options={CATEGORIES}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
                <Input
                  label="Baseline demand (kW)"
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={demandBase}
                  onChange={(event) => setDemandBase(Number(event.target.value))}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Solar system" subtitle="Installed equipment assumed by the simulation" icon={<SunMedium className="size-4" aria-hidden="true" />} />
            <CardBody className="space-y-4">
              <Input
                label="Installed solar capacity (kW)"
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={solarCapacity}
                onChange={(event) => setSolarCapacity(Number(event.target.value))}
                hint={`${formatNumber(solarCapacity, 2)} kW panels in the generation model.`}
              />
              <Toggle
                label="Home battery"
                description="A battery shifts simulated energy and changes the state-of-charge display."
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
                  hint="Battery state is reset to 55% when capacity changes."
                />
              ) : null}
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={mutations.updateProfile.isPending} icon={<Save className="size-4" />}>
              Save profile
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Session security" subtitle="How this account is protected" icon={<ShieldCheck className="size-4" aria-hidden="true" />} />
            <CardBody className="space-y-2.5 text-[11.5px] leading-5 text-slate-500">
              <p>• Authentication uses an opaque server-side session in an HttpOnly cookie.</p>
              <p>• State-changing API requests require a double-submit CSRF token.</p>
              <p>• Passwords are stored as Argon2id hashes, never in browser storage.</p>
              <p>• Seller-only data is authorized by the backend, not hidden by the interface alone.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Location context" subtitle="Perur, Coimbatore" icon={<MapPin className="size-4" aria-hidden="true" />} />
            <CardBody className="text-[11.5px] leading-5 text-slate-500">
              <p>
                Coordinates are used for weather-backed generation estimates. Changing them updates your account's
                forecast location but not the operator's system-wide simulation configuration.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Operator accounts" subtitle="Provisioned outside public registration" />
            <CardBody className="text-[11.5px] leading-5 text-slate-500">
              Public registration cannot create admin accounts. Operators are provisioned with the backend CLI or
              deployment environment variables.
            </CardBody>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
