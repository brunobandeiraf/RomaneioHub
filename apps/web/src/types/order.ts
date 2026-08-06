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

// Valid status transitions
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};
