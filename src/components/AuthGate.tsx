import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { normalizeInviteCode } from '../utils/cloudSync';

interface AuthGateProps {
  user: User | null;
  authReady: boolean;
  profileLoading?: boolean;
  needsInviteCode?: boolean;
  prefilledCode?: string;
  onUserRefreshed: () => void;
  onRedeemInviteCode: (
    code: string
  ) => Promise<{ ok: true } | { ok: false; reason: 'invalid_format' | 'invalid_code' | 'error' }>;
}

type AuthFormMode = 'login' | 'signup';

function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese correo. Cambia a «Iniciar sesión».';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Introduce un correo electrónico válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El acceso con correo y contraseña aún no está activado en Firebase Console. Mientras tanto, puedes entrar con Google.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes o entra con correo y contraseña.';
    default:
      return 'No se pudo completar el acceso. Inténtalo de nuevo.';
  }
}

export const AuthGate: React.FC<AuthGateProps> = ({
  user,
  authReady,
  profileLoading = false,
  needsInviteCode = false,
  prefilledCode = '',
  onUserRefreshed,
  onRedeemInviteCode,
}) => {
  const [mode, setMode] = useState<AuthFormMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState(prefilledCode);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!authReady || profileLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <p className="font-display text-xl font-extrabold tracking-tight text-[#18181B]">
            Voltio
          </p>
          <p className="text-sm text-[#71717A]">Verificando acceso…</p>
        </div>
      </div>
    );
  }

  // Case 1: Signed in via Email/Password, but email not yet verified
  if (user && !user.emailVerified) {
    const handleResendVerification = async () => {
      setBusy(true);
      setErrorMsg(null);
      setInfoMsg(null);
      try {
        await sendEmailVerification(user);
        setInfoMsg('Te hemos enviado un nuevo enlace de verificación.');
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        setErrorMsg(mapFirebaseAuthError(code));
      } finally {
        setBusy(false);
      }
    };

    const handleCheckVerified = async () => {
      setBusy(true);
      setErrorMsg(null);
      try {
        await user.reload();
        if (auth.currentUser?.emailVerified) {
          onUserRefreshed();
        } else {
          setInfoMsg('Todavía no consta como verificado. Revisa tu bandeja de entrada o spam.');
        }
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="min-h-screen bg-white text-[#18181B] flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <p className="font-display text-lg font-extrabold tracking-tight">Voltio</p>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Verifica tu correo electrónico
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Hemos enviado un enlace de confirmación a{' '}
              <span className="font-mono text-[#18181B]">{user.email}</span>. Ábrelo y vuelve aquí
              para continuar.
            </p>
          </div>

          {infoMsg && <p className="text-xs font-medium text-[#3F6212]">{infoMsg}</p>}
          {errorMsg && <p className="text-xs font-medium text-[#DC2626]">{errorMsg}</p>}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleCheckVerified}
              className="w-full min-h-[46px] rounded-xl bg-[#A3E635] text-[#141416] text-sm font-semibold hover:bg-[#84CC16] disabled:opacity-50 transition-colors cursor-pointer"
            >
              Ya lo he verificado
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="w-full min-h-[46px] rounded-xl bg-[#F7F8F7] text-[#18181B] text-sm font-medium hover:bg-[#EAECEB] disabled:opacity-50 transition-colors cursor-pointer"
            >
              Reenviar correo
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="w-full min-h-[42px] text-xs font-medium text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Signed in + verified, but needs an invite code to activate access
  if (user && needsInviteCode) {
    const handleRedeem = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);
      setInfoMsg(null);

      const cleaned = normalizeInviteCode(inviteCode);
      if (cleaned.length < 5) {
        setErrorMsg('Introduce un código de invitación válido (al menos 5 caracteres).');
        return;
      }

      setBusy(true);
      try {
        const res = await onRedeemInviteCode(cleaned);
        if (!res.ok) {
          if (res.reason === 'invalid_format') {
            setErrorMsg('El formato del código no es válido.');
          } else {
            setErrorMsg(
              'Código de invitación no válido o desactivado. Pide el código actual a quien te invitó.'
            );
          }
        }
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="min-h-screen bg-white text-[#18181B] flex flex-col justify-between px-6 py-10">
        <div className="w-full max-w-sm mx-auto my-auto space-y-7">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-extrabold tracking-tight">Voltio</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#71717A]">
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                Solo con invitación
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Introduce tu código de invitación
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              Has iniciado sesión como{' '}
              <span className="font-mono text-[#18181B]">{user.email}</span>. Para activar tu
              espacio privado y sincronizado, introduce el código compartido contigo.
            </p>
          </div>

          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="invite-code-input"
                className="block text-sm font-medium text-[#18181B]"
              >
                Código de invitación
              </label>
              <input
                id="invite-code-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Ej. VOLTIO-7K9M2A"
                maxLength={32}
                className="w-full min-h-[50px] px-4 rounded-xl bg-[#F7F8F7] font-mono text-base font-semibold tracking-wider uppercase text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal placeholder:tracking-normal focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none transition-colors"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-medium text-[#DC2626] leading-relaxed">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-xl bg-[#A3E635] text-[#141416] text-sm font-semibold hover:bg-[#84CC16] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
            >
              {busy ? 'Comprobando código…' : 'Activar mi acceso'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full min-h-[42px] text-xs font-medium text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
          >
            Usar otra cuenta
          </button>
        </div>

        <p className="text-center text-xs text-[#71717A] mt-8">
          Solo necesitas introducir el código una vez por cuenta
        </p>
      </div>
    );
  }

  // Case 3: Signed out -> Login / Sign-up screen
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Introduce tu correo y contraseña.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Las contraseñas no coinciden.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg('Escribe primero tu correo para enviarte el enlace de recuperación.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg('Te hemos enviado un correo para restablecer tu contraseña.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#18181B] flex flex-col justify-between px-6 py-10">
      <div className="max-w-sm w-full mx-auto my-auto space-y-7">
        {/* Brand & heading */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-xl font-extrabold tracking-tight text-[#18181B]">
              Voltio
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#71717A]">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Acceso con invitación
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            {mode === 'login' ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta privada'}
          </h1>
          <p className="text-sm text-[#52525B] leading-relaxed">
            {mode === 'login'
              ? 'Tu tarifa y consumo sincronizados en tiempo real entre ordenador y móvil.'
              : 'Si es tu primera vez, te pediremos tu código de invitación justo después.'}
          </p>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Tipo de acceso"
          className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className={`min-h-[40px] px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#18181B] shadow-xs'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className={`min-h-[40px] px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-[#18181B] shadow-xs'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Google Sign-In (Primary fast path) */}
        <button
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
          className="w-full min-h-[48px] px-4 rounded-xl bg-[#A3E635] text-[#141416] text-sm font-semibold hover:bg-[#84CC16] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
        >
          Continuar con Google
        </button>

        {/* Minimal Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#EAECEB]" />
          <span className="text-xs text-[#71717A]">o con contraseña</span>
          <div className="h-px flex-1 bg-[#EAECEB]" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-[#18181B]">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#F7F8F7] text-[15px] text-[#18181B] placeholder:text-[#A1A1AA] hover:bg-[#F1F3F1] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[#18181B]"
              >
                Contraseña
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={busy}
                  className="text-xs font-medium text-[#71717A] hover:text-[#18181B] underline underline-offset-4 decoration-[#D4D4D8] cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'login' ? 'Introduce tu contraseña' : 'Mínimo 6 caracteres'
                }
                className="w-full min-h-[46px] pl-3.5 pr-12 rounded-xl bg-[#F7F8F7] text-[15px] text-[#18181B] placeholder:text-[#A1A1AA] hover:bg-[#F1F3F1] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#18181B] cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label
                htmlFor="signup-password-confirm"
                className="block text-sm font-medium text-[#18181B]"
              >
                Repite la contraseña
              </label>
              <input
                id="signup-password-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#F7F8F7] text-[15px] text-[#18181B] placeholder:text-[#A1A1AA] hover:bg-[#F1F3F1] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none transition-colors"
              />
            </div>
          )}

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-[#DC2626] leading-relaxed">
              {errorMsg}
            </p>
          )}
          {infoMsg && (
            <p role="status" className="text-xs font-medium text-[#3F6212] leading-relaxed">
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[48px] rounded-xl bg-[#18181B] text-white text-sm font-semibold hover:bg-[#27272A] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
          >
            {busy
              ? 'Procesando…'
              : mode === 'login'
                ? 'Entrar con contraseña'
                : 'Crear cuenta'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-[#71717A] mt-8">
        Acceso privado con código de invitación · Sincronización en la nube
      </p>
    </div>
  );
};
