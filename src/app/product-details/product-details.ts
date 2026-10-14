import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShoppingCartService, ShoppingCartItem } from '../cart/shopping-cart.service';
import { displayReviewerName, ProductApiService, ProductReviewSummary, StoreProduct } from './product-api.service';

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
  imports: [RouterLink],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly cart = inject(ShoppingCartService);
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('cartTrigger') private cartTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('cartCloseButton') private cartCloseButton?: ElementRef<HTMLButtonElement>;

  product = emptyProduct;
  catalog: StoreProduct[] = [];
  relatedProducts: StoreProduct[] = [];
  reviewSummary = signal<ProductReviewSummary>({ average_rating: 0, review_count: 0, reviews: [] });
  reviewsLoading = signal(false);
  reviewsError = signal('');
  reviewPage = 0;
  readonly reviewPageSize = 10;
  relatedPage = 0;
  readonly relatedPageSize = 10;
  media: ProductMedia[] = [];
  selectedMedia = 0;
  openFaq = -1;
  zoomed = false;
  loading = signal(true);
  loadError = '';
  cartOpen = signal(false);
  private reviewRequestGeneration = 0;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.loadProduct(params.get('slug'));
    });
  }

  get savings(): number {
    return Math.max(0, this.product.mrp - this.product.price);
  }

  get sortedReviews(): ProductReviewSummary['reviews'] {
    return this.reviewSummary().reviews;
  }

  get visibleReviews(): ProductReviewSummary['reviews'] {
    return this.reviewSummary().reviews;
  }

  get totalReviewPages(): number {
    return Math.ceil(this.reviewSummary().review_count / this.reviewPageSize);
  }

  get firstReviewNumber(): number {
    return this.reviewSummary().review_count ? this.reviewPage * this.reviewPageSize + 1 : 0;
  }

  get lastReviewNumber(): number {
    return Math.min(
      this.reviewPage * this.reviewPageSize + this.reviewSummary().reviews.length,
      this.reviewSummary().review_count,
    );
  }

  previousReviewPage(): void {
    const previousPage = Math.max(0, this.reviewPage - 1);
    if (previousPage !== this.reviewPage) void this.loadReviewPage(previousPage);
  }

  nextReviewPage(): void {
    const nextPage = Math.min(this.totalReviewPages - 1, this.reviewPage + 1);
    if (nextPage !== this.reviewPage) void this.loadReviewPage(nextPage);
  }

  get visibleRelatedProducts(): StoreProduct[] {
    const start = this.relatedPage * this.relatedPageSize;
    return this.relatedProducts.slice(start, start + this.relatedPageSize);
  }

  get relatedStartNumber(): number {
    return this.relatedProducts.length ? this.relatedPage * this.relatedPageSize + 1 : 0;
  }

  get relatedEndNumber(): number {
    return Math.min((this.relatedPage + 1) * this.relatedPageSize, this.relatedProducts.length);
  }

  previousRelatedPage(): void {
    this.relatedPage = Math.max(0, this.relatedPage - 1);
  }

  nextRelatedPage(): void {
    const lastPage = Math.max(0, Math.ceil(this.relatedProducts.length / this.relatedPageSize) - 1);
    this.relatedPage = Math.min(lastPage, this.relatedPage + 1);
  }

  selectMedia(index: number): void {
    this.selectedMedia = index;
    this.zoomed = false;
  }

  navigateToCheckout(): void {
    void this.router.navigate(['/checkout'], { queryParams: { product: this.product.id } });
  }

  navigateToReviews(event: MouseEvent): void {
    this.navigateToSection(event, 'reviews');
  }

  navigateToFaq(event: MouseEvent): void {
    this.navigateToSection(event, 'faq');
  }

  private navigateToSection(event: MouseEvent, section: 'reviews' | 'faq'): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigateByUrl(`/product-details/${encodeURIComponent(this.product.id)}#${section}`);
  }

  addToCart(): void {
    this.cart.add(this.product);
    this.openCart();
  }

  openCart(): void {
    if (this.cartOpen()) return;
    this.cartOpen.set(true);
    window.setTimeout(() => {
      if (this.cartOpen()) this.cartCloseButton?.nativeElement.focus();
    });
  }

  closeCart(): void {
    this.cartOpen.set(false);
    window.setTimeout(() => this.cartTrigger?.nativeElement.focus());
  }

  @HostListener('document:keydown', ['$event'])
  handleCartKeydown(event: KeyboardEvent): void {
    if (!this.cartOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCart();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = document.querySelector<HTMLElement>('.cart-drawer');
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  changeCartQuantity(item: ShoppingCartItem, amount: number): void {
    this.cart.setQuantity(item.productId, item.quantity + amount);
  }

  checkoutCartItem(item: ShoppingCartItem): void {
    void this.router.navigate(['/checkout'], {
      queryParams: { product: item.productId },
      state: { checkout: { productId: item.productId, quantity: item.quantity } },
    });
  }

  openProduct(product: StoreProduct): void {
    void this.router.navigateByUrl(`/product-details/${encodeURIComponent(product.id)}`);
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? -1 : index;
  }

  ratingStars(rating: number): string {
    const filled = Math.max(0, Math.min(5, Math.round(rating)));
    return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
  }

  formatReviewDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  displayReviewerName(name: string): string {
    return displayReviewerName(name);
  }

  private async loadProduct(slug: string | null): Promise<void> {
    this.loading.set(true);
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
      this.product = await this.productApi.getProduct(selected.id);
      this.loadProductReviews(this.product);
      this.relatedProducts = this.catalog
        .filter((item) => item.id !== selected.id)
        .sort((first, second) => Number(second.category === selected.category) - Number(first.category === selected.category));
      this.relatedPage = 0;
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
      this.loading.set(false);
      this.changeDetector.detectChanges();
    }
  }

  private async loadProductReviews(product: StoreProduct): Promise<void> {
    this.reviewSummary.set({ average_rating: 0, review_count: 0, reviews: [] });
    this.reviewPage = 0;
    this.reviewsError.set('');
    await this.loadReviewPage(0, product);
  }

  private async loadReviewPage(page: number, product = this.product): Promise<void> {
    if (!product.id || page < 0 || (page >= this.totalReviewPages && page !== 0)) return;
    const requestGeneration = ++this.reviewRequestGeneration;
    this.reviewPage = page;
    this.reviewsLoading.set(true);
    this.reviewsError.set('');
    try {
      const summary = await this.productApi.getProductReviews(
        product.id,
        page * this.reviewPageSize,
        this.reviewPageSize,
      );
      if (this.product.id === product.id && requestGeneration === this.reviewRequestGeneration) {
        this.reviewSummary.set(summary);
      }
    } catch (error) {
      if (this.product.id === product.id && requestGeneration === this.reviewRequestGeneration) {
        this.reviewsError.set(error instanceof Error ? error.message : 'Could not load customer reviews.');
      }
    } finally {
      if (this.product.id === product.id && requestGeneration === this.reviewRequestGeneration) {
        this.reviewsLoading.set(false);
        this.changeDetector.detectChanges();
      }
    }
  }
}