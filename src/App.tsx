import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ArrowLeft, Check, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { AuthGate } from './components/AuthGate';
import { ComparisonCharts } from './components/ComparisonCharts';
import { ConsumptionPanel } from './components/ConsumptionPanel';
import { SavingsHero } from './components/SavingsHero';
import { TariffForm } from './components/TariffForm';
import { auth, isAdminUser } from './firebase';
import { ConsumptionProfile, TariffConfig } from './types/tariff';
import { compareTariffs, formatNumberEs } from './utils/calculations';
import {
  normalizeInviteCode,
  redeemInviteCodeForUser,
  saveUserProfileToCloud,
  subscribeUserProfile,
} from './utils/cloudSync';
import {
  DEFAULT_CONSUMPTION,
  DEFAULT_CURRENT_TARIFF,
  EMPTY_OFFER_TARIFF,
  loadPersistedState,
  saveConsumption,
  saveCurrentTariff,
  saveOfferTariff,
} from './utils/storage';

type ConfigTab = 'current' | 'consumption';
type SyncStatus = 'syncing' | 'synced' | 'offline';
type ProfileGateState = 'loading' | 'active' | 'needs_invite';

const INVITE_SESSION_KEY = 'voltio:pendingInviteCode';

function readInitialInviteCode(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('code');
    if (fromUrl) {
      const normalized = normalizeInviteCode(fromUrl);
      if (normalized) {
        window.sessionStorage.setItem(INVITE_SESSION_KEY, normalized);
        // Clean ?code=... from URL bar without reload
        const cleanUrl = `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
        return normalized;
      }
    }
    return window.sessionStorage.getItem(INVITE_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export default function App() {
  const initialState = useMemo(() => loadPersistedState(), []);
  const prefilledCode = useMemo(() => readInitialInviteCode(), []);

  // Auth & Invite Gate state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [profileGate, setProfileGate] = useState<ProfileGateState>('loading');
  const [, setRefreshTick] = useState<number>(0);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Domain state
  const [currentTariff, setCurrentTariff] = useState<TariffConfig>(
    initialState.currentTariff
  );
  const [offerTariff, setOfferTariff] = useState<TariffConfig>(
    initialState.offerTariff
  );
  const [consumption, setConsumption] = useState<ConsumptionProfile>(
    initialState.consumption
  );
  const [configTab, setConfigTab] = useState<ConfigTab>('current');
  const [showOfferForm, setShowOfferForm] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const cloudHydratedRef = useRef(false);
  const cloudDocExistsRef = useRef(false);
  const needsAdminCodeBackfillRef = useRef(false);
  const applyingCloudUpdateRef = useRef(false);
  const latestTariffRef = useRef(currentTariff);
  const latestConsumptionRef = useRef(consumption);
  const syncDebounceRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  latestTariffRef.current = currentTariff;
  latestConsumptionRef.current = consumption;

  // Surface fatal Firestore errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        cloudHydratedRef.current = false;
        cloudDocExistsRef.current = false;
        needsAdminCodeBackfillRef.current = false;
        setProfileGate('loading');
        setShowAccountModal(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const isVerifiedUser = Boolean(user && user.emailVerified);
  const isAdmin = isAdminUser(user);

  // Real-time Firestore profile subscription & invite-code gate check
  useEffect(() => {
    if (!authReady || !isVerifiedUser || !user) return;

    setSyncStatus('syncing');
    setProfileGate('loading');
    cloudHydratedRef.current = false;

    const unsubscribe = subscribeUserProfile(
      user.uid,
      (snap) => {
        if (snap.exists) {
          cloudDocExistsRef.current = true;
          needsAdminCodeBackfillRef.current = isAdmin && !snap.hasInviteCode;
          applyingCloudUpdateRef.current = true;
          if (snap.currentTariff) {
            setCurrentTariff(snap.currentTariff);
            saveCurrentTariff(snap.currentTariff);
          }
          if (snap.consumption) {
            setConsumption(snap.consumption);
            saveConsumption(snap.consumption);
          }
          cloudHydratedRef.current = true;
          setProfileGate('active');
          setSyncStatus('synced');
          try {
            window.sessionStorage.removeItem(INVITE_SESSION_KEY);
          } catch {
            // Ignore storage errors
          }
          window.setTimeout(() => {
            applyingCloudUpdateRef.current = false;
          }, 0);
        } else {
          cloudDocExistsRef.current = false;
          if (isAdmin) {
            // Admin profile auto-bootstraps without requiring an invite code
            cloudHydratedRef.current = true;
            setProfileGate('active');
            void saveUserProfileToCloud(
              user.uid,
              latestTariffRef.current,
              latestConsumptionRef.current,
              { existsInCloud: false, inviteCode: 'ADMIN' }
            )
              .then(() => {
                cloudDocExistsRef.current = true;
                needsAdminCodeBackfillRef.current = false;
                setSyncStatus('synced');
              })
              .catch((err) => {
                setFatalError(err instanceof Error ? err : new Error(String(err)));
              });
          } else {
            // Non-admin new user must redeem an active invite code
            cloudHydratedRef.current = false;
            setProfileGate('needs_invite');
          }
        }
      },
      (err) => {
        setFatalError(err);
      }
    );

    return () => {
      unsubscribe();
      if (syncDebounceRef.current) {
        window.clearTimeout(syncDebounceRef.current);
      }
    };
  }, [authReady, isVerifiedUser, isAdmin, user]);

  // Persist currentTariff & consumption locally + debounced cloud sync
  useEffect(() => {
    if (isFirstRender.current) return;

    saveCurrentTariff(currentTariff);
    saveConsumption(consumption);

    if (!authReady || !isVerifiedUser || !user || profileGate !== 'active') return;
    if (!cloudHydratedRef.current || applyingCloudUpdateRef.current) return;

    setSyncStatus('syncing');
    if (syncDebounceRef.current) {
      window.clearTimeout(syncDebounceRef.current);
    }
    syncDebounceRef.current = window.setTimeout(() => {
      void saveUserProfileToCloud(user.uid, currentTariff, consumption, {
        existsInCloud: cloudDocExistsRef.current,
        inviteCode: isAdmin ? 'ADMIN' : undefined,
        backfillAdminInviteCode: needsAdminCodeBackfillRef.current,
      })
        .then(() => {
          cloudDocExistsRef.current = true;
          needsAdminCodeBackfillRef.current = false;
          setSyncStatus('synced');
        })
        .catch((err) => {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }, 600);
  }, [currentTariff, consumption, authReady, isVerifiedUser, isAdmin, user, profileGate]);

  // Persist offer tariff draft locally
  useEffect(() => {
    if (isFirstRender.current) return;
    saveOfferTariff(offerTariff);
  }, [offerTariff]);

  useEffect(() => {
    isFirstRender.current = false;
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (syncDebounceRef.current) window.clearTimeout(syncDebounceRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  const handleRedeemInviteCode = async (code: string) => {
    if (!user) return { ok: false as const, reason: 'error' as const };
    const result = await redeemInviteCodeForUser(
      user.uid,
      code,
      DEFAULT_CURRENT_TARIFF,
      DEFAULT_CONSUMPTION
    );
    if (result.ok) {
      try {
        window.sessionStorage.removeItem(INVITE_SESSION_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    return result;
  };

  const comparison = useMemo(
    () => compareTariffs(currentTariff, offerTariff, consumption),
    [currentTariff, offerTariff, consumption]
  );

  const isOfferEmpty = useMemo(() => {
    const energyEmpty =
      offerTariff.mode === 'fixed'
        ? offerTariff.fixedPrice <= 0
        : offerTariff.puntaPrice <= 0 &&
          offerTariff.llanoPrice <= 0 &&
          offerTariff.vallePrice <= 0;
    const powerEmpty = offerTariff.powerP1Price <= 0 && offerTariff.powerP2Price <= 0;
    return energyEmpty && powerEmpty;
  }, [offerTariff]);

  // Gate the app until authenticated, email-verified, and activated via invite code (or admin)
  if (!authReady || !isVerifiedUser || !user || profileGate !== 'active') {
    return (
      <AuthGate
        user={user}
        authReady={authReady}
        profileLoading={Boolean(isVerifiedUser && profileGate === 'loading')}
        needsInviteCode={Boolean(isVerifiedUser && profileGate === 'needs_invite')}
        prefilledCode={prefilledCode}
        onUserRefreshed={() => setRefreshTick((n) => n + 1)}
        onRedeemInviteCode={handleRedeemInviteCode}
      />
    );
  }

  const scrollLeftToTop = () => {
    leftPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTopNewOfferClick = () => {
    if (showOfferForm && !isOfferEmpty) {
      setOfferTariff({
        ...EMPTY_OFFER_TARIFF,
        mode: offerTariff.mode,
        name: '',
      });
      showToast('Campos reiniciados para una nueva oferta');
    } else {
      setShowOfferForm(true);
    }
    scrollLeftToTop();
  };

  const handleSelectConfigTab = (tab: ConfigTab) => {
    setConfigTab(tab);
    setShowOfferForm(false);
    scrollLeftToTop();
  };

  const handleClearOffer = () => {
    setOfferTariff({
      ...EMPTY_OFFER_TARIFF,
      mode: offerTariff.mode,
      name: '',
    });
    showToast('Oferta limpiada');
  };

  const handleAdoptOfferAsCurrent = () => {
    if (isOfferEmpty) return;
    setCurrentTariff({
      ...offerTariff,
      name: offerTariff.name.trim() || 'Mi tarifa actual',
    });
    setOfferTariff({
      ...EMPTY_OFFER_TARIFF,
      mode: offerTariff.mode,
      name: '',
    });
    setShowOfferForm(false);
    setConfigTab('current');
    showToast('Nueva oferta guardada y sincronizada como tu tarifa actual');
  };

  const handleResetCurrentDefaults = () => {
    setCurrentTariff(DEFAULT_CURRENT_TARIFF);
    setConsumption(DEFAULT_CONSUMPTION);
    showToast('Valores de referencia restablecidos');
  };

  const currentTariffSummary = `${
    currentTariff.name.trim() || 'Tu tarifa'
  } · ${currentTariff.mode === 'fixed' ? 'Fijo 24h' : '3 tramos'} · ${Math.round(
    consumption.monthlyKwh
  )} kWh/mes · ${formatNumberEs(consumption.powerP1Kw, 1)} kW`;

  const syncLabel =
    syncStatus === 'syncing'
      ? 'Sincronizando…'
      : syncStatus === 'synced'
        ? 'Sincronizado en la nube'
        : 'Guardado local';

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-white text-[#18181B] flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 lg:static shrink-0 z-30 h-12 lg:h-16 bg-white/95 backdrop-blur-md border-b border-[#EAECEB]">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              leftPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              rightPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-lg lg:text-xl font-extrabold tracking-tight text-[#18181B] whitespace-nowrap shrink-0"
          >
            Voltio
          </a>

          {/* Zone 2: Concise single-line nav links (desktop) */}
          <nav
            aria-label="Secciones de la comparativa"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#52525B]"
          >
            <a
              href="#mensual"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('mensual');
              }}
              className="hover:text-[#18181B] hover:underline underline-offset-4 decoration-[#A3E635] decoration-2 transition-colors whitespace-nowrap shrink-0"
            >
              Mensual
            </a>
            <a
              href="#tramos"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('tramos');
              }}
              className="hover:text-[#18181B] hover:underline underline-offset-4 decoration-[#A3E635] decoration-2 transition-colors whitespace-nowrap shrink-0"
            >
              Por tramos
            </a>
            {!isOfferEmpty && (
              <a
                href="#anual"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('anual');
                }}
                className="hover:text-[#18181B] hover:underline underline-offset-4 decoration-[#A3E635] decoration-2 transition-colors whitespace-nowrap shrink-0"
              >
                Anual
              </a>
            )}
            <a
              href="#desglose"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('desglose');
              }}
              className="hover:text-[#18181B] hover:underline underline-offset-4 decoration-[#A3E635] decoration-2 transition-colors whitespace-nowrap shrink-0"
            >
              Desglose
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleTopNewOfferClick}
              className="min-h-[38px] lg:min-h-[40px] px-4 py-1.5 rounded-xl bg-[#18181B] text-white text-xs sm:text-sm font-medium hover:bg-[#27272A] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Nueva oferta
            </button>
          </div>
        </div>
      </header>

      {/* Subtle floating feedback toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 lg:top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#18181B] text-white text-xs sm:text-sm font-medium shadow-lg shadow-black/10 flex items-center gap-2 whitespace-nowrap"
        >
          <Check className="w-4 h-4 text-[#A3E635] shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content: independent scroll columns on desktop (lg:), natural flow on mobile */}
      <main
        id="top"
        className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 lg:py-0 lg:min-h-0 lg:overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start lg:items-stretch lg:h-full">
          {/* MOBILE-ONLY HERO */}
          <div className="lg:hidden">
            <SavingsHero
              result={comparison}
              currentTariff={currentTariff}
              offerTariff={offerTariff}
              includeTaxes={consumption.includeTaxes}
              isOfferEmpty={isOfferEmpty}
              showOfferForm={showOfferForm}
              onStartOffer={handleTopNewOfferClick}
            />
          </div>

          {/* LEFT PANE: Configuration & Offer Editor (independently scrollable on desktop) */}
          <div
            ref={leftPaneRef}
            className="lg:col-span-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain voltio-scroll lg:py-8 lg:pr-4 space-y-6"
          >
            {/* Desktop Title & 2-tab User Config Menu (Mi tarifa / Consumo only) */}
            <div className="space-y-4">
              <div className="hidden lg:block space-y-1">
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#18181B]">
                  Compara tu tarifa de la luz
                </h1>
                <p className="text-sm text-[#52525B]">
                  Configura tu tarifa actual y pulsa «Nueva oferta» para calcular el ahorro.
                </p>
              </div>

              {/* Desktop segmented control: ONLY Mi tarifa & Consumo */}
              <div
                role="tablist"
                aria-label="Configuración de tus datos"
                className="hidden lg:grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!showOfferForm && configTab === 'current'}
                  onClick={() => handleSelectConfigTab('current')}
                  className={`min-h-[42px] px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !showOfferForm && configTab === 'current'
                      ? 'bg-white text-[#18181B] shadow-xs'
                      : 'text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  Mi tarifa
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!showOfferForm && configTab === 'consumption'}
                  onClick={() => handleSelectConfigTab('consumption')}
                  className={`min-h-[42px] px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !showOfferForm && configTab === 'consumption'
                      ? 'bg-white text-[#18181B] shadow-xs'
                      : 'text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  Consumo
                </button>
              </div>
            </div>

            {/* Active Panel Body */}
            <div className="space-y-6">
              {showOfferForm ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setShowOfferForm(false)}
                        aria-label="Volver a mi tarifa"
                        className="min-h-[40px] min-w-[40px] -ml-2 flex items-center justify-center rounded-xl text-[#52525B] hover:text-[#18181B] hover:bg-[#F7F8F7] transition-colors shrink-0 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B] truncate">
                        Nueva oferta a comparar
                      </h2>
                    </div>
                    {!isOfferEmpty && (
                      <button
                        type="button"
                        onClick={handleClearOffer}
                        className="min-h-[36px] px-2 text-xs font-medium text-[#71717A] hover:text-[#18181B] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        Limpiar
                      </button>
                    )}
                  </div>

                  <TariffForm
                    idPrefix="offer"
                    tariff={offerTariff}
                    onChange={setOfferTariff}
                    namePlaceholder="Ej. Endesa, Repsol, Octopus..."
                    helperText="Introduce los precios de la compañía que quieres comparar. El ahorro aparecerá automáticamente a la derecha."
                  />

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={isOfferEmpty}
                      onClick={handleAdoptOfferAsCurrent}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F7F8F7] text-sm font-medium text-[#18181B] hover:bg-[#EAECEB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Usar como mi tarifa actual
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowOfferForm(false)}
                      className="min-h-[44px] px-3 py-2 text-xs font-medium text-[#52525B] hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Volver a mis datos
                    </button>
                  </div>
                </div>
              ) : configTab === 'current' ? (
                <div className="space-y-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
                      Mi tarifa actual
                    </h2>
                    <span className="text-xs font-medium text-[#3F6212] whitespace-nowrap shrink-0">
                      {syncLabel}
                    </span>
                  </div>

                  <TariffForm
                    idPrefix="current"
                    tariff={currentTariff}
                    onChange={setCurrentTariff}
                    namePlaceholder="Ej. Mi compañía actual"
                    helperText="Tus precios se sincronizan automáticamente entre tu ordenador y tu móvil."
                  />

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleResetCurrentDefaults}
                      className="min-h-[44px] px-3 py-2 text-xs font-medium text-[#71717A] hover:text-[#18181B] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      Restablecer ejemplo
                    </button>

                    {!isOfferEmpty && (
                      <button
                        type="button"
                        onClick={() => setShowOfferForm(true)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F7F8F7] text-xs font-semibold text-[#18181B] hover:bg-[#EAECEB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Editar oferta activa
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg font-bold tracking-tight text-[#18181B]">
                      Consumo y potencia
                    </h2>
                    <span className="text-xs font-medium text-[#3F6212] whitespace-nowrap shrink-0">
                      {syncLabel}
                    </span>
                  </div>

                  <ConsumptionPanel
                    consumption={consumption}
                    onChange={setConsumption}
                  />
                </div>
              )}
            </div>

            {/* Quiet context & account footer on left panel */}
            <div className="pt-4 border-t border-[#EAECEB] space-y-2.5 text-xs text-[#71717A]">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{currentTariffSummary}</span>
                {!showOfferForm && configTab === 'current' && (
                  <button
                    type="button"
                    onClick={() => handleSelectConfigTab('consumption')}
                    className="font-medium text-[#18181B] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ajustar
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{user.email}</span>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="font-medium text-[#18181B] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAdmin ? 'Códigos y cuenta' : 'Cuenta y contraseña'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Live Results & Visualizations (independently scrollable on desktop) */}
          <div
            ref={rightPaneRef}
            className="lg:col-span-7 lg:h-full lg:overflow-y-auto lg:overscroll-contain voltio-scroll lg:py-8 lg:pl-2 space-y-10"
          >
            {/* Desktop Hero */}
            <div className="hidden lg:block">
              <SavingsHero
                result={comparison}
                currentTariff={currentTariff}
                offerTariff={offerTariff}
                includeTaxes={consumption.includeTaxes}
                isOfferEmpty={isOfferEmpty}
                showOfferForm={showOfferForm}
                onStartOffer={handleTopNewOfferClick}
              />
            </div>

            <div className="lg:hidden h-px bg-[#EAECEB]" />

            <ComparisonCharts
              result={comparison}
              currentTariff={currentTariff}
              offerTariff={offerTariff}
              includeTaxes={consumption.includeTaxes}
              isOfferEmpty={isOfferEmpty}
            />

            {/* Quiet minimalist footer at end of right scroll pane on desktop */}
            <footer className="hidden lg:flex items-center justify-between pt-6 border-t border-[#EAECEB] text-xs text-[#71717A]">
              <span>Voltio · Estimación orientativa tarifa doméstica 2.0TD</span>
              <span>Sincronización privada en la nube</span>
            </footer>
          </div>
        </div>
      </main>

      {/* Account, Invite Codes (Admin), Password & Sign-out Modal */}
      {showAccountModal && (
        <AccountModal
          user={user}
          syncStatus={syncStatus}
          onClose={() => setShowAccountModal(false)}
          onFatalError={(err) => setFatalError(err)}
        />
      )}

      {/* Mobile Ergonomic Bottom Tab Bar: ONLY Mi tarifa & Consumo */}
      <nav
        aria-label="Configuración móvil"
        className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-[#EAECEB] lg:hidden"
      >
        <div className="grid grid-cols-2 h-full max-w-lg mx-auto">
          {(
            [
              { id: 'current', label: 'Mi tarifa', Icon: Zap },
              { id: 'consumption', label: 'Consumo', Icon: SlidersHorizontal },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = !showOfferForm && configTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectConfigTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer ${
                  active ? 'text-[#18181B]' : 'text-[#71717A]'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-6 rounded-full transition-colors ${
                    active ? 'bg-[#A3E635] text-[#141416]' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                </span>
                <span
                  className={`text-[11px] leading-none whitespace-nowrap ${
                    active ? 'font-semibold text-[#18181B]' : 'font-medium'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
