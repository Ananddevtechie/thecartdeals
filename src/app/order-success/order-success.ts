import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

interface OrderConfirmation {
  order_id: string;
  order_status: 'PLACED' | 'CANCELLED';
  payment_method: 'COD' | 'UPI';
  payment_status: 'COD_PENDING' | 'PAID';
  product_title: string;
  product_sku: string;
  quantity: number;
  total: number | string;
  currency: 'INR';
  order_date: string;
  expected_delivery_range: string;
  notification_status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  notification_message: string;
}

interface DeliverySummary {
  [key: string]: FormDataEntryValue | number | undefined;
  fullName?: string;
  mobile?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pin?: string;
  landmark?: string;
}

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './order-success.html',
  styleUrl: './order-success.scss',
})
export class OrderSuccess {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  order: OrderConfirmation | null = null;
  delivery: DeliverySummary | null = null;
  stateResolved = false;
  isCancelling = false;
  cancelMessage = '';
  cancelFailed = false;

  constructor() {
    afterNextRender(() => {
      this.readConfirmation();
      this.stateResolved = true;
      this.changeDetector.detectChanges();
    });
  }

  formatMoney(amount: number | string): string {
    return Number(amount).toFixed(2);
  }

  get canCancelOrder(): boolean {
    return this.order?.order_status === 'PLACED'
      && this.order.payment_method === 'COD'
      && Boolean(this.delivery?.mobile);
  }

  async cancelOrder(): Promise<void> {
    if (!this.order || !this.delivery?.mobile || this.isCancelling) return;
    if (!window.confirm('Cancel this COD order? This cannot be undone.')) return;

    this.isCancelling = true;
    this.cancelMessage = '';
    this.cancelFailed = false;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(this.order.order_id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: this.delivery.mobile }),
      });
      const result = await response.json() as { order_status?: string; detail?: string };
      if (!response.ok || result.order_status !== 'CANCELLED') {
        throw new Error(result.detail ?? 'We could not cancel this order. Please try again.');
      }
      this.order.order_status = 'CANCELLED';
      this.cancelMessage = 'Your order has been cancelled.';
    } catch (error) {
      this.cancelFailed = true;
      this.cancelMessage = error instanceof Error
        ? error.message
        : 'We could not cancel this order. Please try again.';
    } finally {
      this.isCancelling = false;
    }
  }

  continueShopping(): void {
    void this.router.navigateByUrl('/');
  }

  private readConfirmation(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const historyState = window.history.state as {
      order?: OrderConfirmation;
      checkout?: DeliverySummary;
    };
    this.order = historyState.order ?? null;
    this.delivery = historyState.checkout ?? null;
  }
}
