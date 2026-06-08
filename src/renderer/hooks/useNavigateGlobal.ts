import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FILE_TO_ROUTE: Record<string, string> = {
  'caja.html':          '/caja',
  'catalogo.html':      '/catalogo',
  'inventario.html':    '/inventario',
  'clientes.html':      '/clientes',
  'proveedores.html':   '/proveedores',
  'pedidos.html':       '/pedidos',
  'informes.html':      '/informes',
  'turno.html':         '/turno',
  'configuracion.html': '/configuracion',
  'login.html':         '/login',
};

export function useNavigateGlobal() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onNavegar((file: string) => {
      const route = FILE_TO_ROUTE[file] ?? `/${file.replace('.html', '')}`;
      navigate(route);
    });
    return unsub;
  }, [navigate]);
}
