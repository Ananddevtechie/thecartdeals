import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { displayReviewerName, ProductApiService, ProductReviewSummary, StoreProduct } from './product-details/product-api.service';

const testProduct: StoreProduct = {
  id: 'test-product',
  sku: 'TEST-001',
  title: 'Test product',
  category: 'Test',
  description: 'Catalog product for the app test.',
  eyebrow: 'TEST LISTING',
  imageUrl: '/test-product.jpg',
  currency: '\u20b9',
  price: 250,
  mrp: 300,
  stockQuantity: 4,
  stockLabel: 'Available now',
  gallery: [],
  benefits: [],
  features: [],
  specifications: [],
  packageContents: [],
  faqs: [],
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: ProductApiService,
          useValue: {
            listProducts: async () => [testProduct],
            getAdminCredentials: () => null,
          },
        },
      ],
    }).compileComponents();
  });

  it('should omit Meesho from displayed reviewer names', () => {
    expect(displayReviewerName('Meesho User')).toBe(' ');
    expect(displayReviewerName('Customer Meesho')).toBe(' ');
    expect(displayReviewerName('**Meesho User**')).toBe(' ');
    expect(displayReviewerName('Verified Customer')).toBe('Verified Customer');
  });

  it('should share and cache one product reviews request', async () => {
    const summary: ProductReviewSummary = { average_rating: 5, review_count: 0, reviews: [] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => summary,
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const service = new ProductApiService();
      const results = await Promise.all([
        service.getProductReviews('test-product'),
        service.getProductReviews('test-product'),
      ]);
      await service.getProductReviews('test-product');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(results[0]).toBe(summary);
      expect(results[1]).toBe(summary);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should cache review pages independently and request the requested offset', async () => {
    const summary: ProductReviewSummary = { average_rating: 4.5, review_count: 21, reviews: [] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => summary,
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const service = new ProductApiService();
      await service.getProductReviews('test-product', 10, 10);
      await service.getProductReviews('test-product', 10, 10);
      await service.getProductReviews('test-product', 20, 10);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe('/api/products/test-product/reviews?offset=10&limit=10');
      expect(fetchMock.mock.calls[1][0]).toBe('/api/products/test-product/reviews?offset=20&limit=10');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should provide the seller WhatsApp link on storefront routes', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    const whatsappLink = fixture.nativeElement.querySelector('.whatsapp-link') as HTMLAnchorElement;
    expect(whatsappLink.href).toBe('https://wa.me/918590786095?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20the%20product.');
    expect(whatsappLink.target).toBe('_blank');
  });

  it('should hide the seller WhatsApp button on admin routes', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/admin/orders');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.whatsapp-link')).toBeNull();
  });

  it('should route to the product details component', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/product-details');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-product-details')).toBeTruthy();
  });

  it('should show the product catalog at the default route', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-storefront-home')).toBeTruthy();
  });

  it('should route to the selected help and policy section', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/thecartdetailsandpolicy/cancellation');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-thecartdetailsandpolicy h2')?.textContent).toContain('Cancellation Policy');
    expect(compiled.querySelector('app-thecartdetailsandpolicy h3')?.textContent).toContain('Before dispatch');
  });

  it('should not show the order tracking link in the storefront footer', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.footer-links a[routerLink="/track-order"]')).toBeNull();
    expect(compiled.querySelector('.footer-links a[routerLink="/thecartdetailsandpolicy/faq"]')?.textContent).toContain('FAQs');
  });

  it('should route the About Us footer link to the story section', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/thecartdetailsandpolicy/about-us');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-thecartdetailsandpolicy h2')?.textContent).toContain('About Us / Our Story');
    expect(compiled.querySelector('app-thecartdetailsandpolicy h3')?.textContent).toContain('Our story');
  });

  it('should remove the requested product shortcuts from the storefront footer', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Shop All Products');
    expect(compiled.textContent).not.toContain('All Categories');
    expect(compiled.textContent).not.toContain('Customer Reviews');
  });

  it('should route to the Privacy Policy section', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/thecartdetailsandpolicy/privacy');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-thecartdetailsandpolicy h2')?.textContent).toContain('Privacy Policy');
    expect(compiled.querySelector('app-thecartdetailsandpolicy h3')?.textContent).toContain('Information you provide');
  });

  it('should link all footer policies to their help page sections', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.footer-links a[routerLink="/thecartdetailsandpolicy/terms"]')?.textContent).toContain('Terms');
    expect(compiled.querySelector('.footer-links a[routerLink="/thecartdetailsandpolicy/payment"]')?.textContent).toContain('Payment');
    expect(compiled.querySelector('.footer-links a[routerLink="/thecartdetailsandpolicy/grievance"]')?.textContent).toContain('Grievance');
  });
});
