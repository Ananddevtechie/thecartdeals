import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { isEbookCategory, ProductApiService, StoreProduct } from '../product-api.service';

@Component({
  selector: 'app-ebook-product-details',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ebook-product-details.html',
  styleUrl: './ebook-product-details.scss',
})
export class EbookProductDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productApi = inject(ProductApiService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChildren('revealItem', { read: ElementRef }) revealItems?: QueryList<ElementRef<HTMLElement>>;

  readonly product = signal<StoreProduct | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  selectedPreview = 0;
  openFaq = -1;
  private revealObserver?: IntersectionObserver;
  private revealItemsSubscription?: Subscription;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      void this.loadProduct(params.get('slug'));
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.revealItemsSubscription = this.revealItems?.changes.subscribe(() => this.setupRevealObserver());
    this.setupRevealObserver();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.revealItemsSubscription?.unsubscribe();
  }

  get previewImages(): Array<{ src: string; alt: string; label: string }> {
    const product = this.product();
    if (!product) return [];
    const available = product.gallery?.length ? product.gallery : [{ src: product.imageUrl, alt: product.title, label: 'Product cover' }];
    return available.map((item) => ({
      src: this.normalizeImage(item.src),
      alt: item.alt || product.title || 'Product',
      label: item.label || 'Product',
    }));
  }

  get primaryImage(): string {
    const product = this.product();
    return product ? this.normalizeImage(product.imageUrl || this.previewImages[0]?.src || '') : '';
  }

  get discountPercent(): number {
    if (this.isAngularInterviewBook) return 80;
    const product = this.product();
    if (!product || !product.mrp) return 0;
    return Math.max(0, Math.round(((product.mrp - product.price) / product.mrp) * 100));
  }

  get isAngularInterviewBook(): boolean {
    const product = this.product();
    if (!product) return false;
    return product.id.toLowerCase().includes('angular-interview-question-bundle')
      || product.title.toLowerCase().includes('angular');
  }

  get displayTitle(): string {
    const product = this.product();
    if (!product) return '';
    return this.isAngularInterviewBook ? product.title.replace(/₹\s*149\b/, '₹99') : product.title;
  }

  get formattedOriginalPrice(): string {
    return this.formatPrice(this.isAngularInterviewBook ? 499 : this.product()?.mrp ?? 0);
  }

  get formattedOfferPrice(): string {
    return this.formatPrice(this.isAngularInterviewBook ? 99 : this.product()?.price ?? 0);
  }

  get audienceCards(): Array<{ title: string; text: string }> {
    return [
      { title: 'Freshers', text: 'Build confidence for your first technical interview with structured, practical Q&A practice.' },
      { title: 'Angular Developers', text: 'Sharpen your understanding of components, change detection, RxJS, and scalable app patterns.' },
      { title: 'Frontend Developers', text: 'Get stronger on TypeScript, HTML, CSS, accessibility, and modern UI architecture.' },
      { title: 'Experienced Professionals', text: 'Refresh your advanced concepts and prepare for deeper, scenario-based technical rounds.' },
      { title: 'Job Seekers', text: 'Practice the language that companies expect in product-focused, real-world engineering interviews.' },
      { title: 'MNC Interview Candidates', text: 'Cover the most common expectations from top-tier companies across service and product teams.' },
    ];
  }

  async purchase(): Promise<void> {
    const product = this.product();
    if (!product) return;
    await this.router.navigate(['/ebook-checkout'], { queryParams: { product: product.id } });
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? -1 : index;
  }

  private async loadProduct(slug: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.product.set(null);
    if (!slug) {
      this.loading.set(false);
      this.error.set('This eBook could not be found.');
      return;
    }

    try {
      const product = await this.productApi.getProduct(slug);
      if (!isEbookCategory(product.category)) {
        await this.router.navigateByUrl(`/product-details/${encodeURIComponent(product.id)}`, { replaceUrl: true });
        return;
      }

      this.product.set(product);
      this.selectedPreview = 0;
      this.setMetadata(product);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load this eBook.');
    } finally {
      this.loading.set(false);
      this.changeDetector.detectChanges();
    }
  }

  private setMetadata(product: StoreProduct): void {
    const description = product.description || 'Premium Angular interview preparation eBook with real-world questions and answers.';
    const displayTitle = this.isAngularInterviewBook ? product.title.replace(/₹\s*149\b/, '₹99') : product.title;
    this.title.setTitle(`${displayTitle} | Premium eBook | TheCart`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: `${displayTitle} | TheCart` });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    const primaryImage = this.primaryImage;
    if (primaryImage) {
      this.meta.updateTag({ property: 'og:image', content: primaryImage });
    }
  }

  private setupRevealObserver(): void {
    this.revealObserver?.disconnect();
    const elements = this.revealItems?.toArray() ?? [];
    if (!elements.length) return;

    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const element of elements) {
        element.nativeElement.classList.add('is-visible');
      }
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    for (const element of elements) {
      this.revealObserver.observe(element.nativeElement);
    }
  }

  private normalizeImage(src: string | null | undefined): string {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
    return src.startsWith('/') ? src : `/${src}`;
  }

  private formatPrice(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
