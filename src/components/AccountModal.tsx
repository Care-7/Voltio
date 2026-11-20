import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  linkWithCredential,
  signOut,
  updatePassword,
  User,
} from 'firebase/auth';
import { Check, Copy, Plus, Share2, Trash2, X } from 'lucide-react';
import { auth, isAdminUser } from '../firebase';
import {
  createInviteCode,
  deleteInviteCode,
  generateRandomInviteCode,
  InviteCodeRecord,
  normalizeInviteCode,
  subscribeInviteCodes,
  toggleInviteCodeActive,
} from '../utils/cloudSync';

interface AccountModalProps {
  user: User;
  syncStatus: 'syncing' | 'synced' | 'offline';
  onClose: () => void;
  onFatalError: (err: Error) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  user,
  syncStatus,
  onClose,
  onFatalError,
}) => {
  const isAdmin = isAdminUser(user);
  const hasPasswordProvider = user.providerData.some(
    (p) => p.providerId === 'password'
  );

  // Admin invite codes state
  const [codes, setCodes] = useState<InviteCodeRecord[]>([]);
  const [customCode, setCustomCode] = useState('');
  const [codeLabel, setCodeLabel] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeInviteCodes(user.uid, setCodes, onFatalError);
    return () => unsub();
  }, [isAdmin, user.uid, onFatalError]);

  const markCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(key);
    } catch {
      // Fallback if clipboard API blocked
    }
  };

  const handleCreateQuickCode = async () => {
    setCodeError(null);
    setCodeBusy(true);
    try {
      const code = generateRandomInviteCode();
      await createInviteCode(user.uid, code, 'Familia y amigos');
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    } finally {
      setCodeBusy(false);
    }
  };

  const handleCreateCustomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const cleaned = normalizeInviteCode(customCode);
    if (cleaned.length < 5) {
      setCodeError('Escribe al menos 5 caracteres (letras, números o guiones).');
      return;
    }
    setCodeBusy(true);
    try {
      await createInviteCode(user.uid, cleaned, codeLabel || 'Invitación');
      setCustomCode('');
      setCodeLabel('');
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : 'No se pudo crear el código.');
    } finally {
      setCodeBusy(false);
    }
  };

  const handleToggleCode = async (item: InviteCodeRecord) => {
    setCodeError(null);
    try {
      await toggleInviteCodeActive(item.code, !item.active);
    } catch (err) {
      onFatalError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeleteCode = async (code: string) => {
    setCodeError(null);
    try {
      await deleteInviteCode(code);
    } catch (err) {
      onFatalError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: 'err',
        text: 'La contraseña debe tener al menos 8 caracteres.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'err', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (!user.email) {
      setPasswordFeedback({ type: 'err', text: 'Tu cuenta no tiene un correo asociado.' });
      return;
    }

    setPasswordBusy(true);
    try {
      if (hasPasswordProvider) {
        await updatePassword(user, newPassword);
        setPasswordFeedback({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
      } else {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, credential);
        setPasswordFeedback({
          type: 'ok',
          text: 'Contraseña vinculada. Ya puedes entrar con correo y contraseña.',
        });
      }
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setPasswordFeedback({
          type: 'err',
          text: 'Activa primero «Correo electrónico/contraseña» en Firebase Console → Authentication → Sign-in method.',
        });
      } else if (code === 'auth/requires-recent-login') {
        setPasswordFeedback({
          type: 'err',
          text: 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.',
        });
      } else {
        setPasswordFeedback({
          type: 'err',
          text: 'No se pudo guardar la contraseña. Inténtalo de nuevo.',
        });
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onClose();
  };

  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto voltio-scroll rounded-t-3xl sm:rounded-3xl bg-white p-6 sm:p-7 space-y-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <h2
              id="account-modal-title"
              className="font-display text-lg font-bold tracking-tight text-[#18181B]"
            >
              {isAdmin ? 'Cuenta y códigos de invitación' : 'Cuenta y sincronización'}
            </h2>
            <p className="text-xs text-[#71717A] truncate">
              {user.email} ·{' '}
              {syncStatus === 'synced'
                ? 'Sincronizado en la nube'
                : syncStatus === 'syncing'
                  ? 'Sincronizando…'
                  : 'Sin conexión'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[40px] min-w-[40px] -mt-1 -mr-2 flex items-center justify-center rounded-xl text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F8F7] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Admin Invite Codes Section */}
        {isAdmin && (
          <>
            <div className="h-px bg-[#EAECEB]" />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-[#18181B]">
                    Códigos para amigos y familia
                  </h3>
                  <p className="text-xs text-[#52525B]">
                    Comparte un código activo. Cada persona tendrá sus propios datos privados.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={codeBusy}
                  onClick={handleCreateQuickCode}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#A3E635] text-[#141416] text-xs font-semibold hover:bg-[#84CC16] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Generar código
                </button>
              </div>

              {/* Active / Existing Codes List */}
              {codes.length > 0 ? (
                <div className="space-y-2.5">
                  {codes.map((item) => {
                    const shareText = `Te invito a usar Voltio para comparar tarifas de la luz:\n${shareOrigin}/?code=${item.code}\nCódigo: ${item.code}`;
                    return (
                      <div
                        key={item.code}
                        className="rounded-2xl bg-[#F7F8F7] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`font-mono text-sm font-bold tracking-wide ${
                                item.active
                                  ? 'text-[#18181B]'
                                  : 'text-[#71717A] line-through'
                              }`}
                            >
                              {item.code}
                            </span>
                            <span className="text-xs text-[#D4D4D8]">·</span>
                            <span
                              className={`text-xs font-medium ${
                                item.active ? 'text-[#3F6212]' : 'text-[#71717A]'
                              }`}
                            >
                              {item.active ? 'Activo' : 'Desactivado'}
                            </span>
                          </div>
                          {item.label && (
                            <p className="text-xs text-[#71717A] truncate">{item.label}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleCopyText(item.code, `code-${item.code}`)}
                            title="Copiar solo el código"
                            className="min-h-[36px] px-2.5 rounded-lg bg-white text-xs font-medium text-[#18181B] hover:bg-[#EAECEB] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            {copiedKey === `code-${item.code}` ? (
                              <Check className="w-3.5 h-3.5 text-[#3F6212]" aria-hidden="true" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {copiedKey === `code-${item.code}` ? 'Copiado' : 'Código'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleCopyText(shareText, `share-${item.code}`)}
                            title="Copiar mensaje con enlace y código"
                            className="min-h-[36px] px-2.5 rounded-lg bg-[#18181B] text-white text-xs font-medium hover:bg-[#27272A] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            {copiedKey === `share-${item.code}` ? (
                              <Check className="w-3.5 h-3.5 text-[#A3E635]" aria-hidden="true" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {copiedKey === `share-${item.code}` ? 'Listo' : 'Invitar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleCode(item)}
                            className="min-h-[36px] px-2 rounded-lg text-xs font-medium text-[#52525B] hover:text-[#18181B] hover:bg-[#EAECEB] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            {item.active ? 'Pausar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteCode(item.code)}
                            aria-label={`Eliminar código ${item.code}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#71717A] bg-[#F7F8F7] rounded-xl px-4 py-3">
                  Aún no has creado ningún código. Pulsa «Generar código» o crea uno personalizado
                  abajo para compartir Voltio.
                </p>
              )}

              {/* Custom Code Creator */}
              <form onSubmit={handleCreateCustomCode} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="Código propio (ej. FAMILIA26)"
                  maxLength={32}
                  className="sm:col-span-6 min-h-[42px] px-3 rounded-xl bg-[#F7F8F7] font-mono text-xs uppercase text-[#18181B] placeholder:font-sans placeholder:normal-case placeholder:text-[#A1A1AA] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none"
                />
                <input
                  type="text"
                  value={codeLabel}
                  onChange={(e) => setCodeLabel(e.target.value)}
                  placeholder="Nota (opcional)"
                  maxLength={60}
                  className="sm:col-span-4 min-h-[42px] px-3 rounded-xl bg-[#F7F8F7] text-xs text-[#18181B] placeholder:text-[#A1A1AA] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={codeBusy || customCode.trim().length < 5}
                  className="sm:col-span-2 min-h-[42px] px-3 rounded-xl bg-[#18181B] text-white text-xs font-medium hover:bg-[#27272A] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Crear
                </button>
              </form>

              {codeError && (
                <p className="text-xs font-medium text-[#DC2626]">{codeError}</p>
              )}
            </div>
          </>
        )}

        <div className="h-px bg-[#EAECEB]" />

        {/* Password Section */}
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#18181B]">
              {hasPasswordProvider ? 'Cambiar contraseña' : 'Configurar acceso con contraseña'}
            </h3>
            <p className="text-xs text-[#52525B] leading-relaxed">
              {hasPasswordProvider
                ? 'Actualiza la contraseña con la que accedes desde cualquier dispositivo.'
                : 'Añade una contraseña a tu cuenta para poder iniciar sesión sin Google cuando quieras.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 8)"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F8F7] text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F8F7] text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:bg-white focus:ring-2 focus:ring-[#18181B] focus:outline-none"
            />
          </div>

          {passwordFeedback && (
            <p
              className={`text-xs font-medium leading-relaxed ${
                passwordFeedback.type === 'ok' ? 'text-[#3F6212]' : 'text-[#DC2626]'
              }`}
            >
              {passwordFeedback.text}
            </p>
          )}

          <button
            type="submit"
            disabled={passwordBusy}
            className="w-full min-h-[44px] rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#27272A] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {passwordBusy
              ? 'Guardando…'
              : hasPasswordProvider
                ? 'Actualizar contraseña'
                : 'Guardar contraseña'}
          </button>
        </form>

        <div className="h-px bg-[#EAECEB]" />

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full min-h-[44px] rounded-xl bg-[#F7F8F7] text-[#DC2626] text-sm font-medium hover:bg-[#FEF2F2] transition-colors cursor-pointer"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
