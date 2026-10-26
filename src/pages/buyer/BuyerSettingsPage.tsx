import { CheckCircle2, MapPin, Save, ShieldCheck, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input, Select } from "../../components/common/Field";
import { Badge } from "../../components/common/Badge";
import { ErrorState, InlineAlert } from "../../components/common/States";
import { MetricSkeleton } from "../../components/common/Skeletons";
import { useBuyerProfile } from "../../hooks/queries";
import { useBuyerMutations } from "../../hooks/useAccountActions";
import { describeApiError } from "../../api/client";
import { useAuth } from "../../context/AuthProvider";
import { formatNumber } from "../../utils/format";
import type { BuyerProfile } from "../../types/api";

const CATEGORIES = [
  { value: "residential", label: "Residential home" },
  { value: "apartment", label: "Apartment" },
  { value: "small_business", label: "Small business" },
  { value: "shop", label: "Shop" },
  { value: "farm", label: "Farm" },
  { value: "other", label: "Other" },
];

export function BuyerSettingsPage() {
  const profile = useBuyerProfile();

  if (profile.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Profile & settings" description="Loading your account profile." />
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
        <PageHeader eyebrow="Buyer workspace" title="Profile & settings" />
        <ErrorState error={profile.error} title="Profile could not be loaded" onRetry={() => void profile.refetch()} />
      </PageBody>
    );
  }
  return <BuyerSettingsForm profile={profile.data} />;
}

function BuyerSettingsForm({ profile }: { profile: BuyerProfile }) {
  const mutations = useBuyerMutations();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [locationName, setLocationName] = useState(profile.location_name);
  const [latitude, setLatitude] = useState(profile.latitude);
  const [longitude, setLongitude] = useState(profile.longitude);
  const [category, setCategory] = useState(profile.household_category);
  const [demandBase, setDemandBase] = useState(profile.demand_base_kw);
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
    if (demandBase < 0.1 || demandBase > 20) {
      setError("Baseline demand must be between 0.1 and 20 kW.");
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
      });
      setSaved(true);
    } catch (caught) {
      setError(describeApiError(caught));
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title="Profile & settings"
        description="Your account identity and simulated household demand. Buyers cannot publish offers or access seller controls."
        meta={<Badge tone="navy" className="capitalize">{user?.role} account</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          {saved ? (
            <InlineAlert tone="info">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Profile saved and demand estimates refreshed.
              </span>
            </InlineAlert>
          ) : null}
          <Card>
            <CardHeader title="Buyer profile" subtitle="Used for your private demand estimate" icon={<Zap className="size-4" aria-hidden="true" />} />
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
              <Input label="Location" value={locationName} onChange={(event) => setLocationName(event.target.value)} hint="Context label only; buyer demand is simulated." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Latitude" type="number" step={0.001} value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} />
                <Input label="Longitude" type="number" step={0.001} value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Household type" options={CATEGORIES} value={category} onChange={(event) => setCategory(event.target.value)} />
                <Input
                  label="Baseline demand (kW)"
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={demandBase}
                  onChange={(event) => setDemandBase(Number(event.target.value))}
                  hint={`${formatNumber(demandBase, 2)} kW simulated baseline`}
                />
              </div>
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
              <p>• Opaque server-side session in an HttpOnly cookie.</p>
              <p>• Double-submit CSRF protection on writes.</p>
              <p>• Argon2id password hashing; no credentials in localStorage.</p>
              <p>• Buyer purchase and spending routes reject seller or admin sessions.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Private by default" subtitle="What other accounts can see" icon={<MapPin className="size-4" aria-hidden="true" />} />
            <CardBody className="space-y-2 text-[11.5px] leading-5 text-slate-500">
              <p>
                Sellers only see your display name on purchases against their own offers. They never see your email,
                demand profile or complete purchase history.
              </p>
              <p>Aggregate demand shown to sellers includes counts and baseline totals, not account identities.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
