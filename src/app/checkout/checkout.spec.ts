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

  afterEach(() => vi.unstubAllGlobals());

  it('fills available address fields from location without overwriting entered values', async () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const existingCity = form.elements.namedItem('city') as HTMLInputElement;
    existingCity.value = 'Already entered city';
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 12.9716, longitude: 77.5946 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        display_name: 'Hadosiddapura, Bangalore East, Bengaluru Urban, Karnataka, 560035, India',
        address: {
          building: 'Tower A',
          house_number: '12',
          road: 'MG Road',
          suburb: 'Central',
          postcode: '560001',
          city: 'Bengaluru',
          state: 'Karnataka',
          amenity: 'City Library',
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await component.useCurrentLocation(form);
    fixture.detectChanges();

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
    expect((form.elements.namedItem('addressLine1') as HTMLInputElement).value).toBe('Tower A 12');
    expect((form.elements.namedItem('addressLine2') as HTMLInputElement).value)
      .toBe('Hadosiddapura, Bangalore East, Bengaluru Urban, Karnataka, 560035, India');
    expect((form.elements.namedItem('pin') as HTMLInputElement).value).toBe('560001');
    expect(existingCity.value).toBe('Already entered city');
    expect((form.elements.namedItem('state') as HTMLSelectElement).value).toBe('Karnataka');
    expect((form.elements.namedItem('landmark') as HTMLInputElement).value).toBe('City Library');
    expect((form.elements.namedItem('fullName') as HTMLInputElement).value).toBe('');
    expect((form.elements.namedItem('mobile') as HTMLInputElement).value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Please review the details and enter your name and mobile number');
  });

  it('explains when location permission is denied', async () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'Permission denied' } as GeolocationPositionError);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await component.useCurrentLocation(form);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Location permission was denied');
  });

  it('retries unavailable location with high accuracy before showing an error', async () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const getCurrentPosition = vi.fn((
      success: PositionCallback,
      error: PositionErrorCallback,
      options?: PositionOptions,
    ) => {
      if (getCurrentPosition.mock.calls.length === 1) {
        error({ code: 2, message: 'Position unavailable' } as GeolocationPositionError);
        return;
      }
      success({
        coords: { latitude: 12.9716, longitude: 77.5946 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ address: { city: 'Bengaluru', state: 'Karnataka', postcode: '560001' } }),
    })));

    await component.useCurrentLocation(form);
    fixture.detectChanges();

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: false });
    expect(getCurrentPosition.mock.calls[1][2]).toMatchObject({
      enableHighAccuracy: true,
      maximumAge: 300_000,
    });
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Filled 3 address fields');
  });

  it('reminds the customer when location lookup cannot fill the house or building name', async () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: { latitude: 12.9004363, longitude: 77.7055349 } as GeolocationCoordinates,
        } as GeolocationPosition),
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        display_name: 'Hadosiddapura, Bangalore East, Bengaluru Urban, Karnataka, 560035, India',
        address: {
          city_district: 'Hadosiddapura',
          county: 'Bangalore East',
          state: 'Karnataka',
          postcode: '560035',
        },
      }),
    })));

    await component.useCurrentLocation(form);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Filled 4 address fields. Please review the details and enter your name and mobile number. House no. / building name is still required.');
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
