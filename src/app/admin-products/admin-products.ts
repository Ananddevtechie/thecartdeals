import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductApiService, ProductDraft, StoreProduct } from '../product-details/product-api.service';

type AdminProduct = StoreProduct & { costPrice: number; isActive: boolean };

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts {
  private readonly productApi = inject(ProductApiService);
  username = '';
  password = '';
  products: AdminProduct[] = [];
  error = '';
  notice = '';
  busy = false;
  unlocked = false;
  slug = '';

  async unlock(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const username = String(values.get('adminUsername') ?? '').trim();
    const password = String(values.get('adminPassword') ?? '');
    this.busy = true;
    this.error = '';
    try {
      this.products = await this.productApi.listAdminProducts(username, password);
      this.username = username;
      this.password = password;
      this.unlocked = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not verify admin access.';
    } finally {
      this.busy = false;
    }
  }

  updateSlug(event: Event): void {
    const title = (event.currentTarget as HTMLInputElement).value;
    this.slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  }

  async addProduct(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.busy) return;
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const draft = this.buildDraft(values);
      await this.productApi.createProduct(this.username, this.password, draft);
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
      form.reset();
      this.slug = '';
      this.notice = 'Product added to the storefront.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save this product.';
    } finally {
      this.busy = false;
    }
  }

  private buildDraft(values: FormData): ProductDraft {
    const title = this.value(values, 'title');
    const imageUrl = this.value(values, 'imageUrl');
    const gallery = this.lines(values, 'gallery').map((src, index) => ({
      src,
      alt: `${title} product view ${index + 1}`,
      label: `View ${index + 1}`,
    }));
    if (!gallery.some((image) => image.src === imageUrl)) {
      gallery.unshift({ src: imageUrl, alt: title, label: 'Product' });
    }
    return {
      slug: this.slug,
      sku: this.value(values, 'sku'),
      title,
      description: this.value(values, 'description'),
      eyebrow: this.value(values, 'eyebrow'),
      image_url: imageUrl,
      currency: 'INR',
      cost_price: Number(values.get('costPrice')),
      selling_price: Number(values.get('sellingPrice')),
      mrp: Number(values.get('mrp')),
      stock_quantity: Number(values.get('stockQuantity')),
      stock_label: this.value(values, 'stockLabel'),
      gallery,
      benefits: this.lines(values, 'benefits').map((line) => {
        const [benefitTitle, ...copy] = line.split('|').map((part) => part.trim());
        return { icon: '\u2726', title: benefitTitle, copy: copy.join('|') };
      }),
      features: this.lines(values, 'features'),
      specifications: this.lines(values, 'specifications').map((line) => {
        const [label, ...value] = line.split(':').map((part) => part.trim());
        return { label, value: value.join(':') };
      }),
      package_contents: this.lines(values, 'packageContents'),
      faqs: this.lines(values, 'faqs').map((line) => {
        const [question, ...answer] = line.split('|').map((part) => part.trim());
        return { question, answer: answer.join('|') };
      }),
      is_active: values.get('isActive') === 'on',
    };
  }

  private lines(values: FormData, name: string): string[] {
    return String(values.get(name) ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  }

  private value(values: FormData, name: string): string {
    return String(values.get(name) ?? '').trim();
  }
}