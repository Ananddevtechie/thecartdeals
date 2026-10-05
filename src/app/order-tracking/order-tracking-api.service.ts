import { Injectable } from '@angular/core';

export const DELIVERY_STAGES = [
  'ORDER_CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export type DeliveryStatus = typeof DELIVERY_STAGES[number];

export interface OrderTrackingEvent {
  status: DeliveryStatus;
  estimated_delivery_date: string | null;
  created_at: string;
}

export interface OrderTracking {
  order_id: string;
  product_title: string;
  product_sku: string;
  quantity: number;
  total: number | string;
  currency: 'INR';
  payment_method: 'COD' | 'UPI';
  payment_status: string;
  delivery_status: DeliveryStatus;
  estimated_delivery_date: string | null;
  order_date: string;
  tracking_events: OrderTrackingEvent[];
}

export interface AdminOrderTracking extends OrderTracking {
  customer_name: string;
  customer_mobile: string;
  address_line1: string;
  address_line2: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
}

@Injectable({ providedIn: 'root' })
export class OrderTrackingApiService {
  async listAdminOrders(username: string, password: string): Promise<AdminOrderTracking[]> {
    const response = await fetch('/api/admin/orders', {
      headers: this.adminHeaders(username, password),
    });
    const result = await response.json() as AdminOrderTracking[] | { detail?: string };
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(!Array.isArray(result) ? result.detail ?? 'Could not load orders.' : 'Could not load orders.');
    }
    return result;
  }

  async updateAdminOrder(
    username: string,
    password: string,
    orderId: string,
    deliveryStatus: DeliveryStatus,
    estimatedDeliveryDate: string | null,
  ): Promise<AdminOrderTracking> {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/tracking`, {
      method: 'PUT',
      headers: { ...this.adminHeaders(username, password), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_status: deliveryStatus,
        estimated_delivery_date: estimatedDeliveryDate || null,
      }),
    });
    const result = await response.json() as AdminOrderTracking | { detail?: string };
    if (!response.ok || !('delivery_status' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not update order tracking.' : 'Could not update order tracking.');
    }
    return result;
  }

  async getTracking(orderId: string): Promise<OrderTracking> {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`);
    const result = await response.json() as OrderTracking | { detail?: string };
    if (!response.ok || !('delivery_status' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not load order tracking.' : 'Could not load order tracking.');
    }
    return result;
  }

  private adminHeaders(username: string, password: string): HeadersInit {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }
}
