import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductApiService, ProductReviewSummary } from '../product-details/product-api.service';

interface CancellationOrder {
  order_id: string;
  order_status: 'PLACED' | 'CANCELLED';
  payment_method: 'COD' | 'UPI';
  product_title: string;
}

interface CheckoutDetails {
  mobile?: FormDataEntryValue | number;
  productId?: string;
  [key: string]: FormDataEntryValue | number | undefined;
}

@Component({
  selector: 'app-cancel-order-review',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cancel-order-review.html',
  styleUrl: './cancel-order-review.scss',
})
export class CancelOrderReview {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly productApi = inject(ProductApiService);

  order: CancellationOrder | null = null;
  checkout: CheckoutDetails | null = null;
  stateResolved = false;
  isCancelling = false;
  cancelError = '';
  reviewSummary: ProductReviewSummary | null = null;
  reviewsLoading = false;
  reviewsUnavailable = false;
  cancelSuccessVisible = false;

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        const historyState = window.history.state as {
          order?: CancellationOrder;
          checkout?: CheckoutDetails;
        };
        const routeOrderId = this.route.snapshot.paramMap.get('orderId');
        this.order = historyState.order?.order_id === routeOrderId ? historyState.order : null;
        this.checkout = this.order ? historyState.checkout ?? null : null;
        if (this.checkout?.productId) {
          void this.loadReviews(this.checkout.productId);
        } else if (this.order) {
          this.reviewsUnavailable = true;
        }
      }
      this.stateResolved = true;
      this.changeDetector.detectChanges();
    });
  }

  get canCancelOrder(): boolean {
    return this.order?.order_status === 'PLACED'
      && this.order.payment_method === 'COD'
      && Boolean(this.checkout?.mobile);
  }

  get visibleReviews() {
    return this.reviewSummary?.reviews.slice(0, 3) ?? [];
  }

  ratingStars(rating: number): string {
    const filled = Math.max(0, Math.min(5, Math.round(rating)));
    return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
  }

  formatReviewDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  keepOrder(): void {
    if (!this.order || !this.checkout || this.isCancelling || this.cancelSuccessVisible) return;
    void this.router.navigateByUrl('/order/success', {
      state: { order: this.order, checkout: this.checkout },
    });
  }

  async confirmCancellation(): Promise<void> {
    if (!this.order || !this.checkout?.mobile || !this.canCancelOrder || this.isCancelling) return;

    this.isCancelling = true;
    this.cancelError = '';
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(this.order.order_id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: this.checkout.mobile }),
      });
      let result: { order_status?: string; detail?: string } = {};
      try {
        result = await response.json() as { order_status?: string; detail?: string };
      } catch {
        result = {};
      }
      if (!response.ok || result.order_status !== 'CANCELLED') {
        throw new Error(result.detail ?? 'We could not cancel this order. Please try again.');
      }
      this.cancelSuccessVisible = true;
      this.changeDetector.detectChanges();
      window.setTimeout(() => {
        void this.router.navigateByUrl('/');
      }, 2000);
    } catch (error) {
      this.cancelError = error instanceof Error
        ? error.message
        : 'We could not cancel this order. Please try again.';
    } finally {
      this.isCancelling = false;
      this.changeDetector.detectChanges();
    }
  }

  private async loadReviews(productId: string): Promise<void> {
    this.reviewsLoading = true;
    try {
      this.reviewSummary = await this.productApi.getProductReviews(productId);
    } catch {
      this.reviewsUnavailable = true;
    } finally {
      this.reviewsLoading = false;
      this.changeDetector.detectChanges();
    }
  }
}