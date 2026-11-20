import {
  ComparisonResult,
  ComparisonStatus,
  ConsumptionPreset,
  ConsumptionProfile,
  MonthlyProjectionPoint,
  TariffBreakdown,
  TariffConfig,
} from '../types/tariff';

export const DAYS_PER_MONTH = 30;
export const SPAIN_IEE_RATE = 0.0511269632; // Impuesto Especial sobre la Electricidad (5,1127%)
export const SPAIN_IVA_RATE = 0.21; // IVA general electricidad España (21%)

export const CONSUMPTION_PRESETS: ConsumptionPreset[] = [
  {
    id: 'estandar',
    label: 'Hogar estándar',
    description: '25% Punta · 30% Llano · 45% Valle',
    split: { punta: 25, llano: 30, valle: 45 },
  },
  {
    id: 'teletrabajo',
    label: 'Teletrabajo',
    description: '35% Punta · 35% Llano · 30% Valle',
    split: { punta: 35, llano: 35, valle: 30 },
  },
  {
    id: 'noches',
    label: 'Noches y findes',
    description: '15% Punta · 25% Llano · 60% Valle',
    split: { punta: 15, llano: 25, valle: 60 },
  },
];

function safeNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function calculateTariffBreakdown(
  tariff: TariffConfig,
  consumption: ConsumptionProfile
): TariffBreakdown {
  const monthlyKwh = safeNonNegative(consumption.monthlyKwh);
  const splitSum =
    safeNonNegative(consumption.split.punta) +
    safeNonNegative(consumption.split.llano) +
    safeNonNegative(consumption.split.valle);

  const normalizedPunta = splitSum > 0 ? safeNonNegative(consumption.split.punta) / splitSum : 0.25;
  const normalizedLlano = splitSum > 0 ? safeNonNegative(consumption.split.llano) / splitSum : 0.3;
  const normalizedValle = splitSum > 0 ? safeNonNegative(consumption.split.valle) / splitSum : 0.45;

  const periodKwh = {
    punta: monthlyKwh * normalizedPunta,
    llano: monthlyKwh * normalizedLlano,
    valle: monthlyKwh * normalizedValle,
  };

  const p1EnergyRate =
    tariff.mode === 'fixed' ? safeNonNegative(tariff.fixedPrice) : safeNonNegative(tariff.puntaPrice);
  const p2EnergyRate =
    tariff.mode === 'fixed' ? safeNonNegative(tariff.fixedPrice) : safeNonNegative(tariff.llanoPrice);
  const p3EnergyRate =
    tariff.mode === 'fixed' ? safeNonNegative(tariff.fixedPrice) : safeNonNegative(tariff.vallePrice);

  const periodCosts = {
    punta: periodKwh.punta * p1EnergyRate,
    llano: periodKwh.llano * p2EnergyRate,
    valle: periodKwh.valle * p3EnergyRate,
  };

  const energyTotal = periodCosts.punta + periodCosts.llano + periodCosts.valle;

  const powerP1Kw = safeNonNegative(consumption.powerP1Kw);
  const powerP2Kw = consumption.samePowerKw ? powerP1Kw : safeNonNegative(consumption.powerP2Kw);

  const powerP1Rate = safeNonNegative(tariff.powerP1Price);
  const powerP2Rate = tariff.samePowerPrice ? powerP1Rate : safeNonNegative(tariff.powerP2Price);

  const powerP1Cost = powerP1Kw * powerP1Rate * DAYS_PER_MONTH;
  const powerP2Cost = powerP2Kw * powerP2Rate * DAYS_PER_MONTH;
  const powerTotal = powerP1Cost + powerP2Cost;

  const subtotal = energyTotal + powerTotal;
  const iee = consumption.includeTaxes ? subtotal * SPAIN_IEE_RATE : 0;
  const iva = consumption.includeTaxes ? (subtotal + iee) * SPAIN_IVA_RATE : 0;
  const taxesTotal = iee + iva;

  const monthlyTotal = subtotal + taxesTotal;
  const annualTotal = monthlyTotal * 12;
  const effectiveKwhPrice = monthlyKwh > 0 ? monthlyTotal / monthlyKwh : 0;

  return {
    energyTotal,
    periodCosts,
    periodKwh,
    powerP1Cost,
    powerP2Cost,
    powerTotal,
    subtotal,
    iee,
    iva,
    taxesTotal,
    monthlyTotal,
    annualTotal,
    effectiveKwhPrice,
  };
}

export function compareTariffs(
  currentTariff: TariffConfig,
  offerTariff: TariffConfig,
  consumption: ConsumptionProfile
): ComparisonResult {
  const current = calculateTariffBreakdown(currentTariff, consumption);
  const offer = calculateTariffBreakdown(offerTariff, consumption);

  const monthlySavings = current.monthlyTotal - offer.monthlyTotal;
  const annualSavings = monthlySavings * 12;
  const savingsPercent =
    current.monthlyTotal > 0 ? (monthlySavings / current.monthlyTotal) * 100 : 0;

  const energySavings = current.energyTotal - offer.energyTotal;
  const powerSavings = current.powerTotal - offer.powerTotal;

  let status: ComparisonStatus = 'equal';
  if (monthlySavings > 0.01) {
    status = 'saving';
  } else if (monthlySavings < -0.01) {
    status = 'costing';
  }

  const cumulativeSeries: MonthlyProjectionPoint[] = Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    return {
      month,
      shortLabel: `M${month}`,
      currentCumulative: current.monthlyTotal * month,
      offerCumulative: offer.monthlyTotal * month,
      savingsCumulative: monthlySavings * month,
    };
  });

  return {
    current,
    offer,
    monthlySavings,
    annualSavings,
    savingsPercent,
    energySavings,
    powerSavings,
    status,
    cumulativeSeries,
  };
}

export function formatEur(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumberEs(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentEs(value: number, decimals = 1): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;
}

export function parseLocaleDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
