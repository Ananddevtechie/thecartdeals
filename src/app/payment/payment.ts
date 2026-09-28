import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { productOffer } from '../product-details/product-offer';

interface CheckoutState {
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
  quantity?: number;
}

interface CodOrderResult {
  order_id: string;
  order_status: 'PLACED';
  payment_method: 'COD';
  payment_status: 'COD_PENDING';
  product_title: string;
  product_sku: string;
  quantity: number;
  unit_price: number | string;
  mrp: number | string;
  subtotal: number | string;
  discount: number | string;
  shipping: number | string;
  tax: number | string;
  cod_fee: number | string;
  total: number | string;
  currency: 'INR';
  order_date: string;
  expected_delivery_range: string;
  email_status: 'SENT';
  email_notification_message: string;
  notification_recipient: string;
}

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment.html',
  styleUrl: './payment.scss',
})
export class Payment {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly product = productOffer;
  checkout: CheckoutState | null = null;
  quantity = 1;
  stateResolved = false;
  selectedMethod: 'online' | 'cod' = 'online';
  readonly notice = signal('');
  readonly isSubmitting = signal(false);

  constructor() {
    afterNextRender(() => {
      this.checkout = this.readCheckoutState();
      this.quantity = Math.max(1, Math.min(10, Number(this.checkout?.quantity) || 1));
      this.stateResolved = true;
      this.changeDetector.detectChanges();
    });
  }

  get previewTotal(): number {
    return this.product.price * this.quantity;
  }

  get previewSavings(): number {
    return Math.max(0, this.product.mrp - this.product.price) * this.quantity;
  }

  get maskedMobile(): string {
    const mobile = String(this.checkout?.mobile ?? '');
    return mobile.length >= 4 ? `••••••${mobile.slice(-4)}` : 'Not provided';
  }

  formatMoney(amount: number | string): string {
    return Number(amount).toFixed(2);
  }

  selectMethod(method: 'online' | 'cod'): void {
    this.selectedMethod = method;
    this.notice.set('');
  }

  submitOrder(): void {
    if (this.selectedMethod === 'online') {
      if (!this.checkout) {
        this.notice.set('Your checkout details have expired. Return to checkout and try again.');
        return;
      }
      void this.router.navigateByUrl('/online-payment', {
        state: { checkout: this.checkout },
      });
      return;
    }
    void this.placeCodOrder();
  }

  continueShopping(): void {
    void this.router.navigateByUrl('/product-details');
  }

  async placeCodOrder(): Promise<void> {
    if (this.isSubmitting()) return;
    if (!this.checkout) {
      this.notice.set('Your checkout details have expired. Return to checkout and try again.');
      return;
    }

    this.notice.set('');
    this.isSubmitting.set(true);
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 60_000);
    try {
      const response = await fetch('/api/orders/cod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          product_id: this.product.id,
          quantity: this.quantity,
          full_name: String(this.checkout.fullName ?? ''),
          mobile: String(this.checkout.mobile ?? ''),
          alternate_mobile: this.checkout.alternateMobile ? String(this.checkout.alternateMobile) : null,
          address_line1: String(this.checkout.addressLine1 ?? ''),
          address_line2: String(this.checkout.addressLine2 ?? ''),
          pin: String(this.checkout.pin ?? ''),
          city: String(this.checkout.city ?? ''),
          state: String(this.checkout.state ?? ''),
          landmark: String(this.checkout.landmark ?? ''),
        }),
      });
      const result = await response.json() as CodOrderResult | { detail?: string };
      if (!response.ok) {
        this.notice.set('detail' in result && result.detail
          ? result.detail
          : 'We could not place your COD order. Please retry.');
        return;
      }
      await this.router.navigateByUrl('/order/success', {
        state: { order: result, checkout: this.checkout },
      });
    } catch {
      this.notice.set('We could not confirm whether the email was sent. Please check with the store before retrying.');
    } finally {
      window.clearTimeout(timeoutId);
      this.isSubmitting.set(false);
    }
  }

  backToCheckout(): void {
    void this.router.navigateByUrl('/checkout', {
      state: { checkout: this.checkout },
    });
  }

  private readCheckoutState(): CheckoutState | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const state = window.history.state?.['checkout'] as CheckoutState | undefined;
    return state ?? null;
  }

}
