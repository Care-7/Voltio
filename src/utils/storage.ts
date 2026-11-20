import { ConsumptionProfile, TariffConfig } from '../types/tariff';

const STORAGE_KEYS = {
  currentTariff: 'voltio:currentTariff:v1',
  offerTariff: 'voltio:offerTariff:v2',
  consumption: 'voltio:consumption:v1',
  lastSavedAt: 'voltio:lastSavedAt:v1',
} as const;

export const DEFAULT_CURRENT_TARIFF: TariffConfig = {
  name: 'Mi tarifa actual',
  mode: 'tou',
  fixedPrice: 0.149,
  puntaPrice: 0.195,
  llanoPrice: 0.145,
  vallePrice: 0.105,
  powerP1Price: 0.098,
  powerP2Price: 0.035,
  samePowerPrice: false,
};

export const DEFAULT_OFFER_TARIFF: TariffConfig = {
  name: 'Nueva oferta',
  mode: 'fixed',
  fixedPrice: 0.119,
  puntaPrice: 0.168,
  llanoPrice: 0.122,
  vallePrice: 0.089,
  powerP1Price: 0.089,
  powerP2Price: 0.029,
  samePowerPrice: false,
};

export const EMPTY_OFFER_TARIFF: TariffConfig = {
  name: '',
  mode: 'fixed',
  fixedPrice: 0,
  puntaPrice: 0,
  llanoPrice: 0,
  vallePrice: 0,
  powerP1Price: 0,
  powerP2Price: 0,
  samePowerPrice: false,
};

export const DEFAULT_CONSUMPTION: ConsumptionProfile = {
  monthlyKwh: 260,
  powerP1Kw: 4.6,
  powerP2Kw: 4.6,
  samePowerKw: true,
  split: {
    punta: 25,
    llano: 30,
    valle: 45,
  },
  includeTaxes: true,
};

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

function sanitizeTariff(raw: unknown, fallback: TariffConfig): TariffConfig {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<TariffConfig>;
  return {
    name: typeof obj.name === 'string' ? obj.name : fallback.name,
    mode: obj.mode === 'fixed' || obj.mode === 'tou' ? obj.mode : fallback.mode,
    fixedPrice: isFiniteNumber(obj.fixedPrice) ? obj.fixedPrice : fallback.fixedPrice,
    puntaPrice: isFiniteNumber(obj.puntaPrice) ? obj.puntaPrice : fallback.puntaPrice,
    llanoPrice: isFiniteNumber(obj.llanoPrice) ? obj.llanoPrice : fallback.llanoPrice,
    vallePrice: isFiniteNumber(obj.vallePrice) ? obj.vallePrice : fallback.vallePrice,
    powerP1Price: isFiniteNumber(obj.powerP1Price) ? obj.powerP1Price : fallback.powerP1Price,
    powerP2Price: isFiniteNumber(obj.powerP2Price) ? obj.powerP2Price : fallback.powerP2Price,
    samePowerPrice:
      typeof obj.samePowerPrice === 'boolean' ? obj.samePowerPrice : fallback.samePowerPrice,
  };
}

function sanitizeConsumption(raw: unknown, fallback: ConsumptionProfile): ConsumptionProfile {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<ConsumptionProfile>;
  const split = obj.split;
  const validSplit =
    split &&
    isFiniteNumber(split.punta) &&
    isFiniteNumber(split.llano) &&
    isFiniteNumber(split.valle) &&
    split.punta + split.llano + split.valle > 0
      ? {
          punta: Math.round(split.punta),
          llano: Math.round(split.llano),
          valle: Math.round(split.valle),
        }
      : fallback.split;

  return {
    monthlyKwh: isFiniteNumber(obj.monthlyKwh) ? obj.monthlyKwh : fallback.monthlyKwh,
    powerP1Kw: isFiniteNumber(obj.powerP1Kw) ? obj.powerP1Kw : fallback.powerP1Kw,
    powerP2Kw: isFiniteNumber(obj.powerP2Kw) ? obj.powerP2Kw : fallback.powerP2Kw,
    samePowerKw: typeof obj.samePowerKw === 'boolean' ? obj.samePowerKw : fallback.samePowerKw,
    split: validSplit,
    includeTaxes: typeof obj.includeTaxes === 'boolean' ? obj.includeTaxes : fallback.includeTaxes,
  };
}

export function loadPersistedState(): {
  currentTariff: TariffConfig;
  offerTariff: TariffConfig;
  consumption: ConsumptionProfile;
  hasSavedCurrent: boolean;
} {
  try {
    const rawCurrent = window.localStorage.getItem(STORAGE_KEYS.currentTariff);
    const rawOffer = window.localStorage.getItem(STORAGE_KEYS.offerTariff);
    const rawConsumption = window.localStorage.getItem(STORAGE_KEYS.consumption);

    return {
      currentTariff: rawCurrent
        ? sanitizeTariff(JSON.parse(rawCurrent), DEFAULT_CURRENT_TARIFF)
        : DEFAULT_CURRENT_TARIFF,
      offerTariff: rawOffer
        ? sanitizeTariff(JSON.parse(rawOffer), EMPTY_OFFER_TARIFF)
        : EMPTY_OFFER_TARIFF,
      consumption: rawConsumption
        ? sanitizeConsumption(JSON.parse(rawConsumption), DEFAULT_CONSUMPTION)
        : DEFAULT_CONSUMPTION,
      hasSavedCurrent: Boolean(rawCurrent),
    };
  } catch {
    return {
      currentTariff: DEFAULT_CURRENT_TARIFF,
      offerTariff: EMPTY_OFFER_TARIFF,
      consumption: DEFAULT_CONSUMPTION,
      hasSavedCurrent: false,
    };
  }
}

export function saveCurrentTariff(tariff: TariffConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.currentTariff, JSON.stringify(tariff));
    window.localStorage.setItem(STORAGE_KEYS.lastSavedAt, new Date().toISOString());
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}

export function saveOfferTariff(tariff: TariffConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.offerTariff, JSON.stringify(tariff));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function saveConsumption(profile: ConsumptionProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.consumption, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
