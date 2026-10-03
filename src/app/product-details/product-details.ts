import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductApiService, StoreProduct } from './product-api.service';

interface ProductMedia {
  src: string;
  alt: string;
  label: string;
}

const emptyProduct: StoreProduct = {
  id: '',
  sku: '',
  title: '',
  category: 'Other',
  description: '',
  eyebrow: '',
  imageUrl: '',
  currency: '\u20b9',
  price: 0,
  mrp: 0,
  stockQuantity: 0,
  stockLabel: '',
  gallery: [],
  benefits: [],
  features: [],
  specifications: [],
  packageContents: [],
  faqs: [],
};

@Component({
  selector: 'app-product-details',
  standalone: true,
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  product = emptyProduct;
  catalog: StoreProduct[] = [];
  relatedProducts: StoreProduct[] = [];
  media: ProductMedia[] = [];
  selectedMedia = 0;
  openFaq = -1;
  zoomed = false;
  loading = true;
  loadError = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.loadProduct(params.get('slug'));
    });
  }

  get savings(): number {
    return Math.max(0, this.product.mrp - this.product.price);
  }

  selectMedia(index: number): void {
    this.selectedMedia = index;
    this.zoomed = false;
  }

  navigateToCheckout(): void {
    void this.router.navigate(['/checkout'], { queryParams: { product: this.product.id } });
  }

  openProduct(product: StoreProduct): void {
    void this.router.navigateByUrl(`/product-details/${encodeURIComponent(product.id)}`);
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? -1 : index;
  }

  private async loadProduct(slug: string | null): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.catalog = await this.productApi.listProducts();
      if (!this.catalog.length) {
        this.loadError = 'No products are available yet.';
        return;
      }
      const selected = slug ? this.catalog.find((item) => item.id === slug) : this.catalog[0];
      if (!selected) {
        this.loadError = 'This product could not be found.';
        return;
      }
      this.product = selected;
      this.relatedProducts = this.catalog.filter((item) => item.id !== selected.id);
      this.media = selected.gallery.length
        ? selected.gallery
        : [{ src: selected.imageUrl, alt: selected.title, label: 'Product' }];
      this.selectedMedia = 0;
      this.openFaq = -1;
      if (!slug) {
        await this.router.navigateByUrl(`/product-details/${encodeURIComponent(selected.id)}`, { replaceUrl: true });
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Could not load this product.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }
}