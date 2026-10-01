import { Injectable } from '@angular/core';

export interface PaymentOrderRequest {
  product_id: string;
  quantity: number;
  customer_id: string;
  full_name: string;
  mobile: string;
  alternate_mobile: string | null;
  address_line1: string;
  address_line2: string;
  pin: string;
  city: string;
  state: string;
  landmark: string;
}

export interface RazorpayOrderResult {
  order_id: string;
  key_id: string;
  provider_order_id: string;
  checkout_config_id: string;
  amount: number;
  currency: 'INR';
  product_title: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string | null;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface PaidOrderResult {
  order_id: string;
  order_status: 'PLACED';
  payment_method: 'UPI';
  payment_status: 'PAID';
  product_title: string;
  product_sku: string;
  quantity: number;
  total: number | string;
  currency: 'INR';
  order_date: string;
  expected_delivery_range: string;
  email_status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  email_notification_message: string;
  notification_recipient: string;
}

export interface PaymentStatusResult extends Omit<PaidOrderResult, 'order_status' | 'payment_status'> {
  order_status: 'PAYMENT_PENDING' | 'PAYMENT_FAILED' | 'PLACED';
  payment_status: 'PAYMENT_PENDING' | 'PAYMENT_FAILED' | 'PAID';
}

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  async createOrder(request: PaymentOrderRequest): Promise<RazorpayOrderResult> {
    return this.request<RazorpayOrderResult>('/api/payments/razorpay/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async verifyPayment(orderId: string, response: RazorpayPaymentResponse): Promise<PaymentStatusResult> {
    return this.request<PaymentStatusResult>('/api/payments/razorpay/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        provider_order_id: response.razorpay_order_id,
        payment_id: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      }),
    });
  }

  async getPaymentStatus(orderId: string): Promise<PaymentStatusResult> {
    return this.request<PaymentStatusResult>(
      `/api/payments/razorpay/orders/${encodeURIComponent(orderId)}/status`,
    );
  }

  loadCheckoutScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('This page is not available in the current environment.'));
        return;
      }
      if (window.Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Razorpay checkout script.'));
      document.body.appendChild(script);
    });
  }

  private async request<T extends object>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const result = await response.json() as T | { detail?: string };
    if (!response.ok) {
      throw new Error('detail' in result && result.detail
        ? result.detail
        : 'Payment service is temporarily unavailable.');
    }
    return result as T;
  }
}