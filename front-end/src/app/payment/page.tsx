"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Loader2,
  MapPin,
  Menu,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Wallet,
} from "lucide-react";

import { MenuPanel } from "../../components/MenuPanel";
import { SideMenu } from "../../components/SideMenu";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { AuthError, fetchCharger, fetchPaymentMethods, runMockCharge } from "../../utils/api";
import type { Charger } from "../../types/charger";

interface PaymentMethod {
  id: number;
  provider: string;
  tokenLast4: string;
  status: string;
}

function formatAmount(amount: number) {
  if (!Number.isFinite(amount)) return "—";
  return `EUR ${amount.toFixed(2)}`;
}

export default function PaymentScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chargerIdParam = searchParams.get("chargerId");
  const providedName = searchParams.get("name") ?? undefined;
  const providedAddress = searchParams.get("address") ?? undefined;
  const providedPrice = searchParams.get("pricePerKwh");
  const providedKwh = searchParams.get("kwh");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [charger, setCharger] = useState<Charger | null>(null);
  const [loadingCharger, setLoadingCharger] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [energyKwh, setEnergyKwh] = useState(() => {
    const parsed = Number(providedKwh ?? 12);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pricePerKwh = useMemo(() => {
    if (charger?.kwhprice) return charger.kwhprice;
    const parsed = Number(providedPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [charger?.kwhprice, providedPrice]);

  useEffect(() => {
    if (!chargerIdParam) return;

    setLoadingCharger(true);
    fetchCharger(chargerIdParam)
      .then((data) => setCharger(data as Charger))
      .catch(() => {})
      .finally(() => setLoadingCharger(false));
  }, [chargerIdParam]);

  useEffect(() => {
    setLoadingMethods(true);
    fetchPaymentMethods()
      .then((list) => setMethods(list as PaymentMethod[]))
      .catch((err: unknown) => {
        if (err instanceof AuthError) {
          setError("Please sign in to continue.");
          router.push("/signin");
          return;
        }
        setError((err as Error)?.message ?? "Unable to load payment methods.");
      })
      .finally(() => setLoadingMethods(false));
  }, [router]);

  const totalAmount = useMemo(() => {
    const result = Number((Math.max(0, energyKwh) * Math.max(0, pricePerKwh)).toFixed(2));
    return Number.isFinite(result) ? result : 0;
  }, [energyKwh, pricePerKwh]);

  const hasMethod = methods.length > 0;
  const primaryMethod = hasMethod ? methods[0] : null;

  const handleSubmit = async () => {
    if (!chargerIdParam) {
      setError("Select a charger first.");
      return;
    }
    if (!hasMethod) {
      setError("Add a payment method in Profile or Billing first.");
      return;
    }
    if (!pricePerKwh || totalAmount <= 0) {
      setError("Enter a valid energy amount.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await runMockCharge({
        chargerId: Number(chargerIdParam),
        amountEur: totalAmount,
        kWh: energyKwh,
      });

      const sessionId = (response as { sessionId?: number }).sessionId;
      const status = (response as { paymentStatus?: string }).paymentStatus ?? "created";
      setSuccess(`Session ${sessionId ?? "new"} • ${status}`);

      setTimeout(() => router.push("/billing"), 1200);
    } catch (err: any) {
      if (err instanceof AuthError) {
        router.push("/signin");
        return;
      }
      setError(err?.message ?? "Payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const ready = Boolean(chargerIdParam) && pricePerKwh > 0 && hasMethod && !submitting;

  return (
    <div className="flex flex-col sm:flex-row h-screen w-full">
      <div className="sm:hidden flex items-center gap-3 p-3 bg-white border-b border-gray-200">
        <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Menu">
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-medium text-gray-900">Payment</h1>
      </div>
      <MenuPanel isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto p-6 sm:p-8 lg:p-12 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl text-gray-900">Confirm payment</h1>
              <p className="text-sm text-gray-500">Uses your saved card to simulate a charging session.</p>
            </div>
            <Button variant="ghost" onClick={() => router.back()} className="hidden sm:inline-flex">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
              <CheckCircle className="w-4 h-4 mt-0.5" />
              <span>{success}. Added to billing history.</span>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Charge details</CardTitle>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Zap className="w-4 h-4" /> Mock session
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Charger</p>
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-semibold truncate">
                          {providedName ?? charger?.name ?? `Charger #${chargerIdParam ?? "?"}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {providedAddress ?? charger?.address ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Price per kWh</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {pricePerKwh > 0 ? `€${pricePerKwh.toFixed(2)}` : "Not provided"}
                    </p>
                    {loadingCharger && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Updating charger info
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="energy">Energy (kWh)</Label>
                    <span className="text-xs text-gray-500">Adjust to simulate usage</span>
                  </div>
                  <Slider
                    id="energy"
                    min={1}
                    max={120}
                    step={0.5}
                    value={[energyKwh]}
                    onValueChange={(value) => setEnergyKwh(Number(value[0].toFixed(1)))}
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={energyKwh}
                      onChange={(e) => setEnergyKwh(Number(e.target.value))}
                    />
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Estimated total</p>
                      <p className="text-xl font-semibold text-gray-900">{formatAmount(totalAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-start gap-3 text-sm text-gray-700">
                  <ShieldCheck className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    We use your saved payment method to create a mock Stripe payment for this session. The result
                    appears in Billing once it completes.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleSubmit} disabled={!ready} className="min-w-[180px]">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay and create session"}
                  </Button>
                  <Button variant="ghost" onClick={() => router.push("/billing")}>View billing</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Payment method</CardTitle>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" /> Saved
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingMethods ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading methods...
                  </div>
                ) : hasMethod && primaryMethod ? (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 bg-white">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {primaryMethod.provider} •••• {primaryMethod.tokenLast4}
                      </p>
                      <p className="text-xs text-gray-500">Status: {primaryMethod.status}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 bg-white text-sm text-gray-700">
                    <p>No payment methods yet.</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => router.push("/billing")}>Add card</Button>
                      <Button size="sm" variant="outline" onClick={() => router.push("/profile")}>Go to profile</Button>
                    </div>
                  </div>
                )}

                <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5" />
                  <span>Charges use the same mock session backend as Billing. Ensure NEXT_PUBLIC_ENABLE_MOCK_SESSION is enabled.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="hidden sm:block sm:w-80 lg:w-96 flex-shrink-0">
        <SideMenu />
      </div>
    </div>
  );
}
