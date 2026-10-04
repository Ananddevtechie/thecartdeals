import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';

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
  productId?: string;
  customerId?: string;
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
  notification_status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  notification_message: string;
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
  private readonly productApi = inject(ProductApiService);
  product: StoreProduct | null = null;
  checkout: CheckoutState | null = null;
  quantity = 1;
  stateResolved = false;
  selectedMethod: 'online' | 'cod' = 'online';
  readonly notice = signal('');
  readonly isSubmitting = signal(false);

  constructor() {
    afterNextRender(() => {
      void this.resolvePaymentState();
    });
  }

  get previewTotal(): number {
    return (this.product?.price ?? 0) * this.quantity;
  }

  get previewSavings(): number {
    return Math.max(0, (this.product?.mrp ?? 0) - (this.product?.price ?? 0)) * this.quantity;
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
    if (!this.product) {
      this.notice.set('This product is no longer available. Return to the catalog and choose another product.');
      return;
    }
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
    if (!this.checkout || !this.product) {
      this.notice.set('Your checkout details have expired. Return to checkout and try again.');
      return;
    }

    this.notice.set('');
    this.isSubmitting.set(true);
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 60_000);
    try {
      const orderRequest = {
        product_id: this.product.id,
        quantity: this.quantity,
        customer_id: this.checkout.customerId ?? null,
        full_name: String(this.checkout.fullName ?? ''),
        mobile: String(this.checkout.mobile ?? ''),
        alternate_mobile: this.checkout.alternateMobile ? String(this.checkout.alternateMobile) : null,
        address_line1: String(this.checkout.addressLine1 ?? ''),
        address_line2: String(this.checkout.addressLine2 ?? ''),
        pin: String(this.checkout.pin ?? ''),
        city: String(this.checkout.city ?? ''),
        state: String(this.checkout.state ?? ''),
        landmark: String(this.checkout.landmark ?? '') || null,
      };
      const idempotencyKey = await this.getCodIdempotencyKey(orderRequest);
      const response = await fetch('/api/orders/cod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        signal: abortController.signal,
        body: JSON.stringify(orderRequest),
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
      this.clearCodIdempotencyKey(idempotencyKey);
    } catch {
      this.notice.set('We could not confirm whether your order was received. Retrying is safe and will not create a duplicate order.');
    } finally {
      window.clearTimeout(timeoutId);
      this.isSubmitting.set(false);
    }
  }

  backToCheckout(): void {
    void this.router.navigate(['/checkout'], {
      queryParams: { product: this.checkout?.productId },
      state: { checkout: this.checkout },
    });
  }

  private async getCodIdempotencyKey(orderRequest: object): Promise<string> {
    const storageKey = 'thecart-cod-order-key';
    try {
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(orderRequest)));
      const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { fingerprint?: string; key?: string };
        if (parsed.fingerprint === fingerprint && parsed.key) return parsed.key;
      }
      const key = window.crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
      return key;
    } catch {
      return window.crypto.randomUUID();
    }
  }

  private clearCodIdempotencyKey(key: string): void {
    try {
      const storageKey = 'thecart-cod-order-key';
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved && (JSON.parse(saved) as { key?: string }).key === key) {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch {
      window.sessionStorage.removeItem('thecart-cod-order-key');
    }
  }

  private async resolvePaymentState(): Promise<void> {
    this.checkout = this.readCheckoutState();
    this.quantity = Math.max(1, Math.min(10, Number(this.checkout?.quantity) || 1));
    if (this.checkout?.productId) {
      try {
        this.product = await this.productApi.getProduct(this.checkout.productId);
      } catch (error) {
        this.notice.set(error instanceof Error ? error.message : 'Could not load this product.');
      }
    }
    this.stateResolved = true;
    this.changeDetector.detectChanges();
  }

  private readCheckoutState(): CheckoutState | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const state = window.history.state?.['checkout'] as CheckoutState | undefined;
    return state ?? null;
  }

}
