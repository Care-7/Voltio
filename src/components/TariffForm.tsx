import React from 'react';
import { TariffConfig, TariffMode } from '../types/tariff';
import { DecimalInput } from './DecimalInput';

interface TariffFormProps {
  idPrefix: string;
  tariff: TariffConfig;
  onChange: (updated: TariffConfig) => void;
  namePlaceholder: string;
  helperText?: string;
}

export const TariffForm: React.FC<TariffFormProps> = ({
  idPrefix,
  tariff,
  onChange,
  namePlaceholder,
  helperText,
}) => {
  const updateField = <K extends keyof TariffConfig>(key: K, val: TariffConfig[K]) => {
    onChange({ ...tariff, [key]: val });
  };

  const handleModeChange = (mode: TariffMode) => {
    if (mode !== tariff.mode) {
      updateField('mode', mode);
    }
  };

  const handlePowerP1Change = (val: number) => {
    if (tariff.samePowerPrice) {
      onChange({ ...tariff, powerP1Price: val, powerP2Price: val });
    } else {
      updateField('powerP1Price', val);
    }
  };

  const toggleSamePower = () => {
    const next = !tariff.samePowerPrice;
    onChange({
      ...tariff,
      samePowerPrice: next,
      powerP2Price: next ? tariff.powerP1Price : tariff.powerP2Price,
    });
  };

  return (
    <div className="space-y-6">
      {helperText && (
        <p className="text-sm text-[#52525B] leading-relaxed">{helperText}</p>
      )}

      {/* Company / Tariff name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-name`}
          className="text-sm font-medium text-[#18181B]"
        >
          Compañía o nombre
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={tariff.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder={namePlaceholder}
          maxLength={40}
          className="min-h-[46px] px-3.5 rounded-xl bg-[#F7F8F7] text-[15px] text-[#18181B] placeholder:text-[#A1A1AA] hover:bg-[#F1F3F1] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none transition-colors duration-150"
        />
      </div>

      {/* Mode segmented control */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-[#18181B]">
          Modalidad de energía
        </span>
        <div
          role="tablist"
          aria-label="Modalidad de tarifa"
          className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tariff.mode === 'fixed'}
            onClick={() => handleModeChange('fixed')}
            className={`min-h-[42px] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              tariff.mode === 'fixed'
                ? 'bg-[#18181B] text-white'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            Precio fijo 24h
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tariff.mode === 'tou'}
            onClick={() => handleModeChange('tou')}
            className={`min-h-[42px] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              tariff.mode === 'tou'
                ? 'bg-[#18181B] text-white'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            3 tramos (2.0TD)
          </button>
        </div>
      </div>

      {/* Energy prices */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#18181B]">
            Término de energía
          </h3>
          <span className="text-xs text-[#71717A]">
            {tariff.mode === 'fixed' ? 'Mismo precio todo el día' : 'Discriminación horaria'}
          </span>
        </div>

        {tariff.mode === 'fixed' ? (
          <DecimalInput
            id={`${idPrefix}-fixed`}
            label="Precio energía 24h"
            sublabel="Sin impuestos"
            value={tariff.fixedPrice}
            onChange={(val) => updateField('fixedPrice', val)}
            unit="€/kWh"
            placeholder="0,1250"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3.5">
            <DecimalInput
              id={`${idPrefix}-punta`}
              label="Punta (P1)"
              sublabel="10-14h · 18-22h"
              value={tariff.puntaPrice}
              onChange={(val) => updateField('puntaPrice', val)}
              unit="€/kWh"
              placeholder="0,1950"
            />
            <DecimalInput
              id={`${idPrefix}-llano`}
              label="Llano (P2)"
              sublabel="8-10 · 14-18 · 22-00h"
              value={tariff.llanoPrice}
              onChange={(val) => updateField('llanoPrice', val)}
              unit="€/kWh"
              placeholder="0,1450"
            />
            <DecimalInput
              id={`${idPrefix}-valle`}
              label="Valle (P3)"
              sublabel="00-8h · Fines de sem."
              value={tariff.vallePrice}
              onChange={(val) => updateField('vallePrice', val)}
              unit="€/kWh"
              placeholder="0,1050"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-[#EAECEB]" />

      {/* Power prices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#18181B]">
            Término de potencia
          </h3>
          <button
            type="button"
            onClick={toggleSamePower}
            className="text-xs font-medium text-[#52525B] hover:text-[#18181B] underline underline-offset-4 decoration-[#D4D4D8] hover:decoration-[#18181B] transition-colors min-h-[32px] px-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {tariff.samePowerPrice ? 'Diferenciar P1 y P2' : 'Usar mismo precio P1/P2'}
          </button>
        </div>

        {tariff.samePowerPrice ? (
          <DecimalInput
            id={`${idPrefix}-power-single`}
            label="Potencia P1 y P2"
            sublabel="Precio diario por kW"
            value={tariff.powerP1Price}
            onChange={handlePowerP1Change}
            unit="€/kW·día"
            placeholder="0,0950"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <DecimalInput
              id={`${idPrefix}-power-p1`}
              label="Potencia P1 (Punta)"
              value={tariff.powerP1Price}
              onChange={handlePowerP1Change}
              unit="€/kW·día"
              placeholder="0,0980"
            />
            <DecimalInput
              id={`${idPrefix}-power-p2`}
              label="Potencia P2 (Valle)"
              value={tariff.powerP2Price}
              onChange={(val) => updateField('powerP2Price', val)}
              unit="€/kW·día"
              placeholder="0,0350"
            />
          </div>
        )}
      </div>
    </div>
  );
};
