import { Injectable } from '@angular/core';

export interface StoreProduct {
  id: string;
  sku: string;
  title: string;
  category: string;
  description: string;
  eyebrow: string;
  imageUrl: string;
  currency: string;
  price: number;
  mrp: number;
  stockQuantity: number;
  stockLabel: string;
  gallery: { src: string; alt: string; label: string }[];
  benefits: { icon: string; title: string; copy: string }[];
  features: string[];
  specifications: { label: string; value: string }[];
  packageContents: string[];
  faqs: { question: string; answer: string }[];
}

export interface ProductDraft {
  slug: string;
  sku: string;
  title: string;
  category: string;
  description: string;
  eyebrow: string;
  image_url: string;
  meesho_url: string | null;
  currency: 'INR';
  cost_price: number;
  selling_price: number;
  mrp: number;
  stock_quantity: number;
  stock_label: string;
  gallery: { src: string; alt: string; label: string }[];
  benefits: { icon: string; title: string; copy: string }[];
  features: string[];
  specifications: { label: string; value: string }[];
  package_contents: string[];
  faqs: { question: string; answer: string }[];
  is_active: boolean;
}

export interface ProductReview {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  image_urls: string[];
}

export interface ProductReviewSummary {
  average_rating: number;
  review_count: number;
  reviews: ProductReview[];
}

export function displayReviewerName(name: string): string {
  return /meesho/i.test(name) ? ' ' : name;
}

export interface ProductReviewImportResult {
  imported_count: number;
  skipped_count: number;
  backfilled_review_count: number;
  saved_image_count: number;
  skipped_image_count: number;
  reviews: ProductReviewSummary;
}

interface ProductResponse {
  id: string;
  sku: string;
  title: string;
  category: string;
  description: string | null;
  eyebrow: string;
  image_url: string | null;
  meesho_url?: string | null;
  currency: string;
  selling_price: number | string;
  mrp: number | string;
  stock_quantity: number;
  stock_label: string;
  gallery: StoreProduct['gallery'];
  benefits: StoreProduct['benefits'];
  features: string[];
  specifications: StoreProduct['specifications'];
  package_contents: string[];
  faqs: StoreProduct['faqs'];
  cost_price?: number | string;
  is_active?: boolean;
}

interface AdminLoginResponse {
  authenticated?: boolean;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly publicCacheTtlMs = 60_000;
  private productsCache: { expiresAt: number; products: StoreProduct[] } | null = null;
  private productsRequest: Promise<StoreProduct[]> | null = null;
  private readonly productCache = new Map<string, { expiresAt: number; product: StoreProduct }>();
  private readonly productRequests = new Map<string, Promise<StoreProduct>>();
  private readonly productReviewsCache = new Map<string, { expiresAt: number; summary: ProductReviewSummary }>();
  private readonly productReviewsRequests = new Map<string, Promise<ProductReviewSummary>>();
  private cacheGeneration = 0;
  private adminCredentials: { username: string; password: string } | null = null;

  async listProducts(): Promise<StoreProduct[]> {
    if (this.productsCache && this.productsCache.expiresAt > Date.now()) return this.productsCache.products;
    if (this.productsRequest) return this.productsRequest;

    const generation = this.cacheGeneration;
    const request = (async () => {
      const response = await fetch('/api/products');
      const result = await response.json() as ProductResponse[] | { detail?: string };
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(!Array.isArray(result) ? result.detail ?? 'Could not load products.' : 'Could not load products.');
      }
      const products = result.map((product) => this.toStoreProduct(product));
      if (generation === this.cacheGeneration) {
        const expiresAt = Date.now() + this.publicCacheTtlMs;
        this.productsCache = { expiresAt, products };
        for (const product of products) this.productCache.set(product.id, { expiresAt, product });
      }
      return products;
    })();
    this.productsRequest = request;
    try {
      return await request;
    } finally {
      if (this.productsRequest === request) this.productsRequest = null;
    }
  }

  async getProduct(slug: string): Promise<StoreProduct> {
    const cached = this.productCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.product;
    const pendingRequest = this.productRequests.get(slug);
    if (pendingRequest) return pendingRequest;

    const generation = this.cacheGeneration;
    const request = (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}`);
      const result = await response.json() as ProductResponse | { detail?: string };
      if (!response.ok || !('id' in result)) {
        throw new Error('detail' in result ? result.detail ?? 'Could not load this product.' : 'Could not load this product.');
      }
      const product = this.toStoreProduct(result);
      if (generation === this.cacheGeneration) {
        this.productCache.set(slug, { expiresAt: Date.now() + this.publicCacheTtlMs, product });
      }
      return product;
    })();
    this.productRequests.set(slug, request);
    try {
      return await request;
    } finally {
      if (this.productRequests.get(slug) === request) this.productRequests.delete(slug);
    }
  }

  async getProductReviews(slug: string): Promise<ProductReviewSummary> {
    const cached = this.productReviewsCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.summary;

    const pendingRequest = this.productReviewsRequests.get(slug);
    if (pendingRequest) return pendingRequest;

    const request = (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`);
      const result = await response.json() as ProductReviewSummary | { detail?: string };
      if (!response.ok || !('reviews' in result)) {
        throw new Error('detail' in result ? result.detail ?? 'Could not load reviews.' : 'Could not load reviews.');
      }
      this.productReviewsCache.set(slug, {
        expiresAt: Date.now() + this.publicCacheTtlMs,
        summary: result,
      });
      return result;
    })();
    this.productReviewsRequests.set(slug, request);
    try {
      return await request;
    } finally {
      if (this.productReviewsRequests.get(slug) === request) this.productReviewsRequests.delete(slug);
    }
  }

  async listAdminProductReviews(username: string, password: string, slug: string): Promise<ProductReviewSummary> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/reviews`, {
      headers: this.adminHeaders(username, password),
    });
    const result = await response.json() as ProductReviewSummary | { detail?: string };
    if (!response.ok || !('reviews' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not load reviews.' : 'Could not load reviews.');
    }
    return result;
  }

  async importMeeshoReviews(
    username: string,
    password: string,
    slug: string,
    meeshoUrl: string,
  ): Promise<ProductReviewImportResult> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/reviews/import`, {
      method: 'POST',
      headers: { ...this.adminHeaders(username, password), 'Content-Type': 'application/json' },
      body: JSON.stringify({ meesho_url: meeshoUrl }),
    });
    const result = await response.json() as ProductReviewImportResult | { detail?: string };
    if (!response.ok || !('reviews' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not import reviews.' : 'Could not import reviews.');
    }
    this.invalidateProductReviews(slug);
    return result;
  }

  async updateProductReview(
    username: string,
    password: string,
    slug: string,
    review: Pick<ProductReview, 'id' | 'reviewer_name' | 'rating' | 'comment'>,
  ): Promise<ProductReview> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(review.id)}`, {
      method: 'PUT',
      headers: { ...this.adminHeaders(username, password), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewer_name: review.reviewer_name,
        rating: review.rating,
        comment: review.comment,
      }),
    });
    const result = await response.json() as ProductReview | { detail?: string };
    if (!response.ok || !('rating' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not update review.' : 'Could not update review.');
    }
    this.invalidateProductReviews(slug);
    return result;
  }

  async deleteProductReview(username: string, password: string, slug: string, reviewId: string): Promise<void> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(username, password),
    });
    if (!response.ok) {
      const result = await response.json() as { detail?: string };
      throw new Error(result.detail ?? 'Could not delete review.');
    }
    this.invalidateProductReviews(slug);
  }

  async createProductReview(
    username: string,
    password: string,
    slug: string,
    rating: number,
    reviewerName: string,
    comment: string,
    images: File[],
  ): Promise<ProductReview> {
    const form = new FormData();
    form.set('rating', String(rating));
    form.set('reviewer_name', reviewerName);
    form.set('comment', comment);
    for (const image of images) form.append('images', image, image.name);
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/reviews`, {
      method: 'POST',
      headers: this.adminHeaders(username, password),
      body: form,
    });
    const result = await response.json() as ProductReview | { detail?: string };
    if (!response.ok || !('rating' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not save this review.' : 'Could not save this review.');
    }
    this.invalidateProductReviews(slug);
    return result;
  }

  async listAdminProducts(username: string, password: string): Promise<(StoreProduct & { costPrice: number; isActive: boolean; meeshoUrl: string })[]> {
    const response = await fetch('/api/admin/products', { headers: this.adminHeaders(username, password) });
    const result = await response.json() as ProductResponse[] | { detail?: string };
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(!Array.isArray(result) ? result.detail ?? 'Could not load products.' : 'Could not load products.');
    }
    return result.map((product) => ({
      ...this.toStoreProduct(product),
      costPrice: Number(product.cost_price ?? 0),
      isActive: product.is_active ?? false,
      meeshoUrl: product.meesho_url ?? '',
    }));
  }

  async loginAdmin(username: string, password: string): Promise<void> {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json() as AdminLoginResponse;
    if (!response.ok || result.authenticated !== true) {
      this.adminCredentials = null;
      throw new Error(result.detail ?? 'Admin username or password is incorrect.');
    }
    this.adminCredentials = { username, password };
  }

  getAdminCredentials(): { username: string; password: string } | null {
    return this.adminCredentials;
  }

  async createProduct(username: string, password: string, draft: ProductDraft): Promise<StoreProduct> {
    const response = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { ...this.adminHeaders(username, password), 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const result = await response.json() as ProductResponse | { detail?: string };
    if (!response.ok || !('id' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not save this product.' : 'Could not save this product.');
    }
    this.invalidatePublicProductCache();
    return this.toStoreProduct(result);
  }

  async updateProduct(username: string, password: string, slug: string, draft: ProductDraft): Promise<StoreProduct> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { ...this.adminHeaders(username, password), 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const result = await response.json() as ProductResponse | { detail?: string };
    if (!response.ok || !('id' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not update this product.' : 'Could not update this product.');
    }
    this.invalidatePublicProductCache();
    return this.toStoreProduct(result);
  }

  async saveProductWithImages(
    username: string,
    password: string,
    draft: ProductDraft,
    mainImage: File | null,
    additionalImages: File[],
  ): Promise<StoreProduct> {
    const form = new FormData();
    form.set('product_data', JSON.stringify(draft));
    if (mainImage) form.set('main_image', mainImage, mainImage.name);
    for (const image of additionalImages) form.append('additional_images', image, image.name);

    const response = await fetch('/api/admin/products/save', {
      method: 'POST',
      headers: this.adminHeaders(username, password),
      body: form,
    });
    const result = await response.json() as ProductResponse | { detail?: string };
    if (!response.ok || !('id' in result)) {
      throw new Error('detail' in result ? result.detail ?? 'Could not save this product.' : 'Could not save this product.');
    }
    this.invalidatePublicProductCache();
    return this.toStoreProduct(result);
  }

  async deleteProduct(username: string, password: string, slug: string): Promise<void> {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(username, password),
    });
    if (!response.ok) {
      const result = await response.json() as { detail?: string };
      throw new Error(result.detail ?? 'Could not delete this product.');
    }
    this.invalidatePublicProductCache();
  }

  private invalidatePublicProductCache(): void {
    this.cacheGeneration += 1;
    this.productsCache = null;
    this.productsRequest = null;
    this.productCache.clear();
    this.productRequests.clear();
  }

  private invalidateProductReviews(slug: string): void {
    this.productReviewsCache.delete(slug);
    this.productReviewsRequests.delete(slug);
  }

  private adminHeaders(username: string, password: string): HeadersInit {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }

  private toStoreProduct(product: ProductResponse): StoreProduct {
    return {
      id: product.id,
      sku: product.sku,
      title: product.title,
      category: product.category,
      description: product.description ?? '',
      eyebrow: product.eyebrow,
      imageUrl: product.image_url ?? '',
      currency: product.currency === 'INR' ? '\u20b9' : product.currency,
      price: Number(product.selling_price),
      mrp: Number(product.mrp),
      stockQuantity: product.stock_quantity,
      stockLabel: product.stock_label,
      gallery: product.gallery,
      benefits: product.benefits,
      features: product.features,
      specifications: product.specifications,
      packageContents: product.package_contents,
      faqs: product.faqs,
    };
  }
}