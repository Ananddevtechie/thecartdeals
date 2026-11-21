import { afterEach, vi } from 'vitest';
import { PaymentApiService } from './payment-api.service';

describe('PaymentApiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the API detail for a JSON payment error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Razorpay is not configured.' }),
    }));

    await expect(new PaymentApiService().getPaymentStatus('order-1'))
      .rejects.toThrow('Razorpay is not configured.');
  });

  it('creates digital ebook payment orders through the online-only endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: 'ORD-EBOOK-1',
        key_id: 'test-key',
        provider_order_id: 'provider-order-1',
        checkout_config_id: '',
        amount: 14900,
        currency: 'INR',
        product_title: 'Interview eBook',
        customer_name: 'Test Buyer',
        customer_mobile: '9876543210',
        customer_email: 'buyer@example.com',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new PaymentApiService().createEbookOrder({
      product_id: 'interview-ebook',
      quantity: 1,
      full_name: 'Test Buyer',
      customer_email: 'buyer@example.com',
      mobile: '9876543210',
    })).resolves.toMatchObject({ order_id: 'ORD-EBOOK-1', amount: 14900 });

    expect(fetchMock).toHaveBeenCalledWith('/api/payments/razorpay/digital-orders', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        product_id: 'interview-ebook',
        quantity: 1,
        full_name: 'Test Buyer',
        customer_email: 'buyer@example.com',
        mobile: '9876543210',
      }),
    }));
  });

  it('uses the checkout handoff token to request a paid eBook download link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        download_url: 'https://api.example.test/api/ebooks/download/secure-token',
        expires_at: '2026-11-24T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new PaymentApiService().createEbookDownloadLink('ORD-BOOK-1', 'checkout-secret'))
      .resolves.toMatchObject({ expires_at: '2026-11-24T00:00:00Z' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/razorpay/orders/ORD-BOOK-1/download-link',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer checkout-secret' },
      }),
    );
  });

  it('returns a readable message for non-JSON gateway failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));

    await expect(new PaymentApiService().getPaymentStatus('order-1'))
      .rejects.toThrow('Payment service is temporarily unavailable.');
  });

  it('returns a connection message when the payment API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(new PaymentApiService().getPaymentStatus('order-1'))
      .rejects.toThrow('Could not connect to the payment service.');
  });
});
