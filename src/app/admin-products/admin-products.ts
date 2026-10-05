import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductApiService, ProductDraft, ProductReviewSummary, StoreProduct } from '../product-details/product-api.service';

type AdminProduct = StoreProduct & { costPrice: number; isActive: boolean; meeshoUrl: string };

interface ProductEditorValues {
  title: string;
  category: string;
  sku: string;
  description: string;
  eyebrow: string;
  imageUrl: string;
  meeshoUrl: string;
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
  readonly productsPerPage = 10;
  productsPage = 1;
  productsLoading = false;
  deletingProductId: string | null = null;
  error = '';
  notice = '';
  busy = false;
  unlocked = false;
  slug = '';
  editingProduct: AdminProduct | null = null;
  editValues: ProductEditorValues | null = null;
  reviewProduct: AdminProduct | null = null;
  reviewSummary: ProductReviewSummary | null = null;
  reviewName = 'Verified customer';
  reviewRating = 5;
  reviewComment = '';
  reviewImages: File[] = [];
  mainImageFile: File | null = null;
  additionalImageFiles: File[] = [];
  reviewBusy = false;
  reviewError = '';
  readonly reviewRatings = [1, 2, 3, 4, 5];

  get totalProductPages(): number {
    return Math.max(1, Math.ceil(this.products.length / this.productsPerPage));
  }

  get paginatedProducts(): AdminProduct[] {
    const start = (this.productsPage - 1) * this.productsPerPage;
    return this.products.slice(start, start + this.productsPerPage);
  }

  get firstProductNumber(): number {
    return this.products.length ? (this.productsPage - 1) * this.productsPerPage + 1 : 0;
  }

  get lastProductNumber(): number {
    return Math.min(this.productsPage * this.productsPerPage, this.products.length);
  }

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
      this.productsPage = Math.min(this.productsPage, this.totalProductPages);
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
    this.mainImageFile = null;
    this.additionalImageFiles = [];
    this.slug = product.id;
    this.editValues = {
      title: product.title,
      category: product.category,
      sku: product.sku,
      description: product.description,
      eyebrow: product.eyebrow,
      imageUrl: product.imageUrl,
      meeshoUrl: product.meeshoUrl,
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
    this.mainImageFile = null;
    this.additionalImageFiles = [];
    this.error = '';
    this.notice = '';
  }

  previousProductPage(): void {
    this.productsPage = Math.max(1, this.productsPage - 1);
  }

  nextProductPage(): void {
    this.productsPage = Math.min(this.totalProductPages, this.productsPage + 1);
  }

  selectMainImage(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    if (!this.isValidProductImage(file)) {
      this.mainImageFile = null;
      this.error = 'Choose a JPEG, PNG, or WebP image up to 5 MB.';
      input.value = '';
      return;
    }
    this.mainImageFile = file;
    this.error = '';
  }

  clearMainImage(input: HTMLInputElement): void {
    this.mainImageFile = null;
    input.value = '';
  }

  selectAdditionalImages(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (this.additionalImageFiles.length + files.length > 10) {
      this.error = 'Upload no more than ten additional images.';
      input.value = '';
      return;
    }
    const invalidFile = files.find((file) => !this.isValidProductImage(file));
    if (invalidFile) {
      this.error = 'Choose JPEG, PNG, or WebP images up to 5 MB each.';
      input.value = '';
      return;
    }
    this.additionalImageFiles = [...this.additionalImageFiles, ...files];
    this.error = '';
    input.value = '';
  }

  removeAdditionalImage(index: number): void {
    this.additionalImageFiles = this.additionalImageFiles.filter((_, fileIndex) => fileIndex !== index);
  }

  async openProductReviews(product: AdminProduct): Promise<void> {
    this.reviewProduct = product;
    this.reviewSummary = null;
    this.reviewName = 'Verified customer';
    this.reviewRating = 5;
    this.reviewComment = '';
    this.reviewImages = [];
    this.reviewError = '';
    this.reviewBusy = true;
    try {
      this.reviewSummary = await this.productApi.listAdminProductReviews(this.username, this.password, product.id);
    } catch (error) {
      this.reviewError = error instanceof Error ? error.message : 'Could not load reviews.';
    } finally {
      this.reviewBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  closeProductReviews(): void {
    if (this.reviewBusy) return;
    this.reviewProduct = null;
    this.reviewSummary = null;
    this.reviewError = '';
  }

  setReviewRating(rating: number): void {
    this.reviewRating = rating;
  }

  selectReviewImages(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length + this.reviewImages.length > 5) {
      this.reviewError = 'Upload up to five images per review.';
      input.value = '';
      return;
    }
    const invalidFile = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalidFile) {
      this.reviewError = 'Choose JPEG, PNG, or WebP images up to 5 MB each.';
      input.value = '';
      return;
    }
    this.reviewImages = [...this.reviewImages, ...files];
    this.reviewError = '';
    input.value = '';
  }

  removeReviewImage(index: number): void {
    this.reviewImages = this.reviewImages.filter((_, imageIndex) => imageIndex !== index);
  }

  formatReviewDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  async saveProductReview(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!this.reviewProduct || this.reviewBusy) return;
    this.reviewBusy = true;
    this.reviewError = '';
    try {
      await this.productApi.createProductReview(
        this.username,
        this.password,
        this.reviewProduct.id,
        this.reviewRating,
        this.reviewName.trim(),
        this.reviewComment.trim(),
        this.reviewImages,
      );
      this.reviewSummary = await this.productApi.listAdminProductReviews(this.username, this.password, this.reviewProduct.id);
      this.reviewComment = '';
      this.reviewImages = [];
      this.reviewRating = 5;
      this.notice = 'Review added to the product page.';
    } catch (error) {
      this.reviewError = error instanceof Error ? error.message : 'Could not save this review.';
    } finally {
      this.reviewBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  async deleteProduct(product: AdminProduct): Promise<void> {
    if (this.busy || this.deletingProductId !== null) return;
    if (!window.confirm(`Delete "${product.title}" permanently from the catalog?`)) return;

    this.deletingProductId = product.id;
    this.error = '';
    this.notice = '';
    try {
      await this.productApi.deleteProduct(this.username, this.password, product.id);
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
      this.productsPage = Math.min(this.productsPage, this.totalProductPages);
      if (this.editingProduct?.id === product.id) this.cancelEdit();
      this.notice = `${product.title} was deleted from the catalog.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not delete this product.';
    } finally {
      this.deletingProductId = null;
      this.changeDetector.markForCheck();
    }
  }

  async addProduct(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.busy || this.deletingProductId !== null) return;
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const mainImageFile = values.get('mainImage') instanceof File && (values.get('mainImage') as File).size > 0
        ? values.get('mainImage') as File
        : this.mainImageFile;
      if (!this.value(values, 'imageUrl') && !mainImageFile) {
        this.error = 'Enter a main image URL or choose an image file.';
        return;
      }
      const draft = this.buildDraft(values);
      await this.productApi.saveProductWithImages(
        this.username,
        this.password,
        draft,
        mainImageFile,
        this.additionalImageFiles,
      );
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
      const wasEditing = this.editingProduct !== null;
      if (!wasEditing) this.productsPage = 1;
      else this.productsPage = Math.min(this.productsPage, this.totalProductPages);
      this.editingProduct = null;
      this.editValues = null;
      form.reset();
      this.slug = '';
      this.mainImageFile = null;
      this.additionalImageFiles = [];
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
    if (imageUrl && !gallery.some((image) => image.src === imageUrl)) {
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
      meesho_url: this.value(values, 'meeshoUrl') || null,
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

  private isValidProductImage(file: File): boolean {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024;
  }
}