import { Injectable, computed, signal } from '@angular/core';
import { StoreProduct } from '../product-details/product-api.service';

export interface ShoppingCartItem {
  productId: string;
  title: string;
  imageUrl: string;
  currency: string;
  price: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class ShoppingCartService {
  private readonly storageKey = 'thecart-shopping-cart';
  readonly items = signal<ShoppingCartItem[]>([]);
  readonly itemCount = computed(() => this.items().reduce((count, item) => count + item.quantity, 0));
  readonly storageError = signal('');

  constructor() {
    this.items.set(this.readItems());
  }

  add(product: StoreProduct): void {
    const existing = this.items().find((item) => item.productId === product.id);
    const nextItems = existing
      ? this.items().map((item) => item.productId === product.id
        ? { ...item, quantity: Math.min(10, item.quantity + 1) }
        : item)
      : [...this.items(), {
        productId: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        currency: product.currency,
        price: product.price,
        quantity: 1,
      }];
    this.save(nextItems);
  }

  setQuantity(productId: string, quantity: number): void {
    const boundedQuantity = Math.max(1, Math.min(10, Math.trunc(quantity)));
    this.save(this.items().map((item) => item.productId === productId
      ? { ...item, quantity: boundedQuantity }
      : item));
  }

  remove(productId: string): void {
    this.save(this.items().filter((item) => item.productId !== productId));
  }

  private readItems(): ShoppingCartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(this.storageKey);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        this.storageError.set('Saved cart data is invalid and could not be restored.');
        return [];
      }
      const validItems = parsed.filter((item): item is ShoppingCartItem =>
        typeof item === 'object'
        && item !== null
        && 'productId' in item && typeof item.productId === 'string'
        && 'title' in item && typeof item.title === 'string'
        && 'imageUrl' in item && typeof item.imageUrl === 'string'
        && 'currency' in item && typeof item.currency === 'string'
        && 'price' in item && typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
        && 'quantity' in item && typeof item.quantity === 'number'
        && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10,
      );
      if (validItems.length !== parsed.length) {
        this.storageError.set('Some saved cart items were invalid and could not be restored.');
      }
      return validItems;
    } catch {
      this.storageError.set('Saved cart items could not be read from this browser.');
      return [];
    }
  }

  private save(items: ShoppingCartItem[]): void {
    this.items.set(items);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(items));
      this.storageError.set('');
    } catch {
      this.storageError.set('Cart changed for this visit, but could not be saved in this browser.');
    }
  }
}
