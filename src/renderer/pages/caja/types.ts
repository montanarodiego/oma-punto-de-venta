import type { Cliente } from '../../types/api';

export interface PromoItem {
  id: number;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio_promocional: number;
}

export interface CartItem {
  _id: number;
  articuloId?: number;
  codigo: string;
  nombre: string;
  precio: number;
  costo: number;
  cantidad: number;
  descPct: number;
  stockActual?: number;
  usaInventario?: boolean;
  unidadMedida?: string;
  tasaIva?: number;
  esLibre?: boolean;
  esMayoreo?: boolean;
  precioBase?: number;
  promoId?: number;
  promos?: PromoItem[];
}

export interface Ticket {
  id: number;
  nombre: string;
  carrito: CartItem[];
  clienteSeleccionado: Cliente | null;
  formaPago: string;
  descGlobalTipo: 'ninguno' | 'pct' | 'monto';
  descGlobalValor: number;
  notas: string;
  itemSelIdx: number | null;
}

export const MODOS_SIN_IVA        = new Set(['monotributista', 'restaurante']);
export const MODOS_IVA_DESGLOSADO = new Set(['responsable_inscripto', 'mayorista', 'farmacia']);
export const UNIDADES_CONTINUAS   = new Set(['kg', 'g', 'litro', 'ml', 'metro', 'cm']);
export const MAX_TICKETS          = 5;

export function fmt(n: number, _moneda = '$') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n ?? 0);
}

export function mkItem(base: Partial<CartItem>): CartItem {
  return { _id: Date.now() + Math.random(), codigo: '', nombre: '', precio: 0, costo: 0, cantidad: 1, descPct: 0, ...base };
}

export function aplicarPromoAItem(item: CartItem): CartItem {
  if (!item.promos?.length || item.esLibre) return item;
  const promo = item.promos.find(p =>
    item.cantidad >= p.cantidad_desde &&
    (p.cantidad_hasta === null || item.cantidad <= p.cantidad_hasta),
  );
  return { ...item, precio: promo ? promo.precio_promocional : (item.precioBase ?? item.precio), promoId: promo?.id };
}

export const WIZARD_MODOS = [
  { id: 'monotributista',        nombre: 'Monotributista',         desc: 'Precios finales, sin IVA desglosado',                 ejemplos: 'Kiosco, almacén, bazar' },
  { id: 'responsable_inscripto', nombre: 'Responsable Inscripto',  desc: 'IVA desglosado (21% por defecto)',                    ejemplos: 'Distribuidora, empresa' },
  { id: 'restaurante',           nombre: 'Restaurante / Rotisería',desc: 'Sin IVA desglosado, con propina',                     ejemplos: 'Rotisería, pizzería' },
  { id: 'mayorista',             nombre: 'Mayorista',              desc: 'Precios sin IVA, IVA al total',                       ejemplos: 'Distribuidora, depósito' },
  { id: 'farmacia',              nombre: 'Farmacia / Perfumería',  desc: 'IVA múltiples tasas (21%, 10,5%, 0%)',                ejemplos: 'Farmacia, cosmética' },
  { id: 'personalizado',         nombre: 'Personalizado',          desc: 'Configurá manualmente el IVA desde Configuración',   ejemplos: '' },
];
