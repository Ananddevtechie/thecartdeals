import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';
import { CustomerApiService } from './customer-api.service';
import { Checkout } from './checkout';

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

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  let component: Checkout;
  let saveCustomer: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    saveCustomer = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ product: product.id }) } },
        },
        {
          provide: ProductApiService,
          useValue: { getProduct: async () => product },
        },
        {
          provide: CustomerApiService,
          useValue: { saveCustomer },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('prevents whitespace-only fields and mirrors backend text limits', () => {
    const fullName = fixture.nativeElement.querySelector('[name="fullName"]') as HTMLInputElement;
    const addressLine1 = fixture.nativeElement.querySelector('[name="addressLine1"]') as HTMLInputElement;
    const addressLine2 = fixture.nativeElement.querySelector('[name="addressLine2"]') as HTMLInputElement;
    const city = fixture.nativeElement.querySelector('[name="city"]') as HTMLInputElement;

    for (const field of [fullName, addressLine1, addressLine2, city]) {
      field.value = '   ';
      expect(field.checkValidity()).toBe(false);
    }
    expect(fullName.maxLength).toBe(120);
    expect(addressLine1.maxLength).toBe(255);
    expect(addressLine2.maxLength).toBe(255);
    expect(city.maxLength).toBe(100);
  });

  it('includes every Indian state and union territory', () => {
    expect(component.indianStates).toHaveLength(36);
    expect(component.indianStates).toContain('Chandigarh');
    expect(component.indianStates).toContain('Delhi');
    expect(component.indianStates).toContain('Jammu and Kashmir');
    expect(component.indianStates).toContain('Ladakh');
    expect(component.indianStates).toContain('Lakshadweep');
    expect(component.indianStates).toContain('Puducherry');
    expect(component.indianStates).toContain('Andaman and Nicobar Islands');
    expect(component.indianStates).toContain('Dadra and Nagar Haveli and Daman and Diu');
  });

  it('shows a save error and re-enables submit after the API rejects', async () => {
    saveCustomer.mockRejectedValue(new Error('Could not save your delivery details. Please try again.'));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const values: Record<string, string> = {
      fullName: 'QA Checkout',
      mobile: '9876543210',
      addressLine1: '12 Test Residency',
      addressLine2: 'Example Main Road',
      pin: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
    };
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
      field.value = value;
    }

    const event = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
    Object.defineProperty(event, 'currentTarget', { value: form });
    await component.continueToPayment(event);

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Could not save your delivery details');
    expect((form.querySelector('[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('CustomerApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a useful message when the API gateway returns non-JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    const service = new CustomerApiService();

    await expect(service.saveCustomer({
      full_name: 'QA Checkout',
      mobile: '9876543210',
      alternate_mobile: null,
      address_line1: '12 Test Residency',
      address_line2: 'Example Main Road',
      pincode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      landmark: null,
    })).rejects.toThrow('Could not save your delivery details. Please try again.');
  });
});
