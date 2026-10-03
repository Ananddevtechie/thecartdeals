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

interface ProductResponse {
  id: string;
  sku: string;
  title: string;
  category: string;
  description: string | null;
  eyebrow: string;
  image_url: string | null;
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

  async listAdminProducts(username: string, password: string): Promise<(StoreProduct & { costPrice: number; isActive: boolean })[]> {
    const response = await fetch('/api/admin/products', { headers: this.adminHeaders(username, password) });
    const result = await response.json() as ProductResponse[] | { detail?: string };
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(!Array.isArray(result) ? result.detail ?? 'Could not load products.' : 'Could not load products.');
    }
    return result.map((product) => ({
      ...this.toStoreProduct(product),
      costPrice: Number(product.cost_price ?? 0),
      isActive: product.is_active ?? false,
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

  private invalidatePublicProductCache(): void {
    this.cacheGeneration += 1;
    this.productsCache = null;
    this.productsRequest = null;
    this.productCache.clear();
    this.productRequests.clear();
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