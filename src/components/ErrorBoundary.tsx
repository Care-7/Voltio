import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Se produjo un error inesperado.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Voltio ErrorBoundary:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSignOut = async () => {
    try {
      await signOut(auth);
    } finally {
      this.setState({ hasError: false, message: '' });
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isPermissionError =
      this.state.message.includes('Missing or insufficient permissions') ||
      this.state.message.includes('permission-denied');

    return (
      <div className="min-h-screen bg-white text-[#18181B] flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <p className="font-display text-lg font-extrabold tracking-tight">Voltio</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#18181B]">
              {isPermissionError
                ? 'Permisos de sincronización insuficientes'
                : 'No se pudo cargar tu sesión'}
            </h1>
            <p className="text-sm text-[#52525B] leading-relaxed">
              {isPermissionError
                ? 'Tu cuenta no tiene permisos para acceder a los datos sincronizados de esta aplicación privada.'
                : 'Ha ocurrido un error al conectar con tus datos en la nube. Intenta recargar la página.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={this.handleSignOut}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#18181B] text-sm font-medium hover:bg-[#EAECEB] transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }
}
