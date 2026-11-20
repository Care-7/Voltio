import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ComparisonResult, TariffConfig } from '../types/tariff';
import { formatEur, formatPercentEs } from '../utils/calculations';

interface SavingsHeroProps {
  result: ComparisonResult;
  currentTariff: TariffConfig;
  offerTariff: TariffConfig;
  includeTaxes: boolean;
  isOfferEmpty: boolean;
  showOfferForm?: boolean;
  onStartOffer?: () => void;
}

export const SavingsHero: React.FC<SavingsHeroProps> = ({
  result,
  currentTariff,
  offerTariff,
  includeTaxes,
  isOfferEmpty,
  showOfferForm = false,
  onStartOffer,
}) => {
  const currentLabel = currentTariff.name.trim() || 'Tu tarifa actual';
  const offerLabel = offerTariff.name.trim() || 'Nueva oferta';

  if (isOfferEmpty) {
    return (
      <section
        aria-label="Resumen de tu tarifa actual"
        className="rounded-3xl bg-[#F7F8F7] p-6 sm:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-[#52525B] truncate">
            {currentLabel} · {currentTariff.mode === 'fixed' ? 'Fijo 24h' : '3 tramos'}
          </span>
          <span className="text-xs text-[#71717A] whitespace-nowrap shrink-0">
            {includeTaxes ? 'Impuestos incluidos' : 'Sin impuestos'}
          </span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight leading-none tabular-nums text-[#18181B]">
                {formatEur(result.current.monthlyTotal)}
              </span>
              <span className="text-sm font-medium text-[#71717A]">/mes</span>
            </div>
            <p className="mt-2.5 text-sm text-[#52525B]">
              Gasto anual estimado:{' '}
              <span className="font-mono font-semibold tabular-nums text-[#18181B]">
                {formatEur(result.current.annualTotal, 0)}/año
              </span>
            </p>
          </div>

          {!showOfferForm && onStartOffer ? (
            <button
              type="button"
              onClick={onStartOffer}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#A3E635] text-[#141416] text-sm font-semibold hover:bg-[#84CC16] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 self-start sm:self-end cursor-pointer"
            >
              Comparar nueva oferta
            </button>
          ) : (
            <p className="text-xs text-[#71717A] max-w-[220px] sm:text-right leading-relaxed">
              Introduce los precios de la nueva oferta para ver tu % de ahorro estimado.
            </p>
          )}
        </div>
      </section>
    );
  }

  const isSaving = result.status === 'saving';
  const isCosting = result.status === 'costing';
  const absPercent = Math.abs(result.savingsPercent);
  const absMonthly = Math.abs(result.monthlySavings);
  const absAnnual = Math.abs(result.annualSavings);

  const containerStyle = isSaving
    ? 'bg-[#A3E635] text-[#141416]'
    : isCosting
      ? 'bg-[#18181B] text-white'
      : 'bg-[#F7F8F7] text-[#18181B]';

  const kickerText = isSaving
    ? 'Ahorro estimado con la nueva oferta'
    : isCosting
      ? 'Sobrecoste estimado frente a tu tarifa'
      : 'Coste equivalente entre ambas tarifas';

  return (
    <section
      aria-label="Resultado estimado de ahorro"
      className="space-y-4"
    >
      {/* Primary Focal Anchor */}
      <div
        className={`rounded-3xl p-6 sm:p-8 transition-colors duration-200 ${containerStyle}`}
      >
        <div className="flex items-center justify-between gap-4">
          <span
            className={`text-sm font-medium ${
              isSaving
                ? 'text-[#141416]/80'
                : isCosting
                  ? 'text-white/75'
                  : 'text-[#52525B]'
            }`}
          >
            {kickerText}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isSaving
                ? 'text-[#141416]'
                : isCosting
                  ? 'text-[#FCA5A5]'
                  : 'text-[#52525B]'
            }`}
          >
            {isSaving && <ArrowDownRight className="w-4 h-4" aria-hidden="true" />}
            {isCosting && <ArrowUpRight className="w-4 h-4" aria-hidden="true" />}
            {!isSaving && !isCosting && <Minus className="w-4 h-4" aria-hidden="true" />}
            {isSaving ? 'Ahorras' : isCosting ? 'Pagas más' : 'Igual'}
          </span>
        </div>

        {/* Hero percentage + monthly/annual figures */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-none tabular-nums">
              {isSaving ? '−' : isCosting ? '+' : ''}
              {formatPercentEs(absPercent, 1)}
            </div>
            <p
              className={`mt-2.5 text-sm font-medium ${
                isSaving
                  ? 'text-[#141416]/80'
                  : isCosting
                    ? 'text-white/70'
                    : 'text-[#52525B]'
              }`}
            >
              {isSaving
                ? 'Menos en tu factura cada mes'
                : isCosting
                  ? 'Más caro que tu tarifa actual'
                  : 'Sin diferencia apreciable'}
            </p>
          </div>

          <div
            className={`flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 ${
              isSaving
                ? 'border-[#141416]/15'
                : isCosting
                  ? 'border-white/15'
                  : 'border-[#EAECEB]'
            }`}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${
                  isCosting ? 'text-[#FCA5A5]' : ''
                }`}
              >
                {isSaving ? '−' : isCosting ? '+' : ''}
                {formatEur(absMonthly)}
              </span>
              <span
                className={`text-xs font-medium ${
                  isSaving
                    ? 'text-[#141416]/75'
                    : isCosting
                      ? 'text-white/65'
                      : 'text-[#71717A]'
                }`}
              >
                /mes
              </span>
            </div>
            <div
              className={`font-mono text-sm font-semibold tabular-nums ${
                isSaving
                  ? 'text-[#141416]/85'
                  : isCosting
                    ? 'text-white/85'
                    : 'text-[#52525B]'
              }`}
            >
              {isSaving ? '−' : isCosting ? '+' : ''}
              {formatEur(absAnnual)} al año
            </div>
          </div>
        </div>
      </div>

      {/* Unboxed Side-by-Side Monthly Cost Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#F7F8F7] px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#71717A] truncate">
              {currentLabel}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#18181B]">
              {formatEur(result.current.monthlyTotal)}
            </span>
            <span className="text-xs text-[#71717A]">/mes</span>
          </div>
          <p className="mt-1 text-xs text-[#71717A]">
            {currentTariff.mode === 'fixed' ? 'Fijo 24h' : '3 tramos'} ·{' '}
            <span className="font-mono tabular-nums">
              {formatEur(result.current.annualTotal, 0)}/año
            </span>
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F8F7] px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#71717A] truncate">
              {offerLabel}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span
              className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${
                isSaving
                  ? 'text-[#3F6212]'
                  : isCosting
                    ? 'text-[#DC2626]'
                    : 'text-[#18181B]'
              }`}
            >
              {formatEur(result.offer.monthlyTotal)}
            </span>
            <span className="text-xs text-[#71717A]">/mes</span>
          </div>
          <p className="mt-1 text-xs text-[#71717A]">
            {offerTariff.mode === 'fixed' ? 'Fijo 24h' : '3 tramos'} ·{' '}
            <span className="font-mono tabular-nums">
              {formatEur(result.offer.annualTotal, 0)}/año
            </span>
          </p>
        </div>
      </div>
    </section>
  );
};
