import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { ProductApiService } from '../product-details/product-api.service';
import { OrderTrackingApiService } from '../order-tracking/order-tracking-api.service';
import { AdminOrders } from './admin-orders';

const pdfMock = vi.hoisted(() => ({
  textCalls: [] as string[],
  textAlignments: new Map<string, string | undefined>(),
  savedFilename: '',
  addPageCalls: 0,
  imageAdded: false,
}));

vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFillColor(..._values: number[]): void {}
    rect(..._values: number[]): void {}
    setTextColor(..._values: number[]): void {}
    setFont(..._values: string[]): void {}
    setFontSize(..._values: number[]): void {}
    setCharSpace(..._values: number[]): void {}
    text(content: string | string[], _x?: number, _y?: number, options?: { align?: string }): void {
      pdfMock.textCalls.push(...(Array.isArray(content) ? content : [content]));
      if (typeof content === 'string') pdfMock.textAlignments.set(content, options?.align);
    }
    splitTextToSize(content: string): string[] {
      return [content];
    }
    addPage(): void {
      pdfMock.addPageCalls += 1;
    }
    roundedRect(
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _radiusX: number,
      _radiusY: number,
      _style: string,
    ): void {}
    circle(_x: number, _y: number, _radius: number, _style: string): void {}
    moveTo(_x: number, _y: number): void {}
    lineTo(_x: number, _y: number): void {}
    curveTo(..._values: number[]): void {}
    close(): void {}
    fill(): void {}
    setLineWidth(..._values: number[]): void {}
    addImage(
      _imageData: string,
      _format: string,
      _x: number,
      _y: number,
      _width: number,
      _height: number,
    ): void {
      pdfMock.imageAdded = true;
    }
    setDrawColor(..._values: number[]): void {}
    line(..._values: number[]): void {}
    getNumberOfPages(): number {
      return 1;
    }
    setPage(): void {}
    save(filename: string): void {
      pdfMock.savedFilename = filename;
    }
  },
}));

const order = {
  order_id: 'ORD-QA-001',
  product_title: 'Test product',
  product_sku: 'TEST-001',
  quantity: 1,
  total: '199.00',
  currency: 'INR' as const,
  payment_method: 'COD' as const,
  payment_status: 'COD_PENDING',
  delivery_status: 'ORDER_CONFIRMED' as const,
  estimated_delivery_date: null,
  order_date: '2026-10-14T00:00:00Z',
  tracking_events: [{ status: 'ORDER_CONFIRMED' as const, estimated_delivery_date: null, created_at: '2026-10-14T00:00:00Z' }],
  customer_name: 'QA Customer',
  customer_mobile: '9876543210',
  alternate_mobile: null,
  customer_email: null,
  address_line1: '12 Test Residency',
  address_line2: 'Example Main Road',
  landmark: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  mrp: '399.00',
  discount: '200.00',
  shipping: '0.00',
  tax: '0.00',
  cod_fee: '0.00',
  payment_reference: 'pay_TnrQdJWLdc1P2j',
  meesho_url: 'https://www.meesho.com/test-product/p/123',
};

describe('AdminOrders', () => {
  let fixture: ComponentFixture<AdminOrders>;
  const listAdminOrders = vi.fn(async () => [order]);
  const updateAdminOrder = vi.fn(async (_username: string, _password: string, _orderId: string, deliveryStatus: typeof order.delivery_status, estimatedDeliveryDate: string | null) => ({
    ...order,
    delivery_status: deliveryStatus,
    estimated_delivery_date: estimatedDeliveryDate,
  }));
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    listAdminOrders.mockClear();
    updateAdminOrder.mockClear();
    pdfMock.textCalls.length = 0;
    pdfMock.textAlignments.clear();
    pdfMock.savedFilename = '';
    pdfMock.addPageCalls = 0;
    pdfMock.imageAdded = false;
    await TestBed.configureTestingModule({
      imports: [AdminOrders],
      providers: [
        provideRouter([]),
        { provide: ProductApiService, useValue: { getAdminCredentials: () => ({ username: 'admin', password: 'test' }) } },
        { provide: OrderTrackingApiService, useValue: { listAdminOrders, updateAdminOrder } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOrders);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('shows order details without delivery tracking controls or history', () => {
    const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
    expect(row.textContent).toContain('COD · Pending');
    row.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.customer-block')?.textContent).toContain('QA Customer');
    expect(fixture.nativeElement.querySelector('.product-block')?.textContent).toContain('Test product');
    expect(fixture.nativeElement.querySelector('.tracking-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.history')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Save tracking update');
    expect(fixture.nativeElement.textContent).not.toContain('Tracking update history');
  });

  it('colors paid, COD pending, and cancelled orders distinctly', () => {
    const paidOrder = { ...order, order_id: 'ORD-PAID', payment_status: 'PAID' };
    const pendingOrder = { ...order, order_id: 'ORD-PENDING', payment_status: 'COD_PENDING' };
    const cancelledOrder = { ...order, order_id: 'ORD-CANCELLED', delivery_status: 'CANCELLED' as const };
    expect(fixture.componentInstance.paymentTone(paidOrder)).toBe('paid');
    expect(fixture.componentInstance.paymentTone(pendingOrder)).toBe('pending');
    expect(fixture.componentInstance.paymentTone(cancelledOrder)).toBe('cancelled');
    expect(fixture.nativeElement.querySelector('.order-row .payment-status')?.classList.contains('payment-pending')).toBe(true);
  });

  it('filters orders by exact expected delivery date and payment category together', () => {
    const paidOrder = {
      ...order,
      order_id: 'ORD-PAID',
      payment_method: 'UPI' as const,
      payment_status: 'PAID',
      estimated_delivery_date: '2026-10-20',
    };
    const codOrder = {
      ...order,
      order_id: 'ORD-COD',
      estimated_delivery_date: '2026-10-20',
    };
    const cancelledOrder = {
      ...order,
      order_id: 'ORD-CANCELLED',
      delivery_status: 'CANCELLED' as const,
      estimated_delivery_date: '2026-10-20',
    };
    const differentDateOrder = {
      ...paidOrder,
      order_id: 'ORD-OTHER-DATE',
      estimated_delivery_date: '2026-10-21',
    };
    fixture.componentInstance.orders = [paidOrder, codOrder, cancelledOrder, differentDateOrder];

    fixture.componentInstance.expectedDeliveryDateFilter = '2026-10-20';
    fixture.componentInstance.paymentFilter = 'COD';
    expect(fixture.componentInstance.filteredOrders.map((item) => item.order_id)).toEqual(['ORD-COD']);

    fixture.componentInstance.paymentFilter = 'PAID';
    expect(fixture.componentInstance.filteredOrders.map((item) => item.order_id)).toEqual(['ORD-PAID']);

    fixture.componentInstance.paymentFilter = 'CANCELLED';
    expect(fixture.componentInstance.filteredOrders.map((item) => item.order_id)).toEqual(['ORD-CANCELLED']);

    fixture.componentInstance.clearOrderFilters();
    expect(fixture.componentInstance.filteredOrders.map((item) => item.order_id))
      .toEqual(['ORD-PAID', 'ORD-COD', 'ORD-CANCELLED', 'ORD-OTHER-DATE']);
  });

  it('renders the requested customer, product, payment breakdown, and UTC order date', () => {
    const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const detailText = fixture.nativeElement.querySelector('.order-detail-panel')?.textContent ?? '';
    expect(detailText).toContain('ORD-QA-001');
    expect(detailText).toContain('QA Customer');
    expect(detailText).toContain('+91 9876543210');
    expect(detailText).toContain('Alternate phone');
    expect(detailText).toContain('Not provided');
    expect(detailText).toContain('Email');
    expect(detailText).toContain('12 Test Residency');
    expect(detailText).toContain('Example Main Road');
    expect(detailText).toContain('Bengaluru');
    expect(detailText).toContain('Karnataka');
    expect(detailText).toContain('560001');
    expect(detailText).toContain('TEST-001');
    expect(detailText).toContain('Payment reference');
    expect(detailText).toContain('MRP');
    expect(detailText).toContain('Discount');
    expect(detailText).toContain('COD fee');
    expect(detailText).toContain('Total');
    expect(detailText).toContain('14/10/2026, 00:00 UTC');
  });

  it('downloads a formatted order PDF without Meesho links or payment references', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['logo']), { status: 200 }),
    );
    const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
    row.click();
    fixture.componentInstance.selectOrder({ ...order, estimated_delivery_date: '2026-10-20' });
    fixture.detectChanges();

    const downloadButton = fixture.nativeElement.querySelector('.download-pdf-button') as HTMLButtonElement;
    expect(downloadButton).not.toBeNull();
    downloadButton.click();
    await vi.waitFor(() => expect(fixture.componentInstance.downloadingPdf).toBe(false));
    fixture.detectChanges();

    expect(fixture.componentInstance.error).toBe('');
    const pdfText = pdfMock.textCalls.join(' ');
    expect(pdfMock.savedFilename).toBe('TheCart-order-ORD-QA-001.pdf');
    expect(pdfMock.addPageCalls).toBe(0);
    expect(pdfMock.imageAdded).toBe(true);
    expect(pdfText).toContain('THE CART');
    expect(pdfText).toContain('EVERYDAY, ELEVATED');
    expect(pdfText).toContain('Customer details');
    expect(pdfText).toContain('Delivery address');
    expect(pdfText).toContain('Product details');
    expect(pdfText).toContain('Delivery information');
    expect(pdfText).toContain('Payment summary');
    expect(pdfText).toContain('Expected delivery date');
    expect(pdfText).toContain('Cash on delivery · COD · Pending');
    expect(pdfText).toContain('INR 399.00');
    expect(pdfText).toContain('INR 199.00');
    expect(pdfText).toContain('20 Oct 2026');
    expect(pdfText).toContain('14/10/2026, 05:30 AM IST');
    expect(pdfMock.textAlignments.get('#ORD-QA-001')).toBe('right');
    expect(pdfMock.textAlignments.get('Placed 14/10/2026, 05:30 AM IST')).toBe('right');
    expect(pdfText).not.toMatch(/\b0[1-3]\b/);
    expect(pdfText).not.toContain('TITLE TEXT');
    expect(pdfText).not.toContain('Delivery status');
    expect(pdfText).not.toContain('TEST-001');
    expect(pdfText).not.toContain('https://www.meesho.com');
    expect(pdfText).not.toContain('pay_TnrQdJWLdc1P2j');
    expect(pdfText).not.toContain('Payment reference');
  });

  it('renders each delivery address field as a visible row with its own copy action', () => {
    const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const addressSection = fixture.nativeElement.querySelector('.customer-block') as HTMLElement;
    expect(addressSection.querySelector('.address-subheading')?.textContent).toContain('Delivery address');
    for (const [label, value, ariaLabel] of [
      ['House / building', '12 Test Residency', 'Copy house or building'],
      ['Road / area', 'Example Main Road', 'Copy road or area'],
      ['City', 'Bengaluru', 'Copy city'],
      ['State', 'Karnataka', 'Copy state'],
      ['PIN code', '560001', 'Copy PIN code'],
    ]) {
      const detailRow = [...addressSection.querySelectorAll('.detail-row')]
        .find((element) => element.querySelector(':scope > span:first-child')?.textContent?.trim() === label);
      expect(detailRow?.querySelector('.detail-value strong')?.textContent).toContain(value);
      expect(detailRow?.querySelector(`[aria-label="${ariaLabel}"]`)).not.toBeNull();
    }
  });

  it('shows WhatsApp and Meesho product links and lets the admin update delivery status and date', async () => {
    const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.customer-block .whatsapp-button[href="https://wa.me/919876543210"]')?.textContent)
      .toContain('Chat with customer on WhatsApp');
    expect(fixture.nativeElement.querySelector('.product-block a[href="https://www.meesho.com/test-product/p/123"]')).not.toBeNull();

    const status = fixture.nativeElement.querySelector('.delivery-field select') as HTMLSelectElement;
    status.value = 'IN_TRANSIT';
    status.dispatchEvent(new Event('change'));
    const date = fixture.nativeElement.querySelector('.delivery-block input[type="date"]') as HTMLInputElement;
    date.value = '2026-10-20';
    date.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.save-delivery-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateAdminOrder).toHaveBeenCalledWith(
      'admin',
      'test',
      'ORD-QA-001',
      'IN_TRANSIT',
      '2026-10-20',
    );
    expect(fixture.nativeElement.querySelector('.update-notice')?.textContent).toContain('Delivery details saved.');
    expect(fixture.nativeElement.querySelector('input[type="url"]')).toBeNull();
    const updatedRow = fixture.nativeElement.querySelector('.order-row') as HTMLElement;
    expect(updatedRow.querySelector('.delivery-status')?.textContent).toContain('In transit');
    expect(updatedRow.querySelector('.order-delivery-date')?.textContent).toContain('20 Oct 2026');
  });

  it('copies a single selected customer or address field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
      row.click();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('[aria-label="Copy phone number"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(writeText).toHaveBeenCalledWith('+91 9876543210');
      expect(fixture.nativeElement.querySelector('.copy-notice')?.textContent).toContain('Phone number copied.');
      expect(fixture.nativeElement.querySelectorAll('.copy-button').length).toBeGreaterThanOrEqual(7);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('announces clipboard permission failures without throwing', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    });

    try {
      const row = fixture.nativeElement.querySelector('.order-row') as HTMLButtonElement;
      row.click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[aria-label="Copy name"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.copy-notice')?.textContent)
        .toContain('Could not copy name');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
