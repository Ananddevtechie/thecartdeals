import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, afterNextRender, inject, OnDestroy, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EbookBuyer } from '../ebook-checkout/ebook-checkout';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';
import {
  EbookPaymentOrderRequest,
  PaidOrderResult,
  PaymentApiService,
  PaymentStatusResult,
  RazorpayOrderResult,
  RazorpayPaymentResponse,
} from '../online-payment/payment-api.service';

type EbookPaymentScreen = 'pay' | 'pending' | 'failed' | 'success';

@Component({
  selector: 'app-ebook-payment',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ebook-payment.html',
  styleUrl: '../ebook-checkout/ebook-flow.scss',
})
export class EbookPayment implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly productApi = inject(ProductApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private statusTimer: ReturnType<typeof setTimeout> | undefined;

  readonly product = signal<StoreProduct | null>(null);
  readonly buyer = signal<EbookBuyer | null>(null);
  readonly stateResolved = signal(false);
  readonly screen = signal<EbookPaymentScreen>('pay');
  readonly notice = signal('');
  readonly submitting = signal(false);
  readonly activeOrderId = signal('');
  readonly paidOrder = signal<PaidOrderResult | null>(null);
  readonly confirmedAmount = signal(0);

  constructor() {
    afterNextRender(() => { void this.resolvePaymentState(); });
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  get formattedTotal(): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(
      this.confirmedAmount() || this.product()?.price || 0,
    );
  }

  async payNow(): Promise<void> {
    if (this.submitting()) return;
    const buyer = this.buyer();
    const product = this.product();
    if (!buyer || !product) {
      this.notice.set('Your checkout details have expired. Return to checkout and try again.');
      return;
    }

    this.notice.set('');
    this.submitting.set(true);
    try {
      await this.paymentApi.loadCheckoutScript();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable. Please try again.');

      const request: EbookPaymentOrderRequest = {
        product_id: product.id,
        quantity: 1,
        full_name: buyer.fullName,
        customer_email: buyer.email,
        mobile: buyer.mobile,
      };
      const order = await this.paymentApi.createEbookOrder(request);
      this.activeOrderId.set(order.order_id);
      this.confirmedAmount.set(order.amount / 100);
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TheCart',
        description: `Digital eBook: ${order.product_title}`,
        order_id: order.provider_order_id,
        method: { upi: true },
        handler: (response) => { void this.verifyPayment(order, response); },
        prefill: {
          name: order.customer_name,
          contact: order.customer_mobile,
          email: order.customer_email ?? buyer.email,
        },
        theme: { color: '#d45e47' },
        modal: {
          ondismiss: () => this.watchPaymentStatus(
            order.order_id,
            'Checkout was closed. We are checking whether the payment completed.',
          ),
        },
      });
      checkout.on('payment.failed', () => this.watchPaymentStatus(
        order.order_id,
        'The payment did not complete. Please check the status or try again.',
      ));
      checkout.open();
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'We could not start your payment. Please try again.');
    } finally {
      this.submitting.set(false);
      this.changeDetector.detectChanges();
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
    this.screen.set('pay');
    this.notice.set('');
    this.activeOrderId.set('');
    this.paidOrder.set(null);
    void this.router.navigateByUrl(
      `/ebook-payment?product=${encodeURIComponent(this.product()?.id ?? '')}`,
      { replaceUrl: true, state: { ebookBuyer: this.buyer() } },
    );
  }

  backToCheckout(): void {
    const buyer = this.buyer();
    void this.router.navigate(['/ebook-checkout'], {
      queryParams: { product: this.product()?.id ?? buyer?.productId },
      state: { ebookBuyer: buyer },
    });
  }

  viewOrder(): void {
    const order = this.paidOrder();
    if (!order) return;
    void this.router.navigateByUrl('/order/success', {
      state: { order, checkout: this.buyer() },
    });
  }

  continueShopping(): void {
    void this.router.navigateByUrl('/');
  }

  private async resolvePaymentState(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const navigationBuyer = this.router.getCurrentNavigation()?.extras.state?.['ebookBuyer'] as EbookBuyer | undefined;
    const historyBuyer = window.history.state?.['ebookBuyer'] as EbookBuyer | undefined;
    const buyer = navigationBuyer ?? historyBuyer ?? null;
    this.buyer.set(buyer);
    const productId = this.route.snapshot.queryParamMap.get('product') ?? buyer?.productId;

    if (productId) {
      try {
        this.product.set(await this.productApi.getProduct(productId));
        this.confirmedAmount.set(this.product()?.price ?? 0);
      } catch (error) {
        this.notice.set(error instanceof Error ? error.message : 'Could not load this eBook.');
      }
    }

    this.stateResolved.set(true);
    const pendingOrderId = this.route.snapshot.queryParamMap.get('orderId');
    if (pendingOrderId) {
      this.activeOrderId.set(pendingOrderId);
      void this.refreshPaymentStatus(pendingOrderId);
    }
    this.changeDetector.detectChanges();
  }

  private async verifyPayment(order: RazorpayOrderResult, response: RazorpayPaymentResponse): Promise<void> {
    this.submitting.set(true);
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
      this.submitting.set(false);
      this.changeDetector.detectChanges();
    }
  }

  private watchPaymentStatus(orderId: string, message = ''): void {
    this.activeOrderId.set(orderId);
    this.screen.set('pending');
    this.notice.set(message);
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (!window.location.search.includes(encodeURIComponent(orderId))) {
      void this.router.navigateByUrl(
        `/ebook-payment?product=${encodeURIComponent(this.product()?.id ?? '')}&orderId=${encodeURIComponent(orderId)}`,
        { replaceUrl: true, state: { ebookBuyer: this.buyer() } },
      );
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
    this.changeDetector.detectChanges();
  }

  private showSuccess(order: PaidOrderResult): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.paidOrder.set(order);
    this.confirmedAmount.set(Number(order.total));
    this.screen.set('success');
    this.changeDetector.detectChanges();
  }
}
