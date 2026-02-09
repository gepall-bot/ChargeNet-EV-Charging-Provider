"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  MapPin,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchCharger, isLoggedIn } from "../utils/api";
import type { CompleteSessionPayload, CompleteSessionResponse } from "../utils/api";
import type { Charger } from "../types/charger";
import { CartoonCar } from "./ui/CartoonCar";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

import { useUserVehicles } from "../hooks/useUserVehicles";
import type { Vehicle } from "../utils/vehicleMapper";

interface ChargerDetailsProps {
  charger: Charger;
  onClose: () => void;
  // reservation actions
  onReserve: (chargerId: string, minutes?: number) => void;
  onCancel: (chargerId: string) => void;
  onCompleteSession: (payload: CompleteSessionPayload) => Promise<CompleteSessionResponse>;

  // reservation state from parent
  isReserved: boolean;
  isReserving: boolean;
  hasActiveReservation: boolean;
  isCompletingSession: boolean;

  // error state from parent
  error: string | null;
  onErrorClose: () => void;

  // timer related
  lastReservationDuration: number;
  lastReservationStartTime: number | null;
}

export function ChargerDetails({
  charger,
  onClose,
  onReserve,
  onCancel,
  onCompleteSession,
  isReserved,
  isReserving,
  hasActiveReservation,
  isCompletingSession,
  error,
  onErrorClose,
  lastReservationDuration,
  lastReservationStartTime,
}: ChargerDetailsProps) {
  const router = useRouter();

  const [timeRemaining, setTimeRemaining] = useState(0);

  // Logic για τα οχήματα (από main)
  const {
    vehicles,
    loading: vehiclesLoading,
    error: vehiclesError,
    notLoggedIn,
    hasNoCars,
  } = useUserVehicles();

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  // Timer logic - calculate remaining time based on start time from parent
  useEffect(() => {
    if (isReserved && lastReservationStartTime !== null && lastReservationDuration > 0) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - lastReservationStartTime) / 1000;
        const remaining = Math.max(0, lastReservationDuration - elapsed);
        setTimeRemaining(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isReserved, lastReservationStartTime, lastReservationDuration]);

  // Reset timer when reservation is cancelled or charger changes
  useEffect(() => {
    if (!isReserved) {
      setTimeRemaining(0);
    }
  }, [isReserved, charger.id]);

  const formatTime = (seconds: number) => {
    const rounded = Math.max(0, Math.round(seconds));
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const connectorLabel = (t?: Charger["connectorType"]) => {
    switch (t) {
      case "CCS":
        return "CCS";
      case "CHADEMO":
        return "CHAdeMO";
      case "TYPE2":
        return "Type 2";
      default:
        return t ?? "Unknown";
    }
  };

  const getStatusColor = () => {
    switch (charger.status) {
      case "available":
        return "text-blue-600 bg-blue-50";
      case "in_use":
        return "text-orange-600 bg-orange-50";
      case "outage":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = () => {
    switch (charger.status) {
      case "available":
        return <CheckCircle className="w-5 h-5" />;
      case "in_use":
        return <Clock className="w-5 h-5" />;
      case "outage":
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (charger.status) {
      case "available":
        return "Available";
      case "in_use":
        return "In Use";
      case "outage":
        return "Out of Service";
      default:
        return "Unknown";
    }
  };

  // Εδώ συνδυάζουμε τα props για το Mobile και το Desktop view
  const contentProps = {
    charger,
    timeRemaining,
    formatTime,
    getStatusColor,
    getStatusIcon,
    getStatusText,
    connectorLabel,
    onReserve,
    onCancel,
    onCompleteSession,
    isReserved,
    isReserving,
    hasActiveReservation,
    isCompletingSession,
    error,
    onErrorClose,
    vehicles,
    vehiclesLoading,
    vehiclesError,
    notLoggedIn,
    hasNoCars,
    selectedVehicle,
    setSelectedVehicle,
    lastReservationDuration,
    lastReservationStartTime,
    goToProfile: () => router.push("/profile"),
    goToSignIn: () => router.push("/signin"),
  };

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[1000] max-h-[75vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <Header title={charger.name ?? "Charger"} onClose={onClose} />
          <ChargerContent {...contentProps} />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block absolute top-4 left-4 bg-white rounded-lg shadow-2xl z-[1000] w-96 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="p-6">
          <Header title={charger.name ?? "Charger"} onClose={onClose} />
          <ChargerContent {...contentProps} />
        </div>
      </div>
    </>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex justify-between items-start mb-4">
      <h2 className="text-xl">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

interface ChargerContentProps {
  charger: Charger;
  timeRemaining: number;
  formatTime: (seconds: number) => string;
  getStatusColor: () => string;
  getStatusIcon: () => React.ReactNode;
  getStatusText: () => string;
  connectorLabel: (t?: Charger["connectorType"]) => string;
  onReserve: (chargerId: string, minutes?: number) => void;
  onCancel: (chargerId: string) => void;
  onCompleteSession: (payload: CompleteSessionPayload) => Promise<CompleteSessionResponse>;
  isReserved: boolean;
  isReserving: boolean;
  hasActiveReservation: boolean;
  isCompletingSession: boolean;
  error: string | null;
  onErrorClose: () => void;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: string | null;
  notLoggedIn: boolean;
  hasNoCars: boolean;
  selectedVehicle: Vehicle | null;
  setSelectedVehicle: (v: Vehicle | null) => void;
  lastReservationDuration: number;
  lastReservationStartTime: number | null;
  goToProfile: () => void;
  goToSignIn: () => void;
}

type SessionFormState = {
  starttime: string;
  endtime: string;
  startsoc: number | null;
  endsoc: number | null;
  totalkwh: number;
  kwhprice: number;
  amount: number;
};

function ChargerContent({
  charger,
  timeRemaining,
  formatTime,
  getStatusColor,
  getStatusIcon,
  getStatusText,
  connectorLabel,
  onReserve,
  onCancel,
  onCompleteSession,
  isReserved,
  isReserving,
  hasActiveReservation,
  isCompletingSession,
  error,
  onErrorClose,
  vehicles,
  vehiclesLoading,
  vehiclesError,
  notLoggedIn,
  hasNoCars,
  selectedVehicle,
  setSelectedVehicle,
  lastReservationDuration,
  lastReservationStartTime,
  goToProfile,
  goToSignIn,
}: ChargerContentProps) {
  // State για το μενού οχημάτων
  const [showVehicleMenu, setShowVehicleMenu] = useState(false);

<<<<<<< Updated upstream
  const price = typeof charger.kwhprice === "number" ? charger.kwhprice : 0;

  // reservation UI state
=======
>>>>>>> Stashed changes
  const [reservationEndTime, setReservationEndTime] = useState<string | null>(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);

  const isGuest = notLoggedIn || !isLoggedIn();
  const reserveDisabled = isGuest || isReserved || isReserving || hasActiveReservation;

// Close the dropdown if selection changes or vehicles refresh
  useEffect(() => {
    setShowVehicleMenu(false);
  }, [selectedVehicle?.id, vehicles.length]);

  // Fetch reservation end time (non-fatal if it fails)
  useEffect(() => {
    let mounted = true;

    async function loadDetails() {
      try {
        const data = await fetchCharger(String(charger.id));
        if (mounted && data?.reservationendtime) {
          setReservationEndTime(String(data.reservationendtime));
        } else if (mounted) {
          setReservationEndTime(null);
        }
      } catch {
        // ignore - non-fatal
      }
    }

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [charger.id]);

  const chargerPowerKW = charger.maxKW ?? 0;
  const pricePerKwh = typeof charger.kwhprice === "number" ? charger.kwhprice : 0;

  const buildDefaultSessionForm = useCallback((): SessionFormState => {
    const now = new Date();
    const startGuess =
      lastReservationStartTime !== null
        ? new Date(lastReservationStartTime)
        : new Date(now.getTime() - 15 * 60 * 1000);
    const endGuess = now.getTime() > startGuess.getTime()
      ? now
      : new Date(startGuess.getTime() + 5 * 60 * 1000);

    const startSoc = selectedVehicle
      ? Math.min(100, Math.max(0, selectedVehicle.currentBatteryLevel))
      : 30;
    const endSoc = Math.min(100, startSoc + 40);

    const usableCapacity = selectedVehicle
      ? selectedVehicle.batteryCapacity
      : Math.max(40, chargerPowerKW * 0.5);
    const socDelta = Math.max(0, endSoc - startSoc);
    const energyFromSoc = usableCapacity * (socDelta / 100);
    const durationHours = Math.max(0.25, (endGuess.getTime() - startGuess.getTime()) / 36e5);
    const energyFallback = chargerPowerKW > 0 ? chargerPowerKW * durationHours * 0.8 : durationHours * 7;
    const energy = Number(Math.max(1, energyFromSoc || energyFallback).toFixed(2));
    const amount = Number((energy * pricePerKwh).toFixed(2));

    return {
      starttime: formatDateInput(startGuess),
      endtime: formatDateInput(endGuess),
      startsoc: startSoc,
      endsoc: endSoc,
      totalkwh: energy,
      kwhprice: pricePerKwh,
      amount,
    };
  }, [lastReservationStartTime, selectedVehicle, chargerPowerKW, pricePerKwh]);

  const [sessionForm, setSessionForm] = useState<SessionFormState>(() => buildDefaultSessionForm());
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState<"form" | "success">("form");
  const [sessionModalError, setSessionModalError] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<CompleteSessionResponse | null>(null);

  useEffect(() => {
    if (!showSessionModal) return;
    setSessionModalMode("form");
    setSessionModalError(null);
    setSessionResult(null);
    setSessionForm(buildDefaultSessionForm());
  }, [showSessionModal, buildDefaultSessionForm]);

  const updateForm = useCallback((patch: Partial<SessionFormState>) => {
    setSessionForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const recalcAmount = useCallback(() => {
    setSessionForm((prev) => ({
      ...prev,
      amount: Number((prev.totalkwh * prev.kwhprice).toFixed(2)),
    }));
  }, []);

  const handleSessionSubmit = useCallback(async () => {
    if (!sessionForm.starttime || !sessionForm.endtime) {
      setSessionModalError("Start and end time are required.");
      return;
    }

    const startDate = new Date(sessionForm.starttime);
    const endDate = new Date(sessionForm.endtime);

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      setSessionModalError("Please provide valid date values.");
      return;
    }

    if (endDate <= startDate) {
      setSessionModalError("End time must be after start time.");
      return;
    }

    if (!sessionForm.totalkwh || sessionForm.totalkwh <= 0) {
      setSessionModalError("Energy used must be greater than zero.");
      return;
    }

    if (!sessionForm.amount || sessionForm.amount <= 0) {
      setSessionModalError("Amount must be greater than zero.");
      return;
    }

    setSessionModalError(null);

    try {
      const payload: CompleteSessionPayload = {
        pointid: charger.id,
        starttime: startDate.toISOString(),
        endtime: endDate.toISOString(),
        startsoc: sessionForm.startsoc,
        endsoc: sessionForm.endsoc,
        totalkwh: sessionForm.totalkwh,
        kwhprice: sessionForm.kwhprice,
        amount: sessionForm.amount,
      };

      const result = await onCompleteSession(payload);
      setSessionResult(result);
      setSessionModalMode("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete session.";
      setSessionModalError(message);
    }
  }, [sessionForm, charger.id, onCompleteSession]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isCompletingSession) return;
      setShowSessionModal(open);
    },
    [isCompletingSession],
  );

  const estimates = useMemo(() => {
    if (!selectedVehicle || chargerPowerKW <= 0) return null;

    const target = 80;
    const energyNeeded =
      (selectedVehicle.batteryCapacity * (target - selectedVehicle.currentBatteryLevel)) / 100;

    const speed = Math.min(chargerPowerKW, selectedVehicle.maxChargingSpeed);
    const timeMinutes = Math.max(0, Math.round((energyNeeded / speed) * 60));
    const cost = energyNeeded * pricePerKwh;

    return {
      timeMinutes,
      cost: cost.toFixed(2),
      energyNeeded: energyNeeded.toFixed(1),
      target,
    };
  }, [selectedVehicle, chargerPowerKW, pricePerKwh]);

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>

      {/* Vehicle / Estimates */}
      {charger.status === "available" && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3">
          {vehiclesLoading && <p className="text-sm text-gray-600">Loading your cars…</p>}

          {!vehiclesLoading && notLoggedIn && (
            <>
              <p className="text-sm text-gray-700">Sign in to see charging estimates.</p>
              <button
                type="button"
                onClick={goToSignIn}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Go to Profile / Sign in
              </button>
            </>
          )}

          {!vehiclesLoading && !notLoggedIn && hasNoCars && (
            <>
              <p className="text-sm text-gray-700">You haven’t linked a car yet.</p>
              <button
                type="button"
                onClick={goToProfile}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Add a car
              </button>
            </>
          )}

          {!vehiclesLoading && !notLoggedIn && !hasNoCars && vehiclesError && (
            <p className="text-sm text-red-600">Failed to load cars: {vehiclesError}</p>
          )}

          {!vehiclesLoading && !notLoggedIn && !hasNoCars && !vehiclesError && (
            <>
              {!selectedVehicle ? (
                <p className="text-sm text-gray-700">Selecting your car…</p>
              ) : (
                <>
                  {/* Title row is dropdown trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (vehicles.length > 1) setShowVehicleMenu((v) => !v);
                      }}
                      className={`w-full flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 ${
                        vehicles.length > 1 ? "hover:bg-white/60 cursor-pointer" : "cursor-default"
                      } transition-colors`}
                      aria-haspopup={vehicles.length > 1 ? "listbox" : undefined}
                      aria-expanded={vehicles.length > 1 ? showVehicleMenu : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CartoonCar color={selectedVehicle.color} className="w-14 h-14 shrink-0" />
                        <div className="min-w-0 text-left">
                          <p className="text-gray-900 font-medium truncate">
                            {selectedVehicle.brand} {selectedVehicle.model}
                            {selectedVehicle.year ? ` (${selectedVehicle.year})` : ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            Battery: {selectedVehicle.currentBatteryLevel}%
                          </p>
                        </div>
                      </div>

                      {vehicles.length > 1 ? (
                        <ChevronDown
                          className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${
                            showVehicleMenu ? "rotate-180" : ""
                          }`}
                        />
                      ) : null}
                    </button>

                    {vehicles.length > 1 && showVehicleMenu && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowVehicleMenu(false)}
                          className="fixed inset-0 z-0 cursor-default"
                          aria-label="Close vehicle menu"
                        />
                        <div
                          role="listbox"
                          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto"
                        >
                          {vehicles.map((vehicle) => {
                            const active = vehicle.id === selectedVehicle.id;
                            return (
                              <button
                                type="button"
                                key={vehicle.id}
                                role="option"
                                aria-selected={active}
                                onClick={() => {
                                  setSelectedVehicle(vehicle);
                                  setShowVehicleMenu(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                                  active ? "bg-blue-50" : "hover:bg-gray-50"
                                }`}
                              >
                                <div
                                  className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                                  style={{ backgroundColor: vehicle.color }}
                                />
                                <div className="min-w-0">
                                  <p className="text-gray-900 truncate">
                                    {vehicle.brand} {vehicle.model}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {estimates && (
                    <div className="space-y-2 pt-2 border-t">
                      <Row
                        icon={<Clock className="w-4 h-4" />}
                        label="Estimated Time"
                        value={`${estimates.timeMinutes} min`}
                      />
                      <Row
                        icon={<DollarSign className="w-4 h-4" />}
                        label="Estimated Cost"
                        value={`€${estimates.cost}`}
                      />
                      <Row
                        icon={<Zap className="w-4 h-4" />}
                        label={`To ${estimates.target}%`}
                        value={`${estimates.energyNeeded} kWh`}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Address */}
      <InfoRow
        icon={<MapPin className="w-5 h-5 text-gray-400" />}
        text={charger.address || "No address provided"}
      />

      {/* Charger Details */}
      <InfoRow
        icon={<Zap className="w-5 h-5 text-gray-400" />}
        text={`${chargerPowerKW} kW • ${connectorLabel(charger.connectorType)}`}
      />

      {/* Timer */}
      {isReserved && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-orange-900 mb-1">Estimated Time Remaining</p>
          <p className="text-3xl text-orange-600">{formatTime(timeRemaining)}</p>
        </div>
      )}

      {/* Active reservation warning */}
      {hasActiveReservation && !isReserved && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-900">You already have an active reservation</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-900 text-sm">{error}</span>
            </div>
            <button
              type="button"
              onClick={onErrorClose}
              className="text-red-600 hover:text-red-800 ml-2"
              aria-label="Close error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Reserve + Navigate */}
      {(charger.status === "available" || isReserved) && (
        <div className="space-y-2">
          {isGuest && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              <p>Sign in to reserve chargers.</p>
              <button
                type="button"
                onClick={goToSignIn}
                className="mt-2 w-full py-2 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50"
              >
                Go to Sign in
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowDurationPicker(true)}
            disabled={reserveDisabled}
            className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isReserved
                ? "bg-green-500 text-white cursor-default"
                : reserveDisabled
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {isReserving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isReserved
              ? "Reserved!"
              : isReserving
              ? "Reserving..."
              : hasActiveReservation
              ? "Cannot Reserve"
              : isGuest
              ? "Sign in to reserve"
              : "Reserve Charger"}
          </button>

          <button
            type="button"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${charger.lat},${charger.lng}`,
                "_blank"
              )
            }
            className="w-full py-3 border rounded-lg flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" />
            Navigate
          </button>
        </div>
      )}

      {/* Cancel button for user's reservation */}
      {isReserved && (
        <div className="pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowSessionModal(true)}
            disabled={isCompletingSession}
            className="w-full py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCompletingSession ? "Processing..." : "Complete & Pay"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!confirm("Cancel your reservation?")) return;
              onCancel(charger.id);
            }}
            className="w-full py-2 rounded-md bg-red-600 text-white"
            disabled={isCompletingSession}
          >
            Cancel Reservation
          </button>
        </div>
      )}

      {/* Duration picker modal */}
      {showDurationPicker && (
        <>
          {/* Mobile: centered modal */}
          <div className="md:hidden fixed inset-0 z-[1200] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowDurationPicker(false)}
            />
            <div className="relative bg-white rounded-xl p-4 w-[92%] max-w-md shadow-2xl ring-1 ring-gray-100 border border-gray-200">
              <h3 className="text-lg font-medium mb-2">Select reservation duration</h3>
              <div className="mb-3">
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={10}
                  value={selectedMinutes}
                  onChange={(e) => setSelectedMinutes(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-600 mt-2">{selectedMinutes} minutes</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-gray-100"
                  onClick={() => setShowDurationPicker(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  onClick={() => {
                    setShowDurationPicker(false);
                    onReserve(charger.id, selectedMinutes);
                  }}
                >
                  Confirm ({selectedMinutes}m)
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: anchored */}
          <div className="hidden md:block absolute left-4 top-28 z-[1300]">
            <div className="bg-white rounded-xl p-4 w-80 shadow-2xl ring-1 ring-gray-100 border border-gray-200">
              <h3 className="text-lg font-medium mb-2">Select reservation duration</h3>
              <div className="mb-3">
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={10}
                  value={selectedMinutes}
                  onChange={(e) => setSelectedMinutes(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-600 mt-2">{selectedMinutes} minutes</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-gray-100"
                  onClick={() => setShowDurationPicker(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  onClick={() => {
                    setShowDurationPicker(false);
                    onReserve(charger.id, selectedMinutes);
                  }}
                >
                  Confirm ({selectedMinutes}m)
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isReserved && reservationEndTime && (
        <div className="text-sm text-gray-600">Reservation ends: {reservationEndTime}</div>
      )}

<<<<<<< Updated upstream
      {/* Pricing */}
=======
      <Dialog open={showSessionModal} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-xl">
          {sessionModalMode === "success" && sessionResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Charging session recorded</DialogTitle>
                <DialogDescription>
                  Payment status: {sessionResult.payment?.status ?? "pending"}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="font-medium">Session #{sessionResult.session.id}</p>
                <p className="mt-1">Energy delivered: {sessionResult.session.kWh.toFixed(2)} kWh</p>
                <p>Amount charged: €{sessionResult.session.costEur.toFixed(2)}</p>
                {sessionResult.payment?.id && (
                  <p className="mt-1 text-xs text-green-800">Payment ref: {sessionResult.payment.id}</p>
                )}
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => handleModalOpenChange(false)}
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSessionSubmit();
              }}
            >
              <DialogHeader>
                <DialogTitle>Complete charging session</DialogTitle>
                <DialogDescription>
                  Capture the actual charging details so we can generate billing and release the charger.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="session-start" className="text-sm font-medium text-gray-900">
                    Start time
                  </label>
                  <input
                    id="session-start"
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.starttime}
                    onChange={(e) => updateForm({ starttime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="session-end" className="text-sm font-medium text-gray-900">
                    End time
                  </label>
                  <input
                    id="session-end"
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.endtime}
                    onChange={(e) => updateForm({ endtime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="session-startsoc" className="text-sm font-medium text-gray-900">
                    Start SoC (%)
                  </label>
                  <input
                    id="session-startsoc"
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.startsoc ?? ""}
                    onChange={(e) =>
                      updateForm({ startsoc: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="session-endsoc" className="text-sm font-medium text-gray-900">
                    End SoC (%)
                  </label>
                  <input
                    id="session-endsoc"
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.endsoc ?? ""}
                    onChange={(e) =>
                      updateForm({ endsoc: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="session-energy" className="text-sm font-medium text-gray-900">
                    Energy used (kWh)
                  </label>
                  <input
                    id="session-energy"
                    type="number"
                    min={0}
                    step={0.1}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.totalkwh}
                    onChange={(e) => updateForm({ totalkwh: Number(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="session-price" className="text-sm font-medium text-gray-900">
                    Price €/kWh
                  </label>
                  <input
                    id="session-price"
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.kwhprice}
                    onChange={(e) => updateForm({ kwhprice: Number(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="session-amount" className="text-sm font-medium text-gray-900">
                  Total amount (€)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="session-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={sessionForm.amount}
                    onChange={(e) => updateForm({ amount: Number(e.target.value) || 0 })}
                    required
                  />
                  <button
                    type="button"
                    onClick={recalcAmount}
                    className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                  >
                    Recalc
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Based on your energy × price. Adjust if you have exact receipt.</p>
              </div>

              {sessionModalError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {sessionModalError}
                </div>
              )}

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => handleModalOpenChange(false)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
                  disabled={isCompletingSession}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={isCompletingSession}
                >
                  {isCompletingSession ? "Submitting..." : "Save & charge"}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

>>>>>>> Stashed changes
      <div className="pt-4 border-t">
        <p className="text-sm text-gray-500">Pricing</p>
        <p className="text-gray-900">€{pricePerKwh.toFixed(2)}/kWh</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <p className="text-gray-700">{text}</p>
    </div>
  );
}

function formatDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-600">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
