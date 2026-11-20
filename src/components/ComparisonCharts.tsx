import React, { useState } from 'react';
import { ComparisonResult, TariffConfig } from '../types/tariff';
import { formatEur, formatNumberEs } from '../utils/calculations';

interface ComparisonChartsProps {
  result: ComparisonResult;
  currentTariff: TariffConfig;
  offerTariff: TariffConfig;
  includeTaxes: boolean;
  isOfferEmpty: boolean;
}

type BreakdownFocus = 'all' | 'energy' | 'power' | 'taxes';

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({
  result,
  currentTariff,
  offerTariff,
  includeTaxes,
  isOfferEmpty,
}) => {
  const [focusComponent, setFocusComponent] = useState<BreakdownFocus>('all');
  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(11); // Default to Month 12

  const currentLabel = currentTariff.name.trim() || 'Tu tarifa actual';
  const offerLabel = offerTariff.name.trim() || 'Nueva oferta';

  const isSaving = result.status === 'saving';
  const isCosting = result.status === 'costing';

  const offerPrimaryColor = isCosting ? '#EF4444' : '#84CC16';
  const offerSecondaryColor = isCosting ? '#FCA5A5' : '#BEF264';
  const offerTaxColor = isCosting ? '#FECACA' : '#ECFCCB';
  const offerTextAccent = isCosting ? 'text-[#DC2626]' : 'text-[#3F6212]';

  // Chart 1: Monthly proportional bars
  const maxMonthly = isOfferEmpty
    ? Math.max(result.current.monthlyTotal, 1)
    : Math.max(result.current.monthlyTotal, result.offer.monthlyTotal, 1);

  const getSegmentWidths = (b: typeof result.current) => ({
    energy: (b.energyTotal / maxMonthly) * 100,
    power: (b.powerTotal / maxMonthly) * 100,
    taxes: (b.taxesTotal / maxMonthly) * 100,
  });

  const currentSegs = getSegmentWidths(result.current);
  const offerSegs = getSegmentWidths(result.offer);

  // Chart 2: Period costs (Punta / Llano / Valle)
  const periods = [
    {
      key: 'punta' as const,
      label: 'Punta',
      hours: '10-14 · 18-22h',
      currentCost: result.current.periodCosts.punta,
      offerCost: result.offer.periodCosts.punta,
      kwh: result.current.periodKwh.punta,
    },
    {
      key: 'llano' as const,
      label: 'Llano',
      hours: '8-10 · 14-18 · 22-00h',
      currentCost: result.current.periodCosts.llano,
      offerCost: result.offer.periodCosts.llano,
      kwh: result.current.periodKwh.llano,
    },
    {
      key: 'valle' as const,
      label: 'Valle',
      hours: '00-8h · Findes',
      currentCost: result.current.periodCosts.valle,
      offerCost: result.offer.periodCosts.valle,
      kwh: result.current.periodKwh.valle,
    },
  ];
  const maxPeriodCost = Math.max(
    ...periods.flatMap((p) => (isOfferEmpty ? [p.currentCost] : [p.currentCost, p.offerCost])),
    1
  );

  // Chart 3: 12-month cumulative savings SVG geometry
  const series = result.cumulativeSeries;
  const maxAbsCumulative = Math.max(
    ...series.map((p) => Math.abs(p.savingsCumulative)),
    1
  );
  const svgW = 560;
  const svgH = 190;
  const padL = 14;
  const padR = 14;
  const padT = 22;
  const padB = 28;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;

  const points = series.map((pt, idx) => {
    const x = padL + (idx / (series.length - 1)) * innerW;
    const ratio = Math.abs(pt.savingsCumulative) / maxAbsCumulative;
    const y = padT + innerH - ratio * innerH;
    return { x, y, pt, idx };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    padT + innerH
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const selectedPoint = points[activeMonthIndex] || points[11];

  const getOpacity = (part: Exclude<BreakdownFocus, 'all'>) =>
    focusComponent === 'all' || focusComponent === part ? 1 : 0.22;

  return (
    <div className="space-y-10">
      {/* CHART 1: Comparativa mensual */}
      <section id="mensual" className="space-y-5 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
              {isOfferEmpty ? 'Desglose de tu gasto mensual' : 'Gasto mensual comparado'}
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Pulsa un concepto para aislar su peso en la factura
            </p>
          </div>

          {/* Interactive component filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'Todo' },
                { id: 'energy', label: 'Energía' },
                { id: 'power', label: 'Potencia' },
                ...(includeTaxes ? [{ id: 'taxes' as const, label: 'Impuestos' }] : []),
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFocusComponent(item.id)}
                className={`min-h-[34px] px-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  focusComponent === item.id
                    ? 'bg-[#18181B] text-white'
                    : 'text-[#52525B] hover:bg-[#F7F8F7] hover:text-[#18181B]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Current Tariff Bar */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#18181B] shrink-0" />
                <span className="text-sm font-semibold text-[#18181B] truncate">
                  {currentLabel}
                </span>
              </div>
              <span className="font-mono text-base font-bold tabular-nums text-[#18181B] whitespace-nowrap shrink-0">
                {formatEur(
                  focusComponent === 'energy'
                    ? result.current.energyTotal
                    : focusComponent === 'power'
                      ? result.current.powerTotal
                      : focusComponent === 'taxes'
                        ? result.current.taxesTotal
                        : result.current.monthlyTotal
                )}
              </span>
            </div>

            <div className="h-10 w-full rounded-xl bg-[#F7F8F7] overflow-hidden flex items-stretch p-1 gap-0.5">
              <div
                style={{
                  width: `${currentSegs.energy}%`,
                  opacity: getOpacity('energy'),
                }}
                className="bg-[#18181B] rounded-l-lg transition-all duration-300"
                title={`Energía: ${formatEur(result.current.energyTotal)}`}
              />
              <div
                style={{
                  width: `${currentSegs.power}%`,
                  opacity: getOpacity('power'),
                }}
                className={`bg-[#52525B] transition-all duration-300 ${
                  !includeTaxes ? 'rounded-r-lg' : ''
                }`}
                title={`Potencia: ${formatEur(result.current.powerTotal)}`}
              />
              {includeTaxes && (
                <div
                  style={{
                    width: `${currentSegs.taxes}%`,
                    opacity: getOpacity('taxes'),
                  }}
                  className="bg-[#A1A1AA] rounded-r-lg transition-all duration-300"
                  title={`Impuestos: ${formatEur(result.current.taxesTotal)}`}
                />
              )}
            </div>
          </div>

          {/* Offer Tariff Bar (only when an offer has been entered) */}
          {!isOfferEmpty && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: offerPrimaryColor }}
                  />
                  <span className="text-sm font-semibold text-[#18181B] truncate">
                    {offerLabel}
                  </span>
                </div>
                <span
                  className={`font-mono text-base font-bold tabular-nums whitespace-nowrap shrink-0 ${offerTextAccent}`}
                >
                  {formatEur(
                    focusComponent === 'energy'
                      ? result.offer.energyTotal
                      : focusComponent === 'power'
                        ? result.offer.powerTotal
                        : focusComponent === 'taxes'
                          ? result.offer.taxesTotal
                          : result.offer.monthlyTotal
                  )}
                </span>
              </div>

              <div className="h-10 w-full rounded-xl bg-[#F7F8F7] overflow-hidden flex items-stretch p-1 gap-0.5">
                <div
                  style={{
                    width: `${offerSegs.energy}%`,
                    backgroundColor: offerPrimaryColor,
                    opacity: getOpacity('energy'),
                  }}
                  className="rounded-l-lg transition-all duration-300"
                  title={`Energía: ${formatEur(result.offer.energyTotal)}`}
                />
                <div
                  style={{
                    width: `${offerSegs.power}%`,
                    backgroundColor: offerSecondaryColor,
                    opacity: getOpacity('power'),
                  }}
                  className={`transition-all duration-300 ${
                    !includeTaxes ? 'rounded-r-lg' : ''
                  }`}
                  title={`Potencia: ${formatEur(result.offer.powerTotal)}`}
                />
                {includeTaxes && (
                  <div
                    style={{
                      width: `${offerSegs.taxes}%`,
                      backgroundColor: offerTaxColor,
                      opacity: getOpacity('taxes'),
                    }}
                    className="rounded-r-lg transition-all duration-300"
                    title={`Impuestos: ${formatEur(result.offer.taxesTotal)}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Clean text legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#52525B] pt-1">
            <span>
              Energía:{' '}
              <strong className="font-mono tabular-nums text-[#18181B]">
                {formatEur(result.current.energyTotal)}
              </strong>
              {!isOfferEmpty && (
                <>
                  {' '}
                  →{' '}
                  <strong className={`font-mono tabular-nums ${offerTextAccent}`}>
                    {formatEur(result.offer.energyTotal)}
                  </strong>
                </>
              )}
            </span>
            <span aria-hidden="true" className="text-[#D4D4D8]">
              ·
            </span>
            <span>
              Potencia:{' '}
              <strong className="font-mono tabular-nums text-[#18181B]">
                {formatEur(result.current.powerTotal)}
              </strong>
              {!isOfferEmpty && (
                <>
                  {' '}
                  →{' '}
                  <strong className={`font-mono tabular-nums ${offerTextAccent}`}>
                    {formatEur(result.offer.powerTotal)}
                  </strong>
                </>
              )}
            </span>
            {includeTaxes && (
              <>
                <span aria-hidden="true" className="text-[#D4D4D8]">
                  ·
                </span>
                <span>
                  Impuestos:{' '}
                  <strong className="font-mono tabular-nums text-[#18181B]">
                    {formatEur(result.current.taxesTotal)}
                  </strong>
                  {!isOfferEmpty && (
                    <>
                      {' '}
                      →{' '}
                      <strong className={`font-mono tabular-nums ${offerTextAccent}`}>
                        {formatEur(result.offer.taxesTotal)}
                      </strong>
                    </>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="h-px bg-[#EAECEB]" />

      {/* CHART 2: Coste por tramo horario (Punta / Llano / Valle) */}
      <section id="tramos" className="space-y-5 scroll-mt-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
              Energía por tramo horario
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Coste mensual de energía sin impuestos en cada franja 2.0TD
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#52525B] shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#18181B]" />
              Actual
            </span>
            {!isOfferEmpty && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: offerPrimaryColor }}
                />
                Oferta
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-2">
          {periods.map((period) => {
            const currentH = Math.max(4, (period.currentCost / maxPeriodCost) * 100);
            const offerH = isOfferEmpty
              ? 0
              : Math.max(4, (period.offerCost / maxPeriodCost) * 100);
            const delta = period.currentCost - period.offerCost;
            const periodCheaper = delta > 0.01;
            const periodCostlier = delta < -0.01;

            return (
              <div key={period.key} className="flex flex-col">
                {/* Bar Stage */}
                <div className="h-36 flex items-end justify-center gap-2 sm:gap-3 px-2 border-b border-[#EAECEB]">
                  {/* Current Bar */}
                  <div
                    className={`flex flex-col items-center justify-end h-full ${
                      isOfferEmpty ? 'w-12' : 'w-1/2 max-w-[44px]'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-medium tabular-nums text-[#52525B] mb-1.5 whitespace-nowrap">
                      {formatNumberEs(period.currentCost, 1)}€
                    </span>
                    <div
                      style={{ height: `${currentH}%` }}
                      className="w-full rounded-t-lg bg-[#18181B] transition-all duration-300"
                    />
                  </div>

                  {/* Offer Bar (only when comparing an offer) */}
                  {!isOfferEmpty && (
                    <div className="flex flex-col items-center justify-end h-full w-1/2 max-w-[44px]">
                      <span
                        className={`font-mono text-[11px] font-semibold tabular-nums mb-1.5 whitespace-nowrap ${
                          periodCostlier ? 'text-[#DC2626]' : 'text-[#3F6212]'
                        }`}
                      >
                        {formatNumberEs(period.offerCost, 1)}€
                      </span>
                      <div
                        style={{
                          height: `${offerH}%`,
                          backgroundColor: periodCostlier ? '#EF4444' : '#84CC16',
                        }}
                        className="w-full rounded-t-lg transition-all duration-300"
                      />
                    </div>
                  )}
                </div>

                {/* Labels & delta */}
                <div className="pt-3 text-center space-y-0.5">
                  <div className="text-sm font-semibold text-[#18181B]">
                    {period.label}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-[#71717A]">
                    {Math.round(period.kwh)} kWh
                  </div>
                  {!isOfferEmpty && (
                    <div
                      className={`font-mono text-xs font-semibold tabular-nums pt-0.5 ${
                        periodCheaper
                          ? 'text-[#3F6212]'
                          : periodCostlier
                            ? 'text-[#DC2626]'
                            : 'text-[#71717A]'
                      }`}
                    >
                      {periodCheaper
                        ? `−${formatEur(delta)}`
                        : periodCostlier
                          ? `+${formatEur(Math.abs(delta))}`
                          : 'Igual'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CHART 3: Proyección acumulada a 12 meses (solo cuando hay oferta activa) */}
      {!isOfferEmpty && (
        <>
          <div className="h-px bg-[#EAECEB]" />
          <section id="anual" className="space-y-4 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
              {isCosting
                ? 'Sobrecoste acumulado en 12 meses'
                : 'Ahorro acumulado en 12 meses'}
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              Toca o pasa el cursor por cada mes para ver el impacto acumulado
            </p>
          </div>
          {!isOfferEmpty && selectedPoint && (
            <div className="font-mono text-sm font-bold tabular-nums text-[#18181B]">
              Mes {selectedPoint.pt.month}:{' '}
              <span className={offerTextAccent}>
                {isSaving ? '−' : isCosting ? '+' : ''}
                {formatEur(Math.abs(selectedPoint.pt.savingsCumulative))}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#F7F8F7] p-4 sm:p-5">
          {isOfferEmpty ? (
            <div className="h-44 flex items-center justify-center text-sm text-[#71717A]">
              Completa los precios de la nueva oferta para visualizar la curva anual.
            </div>
          ) : (
            <>
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-auto overflow-visible select-none"
                role="img"
                aria-label="Gráfico de diferencia acumulada a lo largo de 12 meses"
              >
                <defs>
                  <linearGradient id="voltioAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isCosting ? '#EF4444' : '#A3E635'}
                      stopOpacity="0.45"
                    />
                    <stop
                      offset="100%"
                      stopColor={isCosting ? '#EF4444' : '#A3E635'}
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>

                {/* Minimal baseline */}
                <line
                  x1={padL}
                  y1={padT + innerH}
                  x2={svgW - padR}
                  y2={padT + innerH}
                  stroke="#E4E4E7"
                  strokeWidth="1"
                />

                {/* Area fill */}
                <path d={areaPath} fill="url(#voltioAreaGrad)" />

                {/* Crisp line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={isCosting ? '#DC2626' : '#65A30D'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Selected vertical guide */}
                {selectedPoint && (
                  <line
                    x1={selectedPoint.x}
                    y1={selectedPoint.y}
                    x2={selectedPoint.x}
                    y2={padT + innerH}
                    stroke="#18181B"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.35"
                  />
                )}

                {/* Interactive hit targets & points */}
                {points.map((p) => {
                  const isActive = p.idx === activeMonthIndex;
                  const showLabel = p.idx === 0 || p.idx === 5 || p.idx === 11 || isActive;
                  return (
                    <g
                      key={p.pt.month}
                      onMouseEnter={() => setActiveMonthIndex(p.idx)}
                      onClick={() => setActiveMonthIndex(p.idx)}
                      className="cursor-pointer"
                    >
                      {/* Wide invisible touch target */}
                      <rect
                        x={p.x - innerW / 24}
                        y={0}
                        width={innerW / 12}
                        height={svgH}
                        fill="transparent"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isActive ? 6 : 3.5}
                        fill={isActive ? '#18181B' : '#FFFFFF'}
                        stroke={isCosting ? '#DC2626' : '#65A30D'}
                        strokeWidth={isActive ? 3 : 2}
                      />
                      {showLabel && (
                        <text
                          x={p.x}
                          y={svgH - 6}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="JetBrains Mono, monospace"
                          fill={isActive ? '#18181B' : '#71717A'}
                          fontWeight={isActive ? '700' : '500'}
                        >
                          {p.pt.shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Selected month detail strip */}
              {selectedPoint && (
                <div className="mt-3 pt-3 border-t border-[#EAECEB] flex flex-wrap items-center justify-between gap-2 text-xs text-[#52525B]">
                  <span>
                    Acumulado en{' '}
                    <strong className="text-[#18181B]">
                      {selectedPoint.pt.month}{' '}
                      {selectedPoint.pt.month === 1 ? 'mes' : 'meses'}
                    </strong>
                  </span>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span>
                      Actual:{' '}
                      <strong className="text-[#18181B]">
                        {formatEur(selectedPoint.pt.currentCumulative, 0)}
                      </strong>
                    </span>
                    <span className="text-[#D4D4D8]">·</span>
                    <span>
                      Oferta:{' '}
                      <strong className={offerTextAccent}>
                        {formatEur(selectedPoint.pt.offerCumulative, 0)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      </>
      )}

      <div className="h-px bg-[#EAECEB]" />

      {/* Clean Tabular Breakdown */}
      <section id="desglose" className="space-y-4 scroll-mt-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
          Desglose detallado
        </h2>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#EAECEB] text-left text-xs font-medium text-[#71717A]">
                <th className="py-2.5 pr-3 font-medium">Concepto</th>
                <th className="py-2.5 px-2 text-right font-medium">Actual</th>
                {!isOfferEmpty && (
                  <>
                    <th className="py-2.5 px-2 text-right font-medium">Oferta</th>
                    <th className="py-2.5 pl-2 text-right font-medium">Diferencia</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F1] font-mono tabular-nums">
              {[
                {
                  label: 'Energía (kWh)',
                  current: result.current.energyTotal,
                  offer: result.offer.energyTotal,
                },
                {
                  label: 'Potencia (P1 + P2)',
                  current: result.current.powerTotal,
                  offer: result.offer.powerTotal,
                },
                ...(includeTaxes
                  ? [
                      {
                        label: 'Impuestos (IEE + IVA)',
                        current: result.current.taxesTotal,
                        offer: result.offer.taxesTotal,
                      },
                    ]
                  : []),
              ].map((row) => {
                const diff = row.current - row.offer;
                return (
                  <tr key={row.label} className="text-[#18181B]">
                    <td className="py-3 pr-3 font-sans text-[#52525B]">{row.label}</td>
                    <td className="py-3 px-2 text-right">{formatEur(row.current)}</td>
                    {!isOfferEmpty && (
                      <>
                        <td className="py-3 px-2 text-right">{formatEur(row.offer)}</td>
                        <td
                          className={`py-3 pl-2 text-right font-medium ${
                            diff > 0.01
                              ? 'text-[#3F6212]'
                              : diff < -0.01
                                ? 'text-[#DC2626]'
                                : 'text-[#71717A]'
                          }`}
                        >
                          {diff > 0.01
                            ? `−${formatEur(diff)}`
                            : diff < -0.01
                              ? `+${formatEur(Math.abs(diff))}`
                              : '0,00 €'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {/* Monthly Total Row */}
              <tr className="font-semibold text-[#18181B] bg-[#F7F8F7]/70">
                <td className="py-3.5 pr-3 pl-2 font-sans rounded-l-lg">Total mensual</td>
                <td
                  className={`py-3.5 px-2 text-right ${
                    isOfferEmpty ? 'pr-2 rounded-r-lg' : ''
                  }`}
                >
                  {formatEur(result.current.monthlyTotal)}
                </td>
                {!isOfferEmpty && (
                  <>
                    <td className="py-3.5 px-2 text-right">
                      {formatEur(result.offer.monthlyTotal)}
                    </td>
                    <td className={`py-3.5 pl-2 pr-2 text-right rounded-r-lg ${offerTextAccent}`}>
                      {isSaving
                        ? `−${formatEur(Math.abs(result.monthlySavings))}`
                        : isCosting
                          ? `+${formatEur(Math.abs(result.monthlySavings))}`
                          : '0,00 €'}
                    </td>
                  </>
                )}
              </tr>

              {/* Annual Total Row */}
              <tr className="text-[#18181B]">
                <td className="py-3 pr-3 font-sans font-medium text-[#18181B]">
                  Proyección anual
                </td>
                <td className="py-3 px-2 text-right">
                  {formatEur(result.current.annualTotal, 0)}
                </td>
                {!isOfferEmpty && (
                  <>
                    <td className="py-3 px-2 text-right">
                      {formatEur(result.offer.annualTotal, 0)}
                    </td>
                    <td className={`py-3 pl-2 text-right font-bold ${offerTextAccent}`}>
                      {isSaving
                        ? `−${formatEur(Math.abs(result.annualSavings), 0)}`
                        : isCosting
                          ? `+${formatEur(Math.abs(result.annualSavings), 0)}`
                          : '0 €'}
                    </td>
                  </>
                )}
              </tr>

              {/* Effective €/kWh */}
              <tr className="text-xs text-[#71717A]">
                <td className="py-2.5 pr-3 font-sans">Coste medio efectivo</td>
                <td className="py-2.5 px-2 text-right">
                  {formatNumberEs(result.current.effectiveKwhPrice, 3)} €/kWh
                </td>
                {!isOfferEmpty && (
                  <>
                    <td className="py-2.5 px-2 text-right">
                      {formatNumberEs(result.offer.effectiveKwhPrice, 3)} €/kWh
                    </td>
                    <td className="py-2.5 pl-2 text-right">—</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
