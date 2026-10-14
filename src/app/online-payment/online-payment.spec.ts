import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';
import { OnlinePayment } from './online-payment';
import { PaymentApiService } from './payment-api.service';

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

describe('OnlinePayment', () => {
  let fixture: ComponentFixture<OnlinePayment>;
  let originalState: unknown;
  let originalUrl: string;

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    if (originalUrl) window.history.replaceState(originalState, '', originalUrl);
  });

  it('restores pending payment status from the order URL after browser state is lost', async () => {
    originalState = window.history.state;
    originalUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', '/online-payment?orderId=ORD-QA-PENDING');
    const getPaymentStatus = vi.fn().mockResolvedValue({
      order_id: 'ORD-QA-PENDING',
      order_status: 'PAYMENT_PENDING',
      payment_method: 'UPI',
      payment_status: 'PAYMENT_PENDING',
      product_title: 'Test product',
      product_sku: 'TEST-001',
      quantity: 1,
      total: '199.00',
      currency: 'INR',
      order_date: '2026-10-14T00:00:00Z',
      expected_delivery_range: 'To be confirmed',
      notification_status: 'PENDING',
      notification_message: 'Waiting for payment provider confirmation.',
    });

    await TestBed.configureTestingModule({
      imports: [OnlinePayment],
      providers: [
        provideRouter([]),
        { provide: ProductApiService, useValue: { getProduct: vi.fn() } },
        { provide: PaymentApiService, useValue: { getPaymentStatus } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnlinePayment);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(getPaymentStatus).toHaveBeenCalledWith('ORD-QA-PENDING');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Payment Processing');
    expect(fixture.nativeElement.textContent).toContain('ORD-QA-PENDING');
    expect(fixture.nativeElement.textContent).not.toContain('Payment details unavailable');
  });

  it('renders a verified success result without depending on transient browser checkout state', async () => {
    originalState = window.history.state;
    originalUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', '/online-payment?orderId=ORD-QA-PAID');
    const getPaymentStatus = vi.fn().mockResolvedValue({
      order_id: 'ORD-QA-PAID',
      order_status: 'PLACED',
      payment_method: 'UPI',
      payment_status: 'PAID',
      product_title: 'Test product',
      product_sku: 'TEST-001',
      quantity: 1,
      total: '199.00',
      currency: 'INR',
      order_date: '2026-10-14T00:00:00Z',
      expected_delivery_range: 'To be confirmed',
      notification_status: 'SENT',
      notification_message: 'The store has been notified of your order.',
    });

    await TestBed.configureTestingModule({
      imports: [OnlinePayment],
      providers: [
        provideRouter([]),
        { provide: ProductApiService, useValue: { getProduct: vi.fn() } },
        { provide: PaymentApiService, useValue: { getPaymentStatus } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnlinePayment);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Payment Successful');
    expect(fixture.nativeElement.textContent).toContain('INR 199');
    expect(fixture.nativeElement.textContent).toContain('ORD-QA-PAID');
    expect(TestBed.inject(Router).url).not.toContain('ORD-QA-PAID');
  });

  it('loads Razorpay before creating a pending server order', async () => {
    originalState = window.history.state;
    originalUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({
      checkout: {
        productId: product.id,
        customerId: 'CUS-payment-test',
        fullName: 'QA Payment Test',
        mobile: '9876543210',
        addressLine1: '12 Test Residency',
        addressLine2: 'Example Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pin: '560001',
      },
    }, '', '/online-payment');
    const createOrder = vi.fn();
    const loadCheckoutScript = vi.fn().mockRejectedValue(new Error('Could not load Razorpay checkout script.'));

    await TestBed.configureTestingModule({
      imports: [OnlinePayment],
      providers: [
        provideRouter([]),
        { provide: ProductApiService, useValue: { getProduct: async () => product } },
        { provide: PaymentApiService, useValue: { createOrder, loadCheckoutScript } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnlinePayment);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    await fixture.componentInstance.payNow();
    fixture.detectChanges();

    expect(loadCheckoutScript).toHaveBeenCalledOnce();
    expect(createOrder).not.toHaveBeenCalled();
    expect(fixture.componentInstance.isSubmitting()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Choose a supported UPI app in the secure Razorpay checkout.');
    expect(fixture.nativeElement.querySelector('[aria-label="Preferred UPI app"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Could not load Razorpay checkout script.');
  });
});
