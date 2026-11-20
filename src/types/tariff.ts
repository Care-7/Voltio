export type TariffMode = 'fixed' | 'tou';

export interface TariffConfig {
  name: string;
  mode: TariffMode;
  fixedPrice: number; // €/kWh
  puntaPrice: number; // €/kWh (P1)
  llanoPrice: number; // €/kWh (P2)
  vallePrice: number; // €/kWh (P3)
  powerP1Price: number; // €/kW·día (Punta)
  powerP2Price: number; // €/kW·día (Valle)
  samePowerPrice: boolean;
}

export interface ConsumptionSplit {
  punta: number; // % (0-100)
  llano: number; // % (0-100)
  valle: number; // % (0-100)
}

export interface ConsumptionProfile {
  monthlyKwh: number;
  powerP1Kw: number;
  powerP2Kw: number;
  samePowerKw: boolean;
  split: ConsumptionSplit;
  includeTaxes: boolean;
}

export interface ConsumptionPreset {
  id: string;
  label: string;
  description: string;
  split: ConsumptionSplit;
}

export interface PeriodCosts {
  punta: number;
  llano: number;
  valle: number;
}

export interface TariffBreakdown {
  energyTotal: number;
  periodCosts: PeriodCosts;
  periodKwh: PeriodCosts;
  powerP1Cost: number;
  powerP2Cost: number;
  powerTotal: number;
  subtotal: number;
  iee: number;
  iva: number;
  taxesTotal: number;
  monthlyTotal: number;
  annualTotal: number;
  effectiveKwhPrice: number;
}

export interface MonthlyProjectionPoint {
  month: number;
  shortLabel: string;
  currentCumulative: number;
  offerCumulative: number;
  savingsCumulative: number;
}

export type ComparisonStatus = 'saving' | 'costing' | 'equal';

export interface ComparisonResult {
  current: TariffBreakdown;
  offer: TariffBreakdown;
  monthlySavings: number; // positive = saving, negative = extra cost
  annualSavings: number;
  savingsPercent: number; // positive = % saved, negative = % more expensive
  energySavings: number;
  powerSavings: number;
  status: ComparisonStatus;
  cumulativeSeries: MonthlyProjectionPoint[];
}
