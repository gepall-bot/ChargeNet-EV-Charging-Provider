"use client";
import { SideMenu } from '../../components/SideMenu';
import { MenuPanel } from '../../components/MenuPanel';
import { useState, useEffect, useRef } from 'react';
import { fetchCarBrands, fetchCarModels, fetchCarOwnerships, searchCars, addCarOwnership } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Plus, Trash2, Menu, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const CAR_COLORS = [
  { value: 'RED', label: 'Red', hex: '#EF4444' },
  { value: 'BLUE', label: 'Blue', hex: '#3B82F6' },
  { value: 'YELLOW', label: 'Yellow', hex: '#EAB308' },
  { value: 'WHITE', label: 'White', hex: '#F9FAFB' },
  { value: 'BLACK', label: 'Black', hex: '#1F2937' },
  { value: 'SILVER', label: 'Silver', hex: '#9CA3AF' },
  { value: 'GREY', label: 'Grey', hex: '#6B7280' },
  { value: 'GREEN', label: 'Green', hex: '#22C55E' },
  { value: 'ORANGE', label: 'Orange', hex: '#F97316' },
  { value: 'PURPLE', label: 'Purple', hex: '#A855F7' },
] as const;

interface Vehicle {
  ownershipId: number;
  carId: number;
  brand: string;
  model: string;
  variant: string | null;
  color: string;
  usableBatteryKWh: number;
  dcMaxKW: number;
  acMaxKW: number;
}

function mapOwnershipToVehicle(o: any): Vehicle {
  return {
    ownershipId: o.id,
    carId: o.carId,
    brand: o.car.brand,
    model: o.car.model,
    variant: o.car.variant ?? null,
    color: o.color,
    usableBatteryKWh: o.car.usableBatteryKWh,
    dcMaxKW: o.car.dcMaxKW,
    acMaxKW: o.car.acMaxKW,
  };
}

function getColorHex(colorValue: string): string {
  return CAR_COLORS.find((c) => c.value === colorValue)?.hex ?? '#9CA3AF';
}

function getColorLabel(colorValue: string): string {
  return CAR_COLORS.find((c) => c.value === colorValue)?.label ?? colorValue;
}

export default function VehiclesScreen() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Brand search dropdown state
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  // Model search dropdown state
  const [allModels, setAllModels] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  // Color state
  const [selectedColor, setSelectedColor] = useState('WHITE');

  // Load existing vehicles from backend
  useEffect(() => {
    fetchCarOwnerships()
      .then((data: any[]) => {
        setVehicles(data.map(mapOwnershipToVehicle));
      })
      .catch((err) => {
        console.error('Failed to load vehicles:', err);
        setError('Failed to load your vehicles. Please sign in and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch brands
  useEffect(() => {
    fetchCarBrands()
      .then(setAllBrands)
      .catch((err) => console.error('Failed to fetch brands:', err));
  }, []);

  // Close brand dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setIsBrandDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBrands = allBrands.filter((b) =>
    b.toLowerCase().startsWith(brandQuery.toLowerCase())
  );

  // Fetch models when brand is selected
  useEffect(() => {
    if (!selectedBrand) {
      setAllModels([]);
      setModelQuery('');
      setSelectedModel('');
      return;
    }
    fetchCarModels(selectedBrand)
      .then(setAllModels)
      .catch((err) => console.error('Failed to fetch models:', err));
  }, [selectedBrand]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = allModels.filter((m) =>
    m.toLowerCase().startsWith(modelQuery.toLowerCase())
  );

  const resetAddForm = () => {
    setBrandQuery('');
    setSelectedBrand('');
    setModelQuery('');
    setSelectedModel('');
    setSelectedColor('WHITE');
    setAddError(null);
  };

  const handleAddVehicle = async () => {
    if (!selectedBrand || !selectedModel) return;

    setAdding(true);
    setAddError(null);

    try {
      // Search by brand to get car IDs, then match the exact model
      const cars = await searchCars(selectedBrand);
      const match = cars.find(
        (c: any) =>
          c.brand.toLowerCase() === selectedBrand.toLowerCase() &&
          c.model.toLowerCase() === selectedModel.toLowerCase()
      );

      if (!match) {
        setAddError('Could not find this car in our database.');
        setAdding(false);
        return;
      }

      const result = await addCarOwnership(match.id, selectedColor);
      const newVehicle = mapOwnershipToVehicle(result.ownership);
      setVehicles((prev) => [newVehicle, ...prev]);
      resetAddForm();
      setIsAddDialogOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add vehicle.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveVehicle = (ownershipId: number) => {
    // Remove locally (no backend delete endpoint yet)
    setVehicles((prev) => prev.filter((v) => v.ownershipId !== ownershipId));
  };

  return (
    <div className="flex flex-col sm:flex-row h-screen w-full">
      {/* Mobile header */}
      <div className="sm:hidden flex items-center gap-3 p-3 bg-white border-b border-gray-200">
        <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-medium text-gray-900">Vehicles</h1>
      </div>
      <MenuPanel isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-6 sm:p-8 lg:p-12">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="hidden sm:block text-2xl sm:text-3xl text-gray-900 mb-2">Vehicles</h1>
              <p className="text-sm text-gray-500">Manage your electric vehicles</p>
            </div>
            <Button onClick={() => { resetAddForm(); setIsAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">Loading your vehicles...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4">No vehicles added yet</p>
              <Button onClick={() => { resetAddForm(); setIsAddDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Vehicle
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.ownershipId}
                  vehicle={vehicle}
                  onRemove={() => handleRemoveVehicle(vehicle.ownershipId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Menu - hidden on mobile, visible on sm+ */}
      <div className="hidden sm:block sm:w-80 lg:w-96 flex-shrink-0">
        <SideMenu />
      </div>

      {/* Add Vehicle Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription>
              Search for your electric vehicle and pick a color
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Brand */}
            <div ref={brandRef} className="relative">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brandQuery}
                onChange={(e) => {
                  setBrandQuery(e.target.value);
                  setSelectedBrand('');
                  setSelectedModel('');
                  setModelQuery('');
                  setIsBrandDropdownOpen(true);
                }}
                onFocus={() => setIsBrandDropdownOpen(true)}
                placeholder="Search brand..."
                className="mt-1"
                autoComplete="off"
              />
              {isBrandDropdownOpen && filteredBrands.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {filteredBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-900"
                      onClick={() => {
                        setSelectedBrand(brand);
                        setBrandQuery(brand);
                        setSelectedModel('');
                        setModelQuery('');
                        setIsBrandDropdownOpen(false);
                      }}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model */}
            <div ref={modelRef} className="relative">
              <Label htmlFor="model">Model</Label>
              {!selectedBrand ? (
                <Input
                  id="model"
                  disabled
                  placeholder="Choose a brand first"
                  className="mt-1"
                />
              ) : (
                <>
                  <Input
                    id="model"
                    value={modelQuery}
                    onChange={(e) => {
                      setModelQuery(e.target.value);
                      setSelectedModel('');
                      setIsModelDropdownOpen(true);
                    }}
                    onFocus={() => setIsModelDropdownOpen(true)}
                    placeholder="Search model..."
                    className="mt-1"
                    autoComplete="off"
                  />
                  {isModelDropdownOpen && filteredModels.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {filteredModels.map((model) => (
                        <button
                          key={model}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-900"
                          onClick={() => {
                            setSelectedModel(model);
                            setModelQuery(model);
                            setIsModelDropdownOpen(false);
                          }}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Color picker */}
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CAR_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color.value
                        ? 'border-blue-500 scale-110 ring-2 ring-blue-200'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => setSelectedColor(color.value)}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{getColorLabel(selectedColor)}</p>
            </div>

            {addError && (
              <p className="text-sm text-red-500">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddVehicle}
              disabled={!selectedBrand || !selectedModel || adding}
            >
              {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onRemove: () => void;
}

function VehicleCard({ vehicle, onRemove }: VehicleCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
            style={{ backgroundColor: getColorHex(vehicle.color) }}
            title={getColorLabel(vehicle.color)}
          />
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {vehicle.brand} {vehicle.model}
            </h3>
            {vehicle.variant && (
              <p className="text-sm text-gray-500">{vehicle.variant}</p>
            )}
          </div>
        </div>
        <Button onClick={onRemove} variant="outline" size="sm">
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">Battery</p>
          <p className="text-sm text-gray-900">{vehicle.usableBatteryKWh} kWh</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">DC Max</p>
          <p className="text-sm text-gray-900">{vehicle.dcMaxKW} kW</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">AC Max</p>
          <p className="text-sm text-gray-900">{vehicle.acMaxKW} kW</p>
        </div>
      </div>
    </div>
  );
}
