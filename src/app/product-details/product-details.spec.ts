import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProductApiService, ProductReview, ProductReviewSummary, StoreProduct } from './product-api.service';
import { ProductDetails } from './product-details';

const product: StoreProduct = {
  id: 'test-product',
  sku: 'TEST-001',
  title: 'Test product',
  category: 'Test',
  description: 'Test product description.',
  eyebrow: 'TEST',
  imageUrl: '/test-product.jpg',
  currency: '\u20b9',
  price: 100,
  mrp: 120,
  stockQuantity: 2,
  stockLabel: 'Available now',
  gallery: [],
  benefits: [],
  features: [],
  specifications: [],
  packageContents: [],
  faqs: [],
};

function makeReview(id: string): ProductReview {
  return {
    id,
    reviewer_name: 'Verified customer',
    rating: 5,
    comment: `Review ${id}`,
    created_at: '2026-10-14T00:00:00Z',
    image_urls: [],
  };
}

describe('ProductDetails', () => {
  let fixture: ComponentFixture<ProductDetails>;
  let component: ProductDetails;
  let getProductReviews: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const firstPage: ProductReviewSummary = {
      average_rating: 4.5,
      review_count: 12,
      reviews: Array.from({ length: 10 }, (_, index) => makeReview(String(index + 1))),
    };
    const secondPage: ProductReviewSummary = {
      ...firstPage,
      reviews: [makeReview('11'), makeReview('12')],
    };
    getProductReviews = vi.fn(async (_slug: string, offset = 0) => offset === 0 ? firstPage : secondPage);

    await TestBed.configureTestingModule({
      imports: [ProductDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: product.id })) },
        },
        {
          provide: ProductApiService,
          useValue: {
            listProducts: async () => [product],
            getProduct: async () => product,
            getProductReviews,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('renders the product after its asynchronous data load', () => {
    expect(fixture.nativeElement.querySelector('.product-state')).toBeNull();
    expect(fixture.nativeElement.querySelector('#product-title')?.textContent).toContain(product.title);
  });

  it('loads the selected review page while retaining the total review count', async () => {
    expect(fixture.nativeElement.querySelectorAll('.customer-review')).toHaveLength(10);
    expect(fixture.nativeElement.querySelector('[aria-label="Customer review pages"]')?.textContent)
      .toContain('Showing 1-10 of 12 reviews');

    component.nextReviewPage();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(getProductReviews).toHaveBeenLastCalledWith(product.id, 10, 10);
    expect(fixture.nativeElement.querySelectorAll('.customer-review')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('[aria-label="Customer review pages"]')?.textContent)
      .toContain('Showing 11-12 of 12 reviews');
  });

  it('moves focus into the cart, traps keyboard navigation, and closes on Escape', async () => {
    const trigger = fixture.nativeElement.querySelector('.cart-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const closeButton = fixture.nativeElement.querySelector('.cart-close') as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    const continueButton = fixture.nativeElement.querySelector('.cart-empty button') as HTMLButtonElement;
    continueButton.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(closeButton);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(continueButton);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
