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

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  async saveCustomer(request: CustomerSaveRequest): Promise<string> {
    const response = await fetch('/api/customers/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const result = await response.json() as CustomerSaveResponse;
    if (!response.ok) {
      throw new Error(result.detail ?? 'Could not save your delivery details. Please try again.');
    }
    if (!result.customer_id) {
      throw new Error('The server did not confirm your delivery details. Please try again.');
    }
    return result.customer_id;
  }
}