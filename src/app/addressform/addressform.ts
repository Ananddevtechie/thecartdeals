import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

export interface ExtractedAddress {
  name: string;
  mobile: string;
  house: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pin: string;
}

interface AddressField {
  key: keyof ExtractedAddress;
  label: string;
  value: string;
  copied: boolean;
}

const FIELD_DEFS: { key: keyof ExtractedAddress; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile number' },
  { key: 'house', label: 'House / flat no.' },
  { key: 'address', label: 'Full address' },
  { key: 'area', label: 'Area / locality' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pin', label: 'PIN code' },
];

@Component({
  selector: 'app-addressform',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  styleUrl: './addressform.scss',
  templateUrl: './addressform.html',
})
export class Addressform {
  private http = inject(HttpClient);

  /** Backend endpoint that holds the Anthropic API key and forwards the extraction request. */
  private readonly extractEndpoint = '/api/extract';

  readonly perforationDots = Array.from({ length: 28 });

  rawText = signal(
    'Rajesh. M\nKochu puthean parambu.\nAmbalapuzha.\nAlappuzha.\nPin. 688561.\nNo.6238122933.'
  );
  loading = signal(false);
  error = signal<string | null>(null);
  fields = signal<AddressField[]>([]);
  hasResult = signal(false);
  allCopied = signal(false);

  extract(): void {
    const text = this.rawText().trim();
    if (!text) {
      this.error.set('Paste an order note first.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    this.hasResult.set(false);

    this.http.post<ExtractedAddress>(this.extractEndpoint, { text }).subscribe({
      next: (result) => {
        const populated = FIELD_DEFS.map((def) => ({
          ...def,
          value: result[def.key] ?? '',
          copied: false,
        }));
        this.fields.set(populated);
        this.loading.set(false);
        this.hasResult.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.error.set("Couldn't read that note. Check the text and try again.");
      },
    });
  }

  updateField(key: keyof ExtractedAddress, value: string): void {
    this.fields.update((fields) =>
      fields.map((f) => (f.key === key ? { ...f, value } : f))
    );
  }

  async copyField(field: AddressField): Promise<void> {
    await navigator.clipboard.writeText(field.value);
    this.fields.update((fields) =>
      fields.map((f) => (f.key === field.key ? { ...f, copied: true } : f))
    );
    setTimeout(() => {
      this.fields.update((fields) =>
        fields.map((f) => (f.key === field.key ? { ...f, copied: false } : f))
      );
    }, 1200);
  }

  async copyAll(): Promise<void> {
    const text = this.fields()
      .map((f) => `${f.label}: ${f.value}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    this.allCopied.set(true);
    setTimeout(() => this.allCopied.set(false), 1200);
  }
}