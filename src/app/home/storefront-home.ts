import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductApiService, StoreProduct } from '../product-details/product-api.service';

@Component({
  selector: 'app-storefront-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './storefront-home.html',
  styleUrl: './storefront-home.scss',
})
export class StorefrontHome implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  products: StoreProduct[] = [];
  loading = true;
  loadError = '';
  filtersOpen = false;
  searchTerm = '';
  selectedCategory = 'All';
  minimumPrice = '';
  maximumPrice = '';
  sortOrder = 'featured';

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) void this.loadProducts();
  }

  get categories(): string[] {
    return ['All', ...new Set(this.products.map((product) => product.category.trim()).filter(Boolean).sort())];
  }

  get filteredProducts(): StoreProduct[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    const minimum = this.minimumPrice === '' ? null : Number(this.minimumPrice);
    const maximum = this.maximumPrice === '' ? null : Number(this.maximumPrice);
    const filtered = this.products.filter((product) => {
      const matchesCategory = this.selectedCategory === 'All' || product.category === this.selectedCategory;
      const matchesQuery = !query || `${product.title} ${product.description} ${product.category}`.toLocaleLowerCase().includes(query);
      const matchesMinimum = minimum === null || product.price >= minimum;
      const matchesMaximum = maximum === null || product.price <= maximum;
      return matchesCategory && matchesQuery && matchesMinimum && matchesMaximum;
    });

    if (this.sortOrder === 'price-ascending') return filtered.sort((a, b) => a.price - b.price);
    if (this.sortOrder === 'price-descending') return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }

  setSearch(event: Event): void {
    this.searchTerm = (event.currentTarget as HTMLInputElement).value;
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  setMinimumPrice(event: Event): void {
    this.minimumPrice = (event.currentTarget as HTMLInputElement).value;
  }

  setMaximumPrice(event: Event): void {
    this.maximumPrice = (event.currentTarget as HTMLInputElement).value;
  }

  setCategory(category: string): void {
    this.selectedCategory = category;
  }

  setSortOrder(event: Event): void {
    this.sortOrder = (event.currentTarget as HTMLSelectElement).value;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'All';
    this.minimumPrice = '';
    this.maximumPrice = '';
    this.sortOrder = 'featured';
  }

  savingsPercent(product: StoreProduct): number {
    return product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;
  }

  retryLoad(): void {
    void this.loadProducts();
  }

  private async loadProducts(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.products = await this.productApi.listProducts();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Could not load products.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }
}