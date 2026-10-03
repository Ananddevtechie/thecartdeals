import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

interface OrderConfirmation {
  order_id: string;
  order_status: 'PLACED';
  payment_method: 'COD' | 'UPI';
  payment_status: 'COD_PENDING' | 'PAID';
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
