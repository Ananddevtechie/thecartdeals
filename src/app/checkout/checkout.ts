import { ChangeDetectorRef, Component, afterNextRender, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';
import { CustomerApiService } from './customer-api.service';

interface CheckoutDraft {
  [key: string]: FormDataEntryValue | number | undefined;
  fullName?: string;
  mobile?: string;
  alternateMobile?: string;
  addressLine1?: string;
  addressLine2?: string;
  pin?: string;
  city?: string;
  state?: string;
  landmark?: string;
  quantity?: number;
  productId?: string;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly customerApi = inject(CustomerApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  product: StoreProduct | null = null;
  productError = '';
  readonly checkoutDraft = this.readCheckoutDraft();
  readonly indianStates = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
  ];
  quantity = Math.max(1, Math.min(10, Number(this.checkoutDraft?.quantity) || 1));
  orderMessage = '';
  isSubmitting = false;

  get total(): number {
    return (this.product?.price ?? 0) * this.quantity;
  }

  constructor() {
    afterNextRender(() => { void this.loadProduct(); });
  }

  changeQuantity(amount: number): void {
    this.quantity = Math.max(1, Math.min(10, this.quantity + amount));
  }

  async continueToPayment(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.isSubmitting) return;
    if (!this.product) {
      this.orderMessage = this.productError || 'This product is no longer available.';
      return;
    }
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const checkout = Object.fromEntries(formData.entries());
    this.orderMessage = '';
    this.isSubmitting = true;
    try {
      const customerId = await this.customerApi.saveCustomer({
        full_name: String(checkout['fullName'] ?? ''),
        mobile: String(checkout['mobile'] ?? ''),
        alternate_mobile: String(checkout['alternateMobile'] ?? '') || null,
        address_line1: String(checkout['addressLine1'] ?? ''),
        address_line2: String(checkout['addressLine2'] ?? ''),
        pincode: String(checkout['pin'] ?? ''),
        city: String(checkout['city'] ?? ''),
        state: String(checkout['state'] ?? ''),
        landmark: String(checkout['landmark'] ?? '') || null,
      });
      await this.router.navigateByUrl('/payment', {
        state: {
          checkout: {
            ...checkout,
            quantity: this.quantity,
            productId: this.product.id,
            customerId,
          },
        },
      });
    } catch (error) {
      this.orderMessage = error instanceof Error
        ? error.message
        : 'Could not save your delivery details. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private readCheckoutDraft(): CheckoutDraft | null {
    const navigationDraft = this.router.getCurrentNavigation()?.extras.state?.['checkout'] as CheckoutDraft | undefined;
    if (navigationDraft) return navigationDraft;
    if (!isPlatformBrowser(this.platformId)) return null;
    return window.history.state?.['checkout'] as CheckoutDraft | null;
  }

  private async loadProduct(): Promise<void> {
    const productId = this.route.snapshot.queryParamMap.get('product') ?? this.checkoutDraft?.productId ?? '';
    if (!productId) {
      this.productError = 'Choose a product before checking out.';
      this.changeDetector.detectChanges();
      return;
    }
    try {
      this.product = await this.productApi.getProduct(productId);
    } catch (error) {
      this.productError = error instanceof Error ? error.message : 'Could not load this product.';
    } finally {
      this.changeDetector.detectChanges();
    }
  }
}
