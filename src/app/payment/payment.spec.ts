import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';
import { Payment } from './payment';

const product: StoreProduct = {
  id: 'payment-test-product',
  sku: 'PAY-001',
  title: 'Payment test product',
  category: 'Test',
  description: 'Product used by payment tests.',
  eyebrow: 'TEST',
  imageUrl: '/test-product.jpg',
  currency: '\u20b9',
  price: 199,
  mrp: 399,
  stockQuantity: 5,
  stockLabel: 'Available now',
  gallery: [],
  benefits: [],
  features: [],
  specifications: [],
  packageContents: [],
  faqs: [],
};

const checkout = {
  productId: product.id,
  quantity: 2,
  customerId: 'CUS-payment-test',
  fullName: 'QA Payment Test',
  mobile: '9876543210',
  addressLine1: '12 Test Residency',
  addressLine2: 'Example Main Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pin: '560001',
};

describe('Payment', () => {
  let fixture: ComponentFixture<Payment>;
  let component: Payment;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalState: unknown;
  let originalUrl: string;

  beforeEach(async () => {
    originalState = window.history.state;
    originalUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({ checkout }, '', '/payment');
    fetchMock = vi.fn();

    await TestBed.configureTestingModule({
      imports: [Payment],
      providers: [
        provideRouter([]),
        {
          provide: ProductApiService,
          useValue: { getProduct: async () => product },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Payment);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.unstubAllGlobals();
    window.history.replaceState(originalState, '', originalUrl || '/');
  });

  it('shows a server-priced preview and masks the delivery mobile number', () => {
    expect(fixture.nativeElement.textContent).toContain('\u20b9398');
    expect(fixture.nativeElement.textContent).toContain('••••••3210');
    expect(fixture.nativeElement.querySelector('[role="radio"][aria-checked="true"]')?.textContent)
      .toContain('Online payment');
  });

  it('switches payment selection and keeps the preview explicitly marked', () => {
    const codOption = fixture.nativeElement.querySelectorAll('[role="radio"]')[1] as HTMLButtonElement;
    codOption.click();
    fixture.detectChanges();

    expect(codOption.getAttribute('aria-checked')).toBe('true');
    expect(fixture.nativeElement.querySelector('.provider-note')?.textContent).toContain('COD');
    expect(fixture.nativeElement.querySelector('.quote-disclaimer')?.textContent).toContain('Preview only');
  });

  it('sends a COD request with an idempotency key and surfaces API errors safely', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'This product is no longer available.' }),
    });

    await component.placeCodOrder();
    fixture.detectChanges();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/cod');
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeTruthy();
    expect(component.notice()).toBe('This product is no longer available.');
    expect(component.isSubmitting()).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not send a valid-looking order when checkout details are missing', async () => {
    component.checkout = null;
    vi.stubGlobal('fetch', fetchMock);

    await component.placeCodOrder();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(component.notice()).toContain('checkout details have expired');
    expect(component.isSubmitting()).toBe(false);
  });
});
