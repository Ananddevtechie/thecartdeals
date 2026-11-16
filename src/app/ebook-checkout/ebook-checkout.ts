import { ChangeDetectorRef, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isEbookCategory, ProductApiService, StoreProduct } from '../product-details/product-api.service';

export interface EbookBuyer {
  fullName: string;
  email: string;
  mobile: string;
  productId: string;
}

@Component({
  selector: 'app-ebook-checkout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ebook-checkout.html',
  styleUrl: './ebook-flow.scss',
})
export class EbookCheckout {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly product = signal<StoreProduct | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => { void this.loadProduct(); });
  }

  async continueToPayment(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const product = this.product();
    if (!product) {
      this.error.set('This eBook is no longer available. Return to the product page and try again.');
      return;
    }

    const formData = new FormData(form);
    const buyer: EbookBuyer = {
      fullName: String(formData.get('fullName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      mobile: String(formData.get('mobile') ?? '').trim(),
      productId: product.id,
    };

    this.error.set('');
    this.submitting.set(true);
    try {
      await this.router.navigateByUrl(`/ebook-payment?product=${encodeURIComponent(product.id)}`, {
        state: { ebookBuyer: buyer },
      });
    } finally {
      if (!this.destroyRef.destroyed) {
        this.submitting.set(false);
        this.changeDetector.detectChanges();
      }
    }
  }

  private async loadProduct(): Promise<void> {
    const productId = this.route.snapshot.queryParamMap.get('product');
    if (!productId) {
      this.error.set('Choose an eBook before continuing to checkout.');
      this.loading.set(false);
      this.changeDetector.detectChanges();
      return;
    }

    try {
      const product = await this.productApi.getProduct(productId);
      if (!isEbookCategory(product.category)) {
        this.error.set('This checkout is for eBooks only. Return to the product page to buy this item.');
      } else {
        this.product.set(product);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load this eBook.');
    } finally {
      this.loading.set(false);
      this.changeDetector.detectChanges();
    }
  }
}
