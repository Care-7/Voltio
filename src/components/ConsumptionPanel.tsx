import React from 'react';
import { ConsumptionProfile, ConsumptionSplit } from '../types/tariff';
import { CONSUMPTION_PRESETS, formatNumberEs } from '../utils/calculations';
import { DecimalInput } from './DecimalInput';

interface ConsumptionPanelProps {
  consumption: ConsumptionProfile;
  onChange: (updated: ConsumptionProfile) => void;
}

const COMMON_POWERS = [3.45, 4.6, 5.75, 6.9];

function rebalanceSplit(
  current: ConsumptionSplit,
  changedKey: keyof ConsumptionSplit,
  newValue: number
): ConsumptionSplit {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const remaining = 100 - clamped;
  const otherKeys = (['punta', 'llano', 'valle'] as const).filter((k) => k !== changedKey);
  const otherSum = current[otherKeys[0]] + current[otherKeys[1]];

  let firstOther: number;
  let secondOther: number;

  if (otherSum === 0) {
    firstOther = Math.floor(remaining / 2);
    secondOther = remaining - firstOther;
  } else {
    firstOther = Math.round((current[otherKeys[0]] / otherSum) * remaining);
    secondOther = remaining - firstOther;
  }

  return {
    ...current,
    [changedKey]: clamped,
    [otherKeys[0]]: firstOther,
    [otherKeys[1]]: secondOther,
  };
}

export const ConsumptionPanel: React.FC<ConsumptionPanelProps> = ({
  consumption,
  onChange,
}) => {
  const updateSplit = (key: keyof ConsumptionSplit, val: number) => {
    onChange({
      ...consumption,
      split: rebalanceSplit(consumption.split, key, val),
    });
  };

  const applyPreset = (split: ConsumptionSplit) => {
    onChange({ ...consumption, split });
  };

  const isPresetActive = (split: ConsumptionSplit) =>
    consumption.split.punta === split.punta &&
    consumption.split.llano === split.llano &&
    consumption.split.valle === split.valle;

  const setQuickPower = (kw: number) => {
    onChange({
      ...consumption,
      powerP1Kw: kw,
      powerP2Kw: consumption.samePowerKw ? kw : consumption.powerP2Kw,
    });
  };

  return (
    <div className="space-y-7">
      <p className="text-sm text-[#52525B] leading-relaxed">
        Ajusta tu consumo y potencia contratada según tu última factura para calcular el ahorro real en euros.
      </p>

      {/* Monthly kWh */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="consumption-kwh-slider" className="text-sm font-semibold text-[#18181B]">
            Consumo mensual estimado
          </label>
          <span className="font-mono text-base font-semibold tabular-nums text-[#18181B]">
            {Math.round(consumption.monthlyKwh)} kWh
          </span>
        </div>

        <input
          id="consumption-kwh-slider"
          type="range"
          min={50}
          max={1000}
          step={10}
          value={Math.min(1000, Math.max(50, consumption.monthlyKwh))}
          onChange={(e) =>
            onChange({ ...consumption, monthlyKwh: Number(e.target.value) })
          }
          className="voltio-slider"
          aria-label="Ajustar consumo mensual en kWh"
        />

        <div className="flex justify-between text-xs font-mono tabular-nums text-[#71717A]">
          <span>50 kWh</span>
          <span>260 kWh · Media</span>
          <span>1.000 kWh</span>
        </div>

        <DecimalInput
          id="consumption-kwh-exact"
          label="Valor exacto mensual"
          value={consumption.monthlyKwh}
          onChange={(val) => onChange({ ...consumption, monthlyKwh: val })}
          unit="kWh/mes"
          decimals={0}
          placeholder="260"
        />
      </div>

      <div className="h-px bg-[#EAECEB]" />

      {/* Contracted Power */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#18181B]">
            Potencia contratada
          </h3>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...consumption,
                samePowerKw: !consumption.samePowerKw,
                powerP2Kw: !consumption.samePowerKw
                  ? consumption.powerP1Kw
                  : consumption.powerP2Kw,
              })
            }
            className="text-xs font-medium text-[#52525B] hover:text-[#18181B] underline underline-offset-4 decoration-[#D4D4D8] hover:decoration-[#18181B] transition-colors min-h-[32px] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {consumption.samePowerKw ? 'Distinta en P1 y P2' : 'Igual en P1 y P2'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {COMMON_POWERS.map((kw) => {
            const active = Math.abs(consumption.powerP1Kw - kw) < 0.01 && consumption.samePowerKw;
            return (
              <button
                key={kw}
                type="button"
                onClick={() => setQuickPower(kw)}
                className={`min-h-[44px] rounded-xl font-mono text-sm font-medium tabular-nums transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#18181B] text-[#A3E635]'
                    : 'bg-[#F7F8F7] text-[#18181B] hover:bg-[#EAECEB]'
                }`}
              >
                {formatNumberEs(kw, kw === 4.6 || kw === 6.9 ? 1 : 2)} kW
              </button>
            );
          })}
        </div>

        {consumption.samePowerKw ? (
          <DecimalInput
            id="power-kw-single"
            label="Potencia P1 y P2"
            value={consumption.powerP1Kw}
            onChange={(val) =>
              onChange({ ...consumption, powerP1Kw: val, powerP2Kw: val })
            }
            unit="kW"
            decimals={2}
            placeholder="4,60"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <DecimalInput
              id="power-kw-p1"
              label="Potencia P1"
              value={consumption.powerP1Kw}
              onChange={(val) => onChange({ ...consumption, powerP1Kw: val })}
              unit="kW"
              decimals={2}
              placeholder="4,60"
            />
            <DecimalInput
              id="power-kw-p2"
              label="Potencia P2"
              value={consumption.powerP2Kw}
              onChange={(val) => onChange({ ...consumption, powerP2Kw: val })}
              unit="kW"
              decimals={2}
              placeholder="4,60"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-[#EAECEB]" />

      {/* Period Split */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#18181B]">
            Reparto horario (2.0TD)
          </h3>
          <span className="text-xs text-[#71717A]">Suma 100%</span>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-2">
          {CONSUMPTION_PRESETS.map((preset) => {
            const active = isPresetActive(preset.split);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.split)}
                className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-medium transition-colors duration-150 whitespace-nowrap truncate cursor-pointer ${
                  active
                    ? 'bg-[#18181B] text-white'
                    : 'bg-[#F7F8F7] text-[#52525B] hover:text-[#18181B] hover:bg-[#EAECEB]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Visual split bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#F1F3F1] gap-0.5">
          <div
            style={{ width: `${consumption.split.punta}%` }}
            className="bg-[#18181B] transition-all duration-200"
            title={`Punta: ${consumption.split.punta}%`}
          />
          <div
            style={{ width: `${consumption.split.llano}%` }}
            className="bg-[#71717A] transition-all duration-200"
            title={`Llano: ${consumption.split.llano}%`}
          />
          <div
            style={{ width: `${consumption.split.valle}%` }}
            className="bg-[#84CC16] transition-all duration-200"
            title={`Valle: ${consumption.split.valle}%`}
          />
        </div>

        {/* Individual period sliders */}
        <div className="space-y-4 pt-1">
          {(
            [
              { key: 'punta', label: 'Punta', schedule: '10-14h · 18-22h', swatch: 'bg-[#18181B]' },
              { key: 'llano', label: 'Llano', schedule: '8-10 · 14-18 · 22-00h', swatch: 'bg-[#71717A]' },
              { key: 'valle', label: 'Valle', schedule: '00-8h · Fines de sem.', swatch: 'bg-[#84CC16]' },
            ] as const
          ).map((period) => {
            const pct = consumption.split[period.key];
            const kwh = Math.round((consumption.monthlyKwh * pct) / 100);
            return (
              <div key={period.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${period.swatch}`} />
                    <span className="font-medium text-[#18181B]">{period.label}</span>
                    <span className="text-xs text-[#71717A] truncate hidden sm:inline">
                      {period.schedule}
                    </span>
                  </div>
                  <div className="font-mono text-xs tabular-nums text-[#18181B] whitespace-nowrap shrink-0">
                    <span className="font-semibold">{pct}%</span>
                    <span className="text-[#71717A]"> · {kwh} kWh</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  onChange={(e) => updateSplit(period.key, Number(e.target.value))}
                  className="voltio-slider"
                  aria-label={`Porcentaje de consumo en ${period.label}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[#EAECEB]" />

      {/* Taxes toggle */}
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="space-y-0.5">
          <span className="block text-sm font-semibold text-[#18181B]">
            Incluir impuestos españoles
          </span>
          <span className="block text-xs text-[#71717A]">
            Impuesto Eléctrico (5,11%) + IVA (21%)
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={consumption.includeTaxes}
          aria-label="Incluir impuestos españoles en el cálculo"
          onClick={() =>
            onChange({ ...consumption, includeTaxes: !consumption.includeTaxes })
          }
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B] focus-visible:ring-offset-2 ${
            consumption.includeTaxes ? 'bg-[#18181B]' : 'bg-[#D4D4D8]'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full transition-transform duration-150 ${
              consumption.includeTaxes
                ? 'translate-x-6 bg-[#A3E635]'
                : 'translate-x-0 bg-white'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
