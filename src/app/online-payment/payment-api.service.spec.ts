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
