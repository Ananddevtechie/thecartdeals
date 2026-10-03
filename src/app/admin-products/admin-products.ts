import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductApiService, ProductDraft, StoreProduct } from '../product-details/product-api.service';

type AdminProduct = StoreProduct & { costPrice: number; isActive: boolean };

interface ProductEditorValues {
  title: string;
  category: string;
  sku: string;
  description: string;
  eyebrow: string;
  imageUrl: string;
  gallery: string;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  stockQuantity: number;
  stockLabel: string;
  benefits: string;
  features: string;
  specifications: string;
  packageContents: string;
  faqs: string;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  username = '';
  password = '';
  products: AdminProduct[] = [];
  productsLoading = false;
  error = '';
  notice = '';
  busy = false;
  unlocked = false;
  slug = '';
  editingProduct: AdminProduct | null = null;
  editValues: ProductEditorValues | null = null;

  ngOnInit(): void {
    if (this.route.snapshot.routeConfig?.path !== 'admin/products/add') return;
    const credentials = this.productApi.getAdminCredentials();
    if (!credentials) {
      void this.router.navigateByUrl('/admin/products');
      return;
    }
    this.username = credentials.username;
    this.password = credentials.password;
    this.unlocked = true;
    void this.loadProducts();
  }

  async unlock(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const username = String(values.get('adminUsername') ?? '').trim();
    const password = String(values.get('adminPassword') ?? '');
    this.busy = true;
    this.error = '';
    try {
      await this.productApi.loginAdmin(username, password);
      await this.router.navigateByUrl('/admin/products/add');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not verify admin access.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  private async loadProducts(): Promise<void> {
    this.productsLoading = true;
    this.changeDetector.markForCheck();
    try {
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load the product catalog.';
    } finally {
      this.productsLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  updateSlug(event: Event): void {
    if (this.editingProduct) return;
    const title = (event.currentTarget as HTMLInputElement).value;
    this.slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  }

  editProduct(product: AdminProduct): void {
    this.editingProduct = product;
    this.slug = product.id;
    this.editValues = {
      title: product.title,
      category: product.category,
      sku: product.sku,
      description: product.description,
      eyebrow: product.eyebrow,
      imageUrl: product.imageUrl,
      gallery: product.gallery.filter((image) => image.src !== product.imageUrl).map((image) => image.src).join('\n'),
      costPrice: product.costPrice,
      sellingPrice: product.price,
      mrp: product.mrp,
      stockQuantity: product.stockQuantity,
      stockLabel: product.stockLabel,
      benefits: product.benefits.map((benefit) => `${benefit.title} | ${benefit.copy}`).join('\n'),
      features: product.features.join('\n'),
      specifications: product.specifications.map((spec) => `${spec.label}: ${spec.value}`).join('\n'),
      packageContents: product.packageContents.join('\n'),
      faqs: product.faqs.map((faq) => `${faq.question} | ${faq.answer}`).join('\n'),
      isActive: product.isActive,
    };
    this.error = '';
    this.notice = '';
  }

  cancelEdit(): void {
    this.editingProduct = null;
    this.editValues = null;
    this.slug = '';
    this.error = '';
    this.notice = '';
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
      if (this.editingProduct) {
        await this.productApi.updateProduct(this.username, this.password, this.editingProduct.id, draft);
      } else {
        await this.productApi.createProduct(this.username, this.password, draft);
      }
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
      const wasEditing = this.editingProduct !== null;
      this.editingProduct = null;
      this.editValues = null;
      form.reset();
      this.slug = '';
      this.notice = wasEditing ? 'Product updated.' : 'Product added to the storefront.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save this product.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
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
      slug: this.editingProduct?.id ?? this.slug,
      sku: this.value(values, 'sku'),
      title,
      category: this.value(values, 'category'),
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