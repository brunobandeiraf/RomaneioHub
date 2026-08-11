export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  productName?: string;
  quantidade: number;
  precoUnit: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  filename: string;
  s3Key: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedById: string;
}

export interface Order {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  invoices: Invoice[];
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
}

export interface OrderListItem {
  id: string;
  date: string;
  supplierName: string;
  supplierId: string;
  itemCount: number;
  invoiceCount: number;
  total: number;
  status: OrderStatus;
}

export interface OrdersListResponse {
  data: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateOrderItemInput {
  productId: string;
  quantidade: number;
  precoUnit: number;
}

export interface CreateOrderInput {
  supplierId: string;
  date: string;
  items: CreateOrderItemInput[];
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
}

export interface Supplier {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  active: boolean;
}

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  precoReferencia: number;
  active: boolean;
}

// Valid status transitions — allow any change
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'DELIVERED', 'CANCELLED'],
  CONFIRMED: ['DRAFT', 'DELIVERED', 'CANCELLED'],
  DELIVERED: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
  CANCELLED: ['DRAFT', 'CONFIRMED', 'DELIVERED'],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Processamento',
  CONFIRMED: 'Entregue no Marketplace',
  DELIVERED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'bg-amber-500 text-white',
  CONFIRMED: 'bg-blue-500 text-white',
  DELIVERED: 'bg-emerald-700 text-white',
  CANCELLED: 'bg-red-500 text-white',
};

// Button colors for status change actions
export const STATUS_BUTTON_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'bg-amber-500 hover:bg-amber-600 text-white',
  CONFIRMED: 'bg-blue-500 hover:bg-blue-600 text-white',
  DELIVERED: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  CANCELLED: 'bg-red-500 hover:bg-red-600 text-white',
};
