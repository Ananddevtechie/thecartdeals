import { Injectable } from '@angular/core';

export interface CustomerSaveRequest {
  full_name: string;
  mobile: string;
  alternate_mobile: string | null;
  address_line1: string;
  address_line2: string;
  pincode: string;
  city: string;
  state: string;
  landmark: string | null;
}

interface CustomerSaveResponse {
  customer_id?: string;
  detail?: string;
}

const SAVE_ERROR = 'Could not save your delivery details. Please try again.';

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  async saveCustomer(request: CustomerSaveRequest): Promise<string> {
    let response: Response;
    try {
      response = await fetch('/api/customers/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch {
      throw new Error('Could not connect to save your delivery details. Please check your connection and try again.');
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      if (!response.ok) throw new Error(SAVE_ERROR);
      throw new Error('The server returned an invalid response. Please try again.');
    }

    const payload = typeof result === 'object' && result !== null
      ? result as CustomerSaveResponse
      : null;
    if (!response.ok) {
      throw new Error(typeof payload?.detail === 'string' ? payload.detail : SAVE_ERROR);
    }
    if (typeof payload?.customer_id !== 'string' || !payload.customer_id) {
      throw new Error('The server did not confirm your delivery details. Please try again.');
    }
    return payload.customer_id;
  }
}