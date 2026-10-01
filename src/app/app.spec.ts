import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { ProductApiService, StoreProduct } from './product-details/product-api.service';

const testProduct: StoreProduct = {
  id: 'test-product',
  sku: 'TEST-001',
  title: 'Test product',
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
        { provide: ProductApiService, useValue: { listProducts: async () => [testProduct] } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
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
});
