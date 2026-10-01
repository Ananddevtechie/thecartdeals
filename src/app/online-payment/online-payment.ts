import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject, OnDestroy, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { productOffer } from '../product-details/product-offer';
import {
  PaidOrderResult,
  PaymentApiService,
  PaymentOrderRequest,
  PaymentStatusResult,
  RazorpayOrderResult,
  RazorpayPaymentResponse,
} from './payment-api.service';

interface CheckoutSummary {
  [key: string]: FormDataEntryValue | number | undefined;
  fullName?: string;
  mobile?: string;
  alternateMobile?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pin?: string;
  landmark?: string;
  customerId?: string;
  quantity?: number;
}

interface UpiApp {
  id: string;
  name: string;
  mark: string;
  style: string;
}

type PaymentScreen = 'selection' | 'pending' | 'failed' | 'success';

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      method: { upi: boolean };
      handler: (response: RazorpayPaymentResponse) => void;
      prefill?: {
        name?: string;
        contact?: string;
        email?: string;
      };
      notes?: Record<string, string>;
      theme?: { color: string };
      modal?: { ondismiss?: () => void };
    }) => {
      open: () => void;
      on: (event: 'payment.failed', handler: (response: unknown) => void) => void;
    };
  }
}

@Component({
  selector: 'app-online-payment',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './online-payment.html',
  styleUrl: './online-payment.scss',
})
export class OnlinePayment implements OnDestroy {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly paymentApi = inject(PaymentApiService);
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  readonly product = productOffer;
  readonly upiApps: UpiApp[] = [
    { id: 'google-pay', name: 'Google Pay', mark: 'G', style: 'google' },
    { id: 'phonepe', name: 'PhonePe', mark: 'पे', style: 'phonepe' },
    { id: 'paytm', name: 'Paytm', mark: 'paytm', style: 'paytm' },
    { id: 'bhim', name: 'BHIM', mark: 'BHIM', style: 'bhim' },
    { id: 'amazon-pay', name: 'Amazon Pay', mark: 'a', style: 'amazon' },
    { id: 'other', name: 'Other UPI Apps', mark: 'UPI', style: 'other' },
  ];
  checkout: CheckoutSummary | null = null;
  quantity = 1;
  stateResolved = false;
  readonly screen = signal<PaymentScreen>('selection');
  readonly selectedApp = signal('google-pay');
  readonly payableTotal = signal(this.product.price);
  readonly notice = signal('');
  readonly isSubmitting = signal(false);
  readonly activeOrderId = signal('');
  readonly paidOrder = signal<PaidOrderResult | null>(null);

  constructor() {
    afterNextRender(() => {
      this.checkout = this.readCheckoutState();
      this.quantity = Math.max(1, Math.min(10, Number(this.checkout?.quantity) || 1));
      this.payableTotal.set(this.product.price * this.quantity);
      this.stateResolved = true;
      const pendingOrderId = new URLSearchParams(window.location.search).get('orderId');
      if (pendingOrderId) this.watchPaymentStatus(pendingOrderId);
      this.changeDetector.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  get formattedTotal(): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(this.payableTotal());
  }

  selectApp(appId: string): void {
    this.selectedApp.set(appId);
    this.notice.set('');
  }

  async payNow(): Promise<void> {
    if (this.isSubmitting()) return;
    if (!this.checkout) {
      this.notice.set('Your checkout details have expired. Return to checkout and try again.');
      return;
    }

    this.notice.set('');
    this.isSubmitting.set(true);
    try {
      const orderResult = await this.paymentApi.createOrder(this.buildOrderRequest());
      this.activeOrderId.set(orderResult.order_id);
      this.payableTotal.set(orderResult.amount / 100);
      await this.paymentApi.loadCheckoutScript();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable. Please try again.');

      const checkout = new window.Razorpay({
        key: orderResult.key_id,
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: 'TheCart',
        description: `Payment for ${orderResult.product_title}`,
        order_id: orderResult.provider_order_id,
        method: { upi: true },
        handler: (response) => { void this.verifyPayment(orderResult, response); },
        prefill: {
          name: orderResult.customer_name,
          contact: orderResult.customer_mobile,
          email: orderResult.customer_email ?? undefined,
        },
        theme: { color: '#2d6a4f' },
        modal: { ondismiss: () => this.watchPaymentStatus(orderResult.order_id) },
      });
      checkout.on('payment.failed', () => this.watchPaymentStatus(orderResult.order_id));
      checkout.open();
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'We could not start your payment. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  checkPaymentStatus(): void {
    const orderId = this.activeOrderId();
    if (!orderId) return;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    void this.refreshPaymentStatus(orderId);
  }

  tryAgain(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.screen.set('selection');
    this.notice.set('');
    this.activeOrderId.set('');
    this.paidOrder.set(null);
    void this.router.navigateByUrl('/online-payment', {
      replaceUrl: true,
      state: { checkout: this.checkout },
    });
  }

  backToCheckout(): void {
    void this.router.navigateByUrl('/checkout', { state: { checkout: this.checkout } });
  }

  viewOrder(): void {
    const order = this.paidOrder();
    if (!order) return;
    void this.router.navigateByUrl('/order/success', {
      state: { order, checkout: this.checkout },
    });
  }

  continueShopping(): void {
    void this.router.navigateByUrl('/product-details');
  }

  private async verifyPayment(order: RazorpayOrderResult, response: RazorpayPaymentResponse): Promise<void> {
    this.isSubmitting.set(true);
    try {
      const result = await this.paymentApi.verifyPayment(order.order_id, response);
      if (result.payment_status === 'PAID' && result.order_status === 'PLACED') {
        this.showSuccess(result as PaidOrderResult);
      } else {
        this.watchPaymentStatus(order.order_id);
      }
    } catch {
      this.watchPaymentStatus(order.order_id);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private watchPaymentStatus(orderId: string): void {
    this.activeOrderId.set(orderId);
    this.screen.set('pending');
    this.notice.set('');
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (isPlatformBrowser(this.platformId) && !window.location.search.includes(encodeURIComponent(orderId))) {
      void this.router.navigateByUrl(`/online-payment?orderId=${encodeURIComponent(orderId)}`, {
        replaceUrl: true,
        state: { checkout: this.checkout },
      });
    }
    void this.refreshPaymentStatus(orderId);
  }

  private async refreshPaymentStatus(orderId: string): Promise<void> {
    try {
      const result: PaymentStatusResult = await this.paymentApi.getPaymentStatus(orderId);
      if (result.payment_status === 'PAID' && result.order_status === 'PLACED') {
        this.showSuccess(result as PaidOrderResult);
        return;
      }
      if (result.payment_status === 'PAYMENT_FAILED') {
        this.screen.set('failed');
        return;
      }
    } catch {
      this.notice.set('We are still checking with the payment provider.');
    }

    this.screen.set('pending');
    this.statusTimer = setTimeout(() => { void this.refreshPaymentStatus(orderId); }, 4000);
  }

  private showSuccess(order: PaidOrderResult): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.paidOrder.set(order);
    this.payableTotal.set(Number(order.total));
    this.screen.set('success');
  }

  private buildOrderRequest(): PaymentOrderRequest {
    const checkout = this.checkout!;
    return {
      product_id: this.product.id,
      quantity: this.quantity,
      customer_id: String(checkout.customerId ?? ''),
      full_name: String(checkout.fullName ?? ''),
      mobile: String(checkout.mobile ?? ''),
      alternate_mobile: checkout.alternateMobile ? String(checkout.alternateMobile) : null,
      address_line1: String(checkout.addressLine1 ?? ''),
      address_line2: String(checkout.addressLine2 ?? ''),
      pin: String(checkout.pin ?? ''),
      city: String(checkout.city ?? ''),
      state: String(checkout.state ?? ''),
      landmark: String(checkout.landmark ?? ''),
    };
  }

  private readCheckoutState(): CheckoutSummary | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return window.history.state?.['checkout'] as CheckoutSummary | null;
  }
}