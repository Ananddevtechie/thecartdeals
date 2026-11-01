import { ChangeDetectorRef, Component, DestroyRef, afterNextRender, inject } from '@angular/core';
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

interface ReverseGeocodedAddress {
  display_name?: string;
  address?: {
    building?: string;
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    residential?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    amenity?: string;
    shop?: string;
    tourism?: string;
    historic?: string;
  };
  name?: string;
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
  private readonly destroyRef = inject(DestroyRef);
  product: StoreProduct | null = null;
  productLoading = true;
  productError = '';
  readonly checkoutDraft = this.readCheckoutDraft();
  readonly indianStates = [
    'Andaman and Nicobar Islands',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chandigarh',
    'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Ladakh',
    'Lakshadweep',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
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
  isLocating = false;
  locationMessage = '';

  get total(): number {
    return (this.product?.price ?? 0) * this.quantity;
  }

  constructor() {
    afterNextRender(() => { void this.loadProduct(); });
  }

  changeQuantity(amount: number): void {
    this.quantity = Math.max(1, Math.min(10, this.quantity + amount));
  }

  async useCurrentLocation(form: HTMLFormElement): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.isLocating) return;
    if (!navigator.geolocation) {
      this.locationMessage = 'Location is not supported by this browser.';
      return;
    }

    this.isLocating = true;
    this.locationMessage = 'Finding your location…';
    try {
      let position: GeolocationPosition;
      try {
        position = await this.requestCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 15_000,
        });
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
        if (code !== 2) throw error;
        position = await this.requestCurrentPosition({
          enableHighAccuracy: true,
          maximumAge: 5 * 60_000,
          timeout: 10_000,
        });
      }
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(position.coords.latitude),
        lon: String(position.coords.longitude),
        addressdetails: '1',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { Accept: 'application/json', 'Accept-Language': 'en' },
      });
      if (!response.ok) throw new Error('Address lookup is temporarily unavailable. Please enter your address manually.');

      const result = await response.json() as ReverseGeocodedAddress;
      const filledFields = this.fillAddressFields(form, result);
      const addressLine1 = form.elements.namedItem('addressLine1');
      const addressLine1Missing = addressLine1 instanceof HTMLInputElement && !addressLine1.value.trim();
      this.locationMessage = filledFields
        ? `Filled ${filledFields} address ${filledFields === 1 ? 'field' : 'fields'}. Please review the details and enter your name and mobile number.${addressLine1Missing ? ' House no. / building name is still required.' : ''}`
        : `We found your location, but could not identify address fields. Please enter them manually.${addressLine1Missing ? ' House no. / building name is still required.' : ''}`;
    } catch (error) {
      const locationErrorCode = typeof error === 'object' && error !== null && 'code' in error
        && typeof error.code === 'number'
        ? error.code
        : null;
      this.locationMessage = locationErrorCode !== null
        ? this.locationErrorMessage(locationErrorCode)
        : error instanceof Error
          ? error.message
          : 'Could not find your address. Please enter it manually.';
    } finally {
      this.isLocating = false;
      if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
    }
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
      if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
    }
  }

  private readCheckoutDraft(): CheckoutDraft | null {
    const navigationDraft = this.router.getCurrentNavigation()?.extras.state?.['checkout'] as CheckoutDraft | undefined;
    if (navigationDraft) return navigationDraft;
    if (!isPlatformBrowser(this.platformId)) return null;
    return window.history.state?.['checkout'] as CheckoutDraft | null;
  }

  private requestCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  private fillAddressFields(form: HTMLFormElement, result: ReverseGeocodedAddress): number {
    const address = result.address;
    if (!address) return 0;

    const line1 = [address.building, address.house_number].filter(Boolean).join(' ');
    const road = address.road ?? address.pedestrian ?? address.footway ?? address.residential;
    const locality = address.neighbourhood ?? address.suburb ?? address.city_district;
    const line2 = result.display_name
      ?? [road, locality].filter((value, index, values) => value && values.indexOf(value) === index).join(', ');
    const city = address.city ?? address.town ?? address.municipality ?? address.village ?? address.county;
    const landmark = address.amenity ?? address.shop ?? address.tourism ?? address.historic ?? result.name;
    const state = this.indianStates.find((option) => option.toLocaleLowerCase() === address.state?.toLocaleLowerCase());
    const values: Record<string, string | undefined> = {
      addressLine1: line1,
      addressLine2: line2,
      pin: address.postcode,
      city,
      state,
      landmark,
    };

    let filledFields = 0;
    for (const [name, value] of Object.entries(values)) {
      if (!value) continue;
      const field = form.elements.namedItem(name);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || field.value.trim()) continue;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      filledFields += 1;
    }
    return filledFields;
  }

  private locationErrorMessage(code: number): string {
    if (code === 1) {
      return 'Location permission was denied. Allow location access in your browser or enter your address manually.';
    }
    if (code === 2) {
      return 'Your device could not determine your location. Turn on Location Services and try again, or enter your address manually.';
    }
    return 'Finding your location took too long. Please try again or enter your address manually.';
  }

  private async loadProduct(): Promise<void> {
    const productId = this.route.snapshot.queryParamMap.get('product') ?? this.checkoutDraft?.productId ?? '';
    if (!productId) {
      this.productError = 'Choose a product before checking out.';
      this.productLoading = false;
      this.changeDetector.detectChanges();
      return;
    }
    try {
      this.product = await this.productApi.getProduct(productId);
    } catch (error) {
      this.productError = error instanceof Error ? error.message : 'Could not load this product.';
    } finally {
      this.productLoading = false;
      this.changeDetector.detectChanges();
    }
  }
}
