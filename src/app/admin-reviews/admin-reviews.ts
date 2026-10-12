import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ProductApiService,
  ProductReview,
  ProductReviewSummary,
  StoreProduct,
} from '../product-details/product-api.service';

type AdminProduct = StoreProduct & { costPrice: number; isActive: boolean; meeshoUrl: string };

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.scss',
})
export class AdminReviews implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  username = '';
  password = '';
  unlocked = false;
  busy = false;
  products: AdminProduct[] = [];
  selectedProductId = '';
  meeshoUrl = '';
  reviewSummary: ProductReviewSummary | null = null;
  reviewsLoading = false;
  error = '';
  notice = '';
  editingReviewId: string | null = null;
  editReviewerName = '';
  editRating = 5;
  editComment = '';

  get selectedProduct(): AdminProduct | undefined {
    return this.products.find((product) => product.id === this.selectedProductId);
  }

  get reviews(): ProductReview[] {
    return this.reviewSummary?.reviews ?? [];
  }

  ngOnInit(): void {
    const credentials = this.productApi.getAdminCredentials();
    if (credentials) {
      this.username = credentials.username;
      this.password = credentials.password;
      this.unlocked = true;
      void this.loadProducts();
    }
  }

  async unlock(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    this.username = String(values.get('username') ?? '').trim();
    this.password = String(values.get('password') ?? '');
    this.busy = true;
    this.error = '';
    try {
      await this.productApi.loginAdmin(this.username, this.password);
      this.unlocked = true;
      await this.loadProducts();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not verify admin access.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  private async loadProducts(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      this.products = await this.productApi.listAdminProducts(this.username, this.password);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load products.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  selectProduct(event: Event): void {
    this.selectedProductId = (event.currentTarget as HTMLSelectElement).value;
    this.reviewSummary = null;
    this.notice = '';
    this.error = '';
    this.editingReviewId = null;
    const product = this.selectedProduct;
    this.meeshoUrl = product?.meeshoUrl ?? '';
    if (product) void this.loadReviews(product.id);
  }

  private async loadReviews(productId: string): Promise<void> {
    this.reviewsLoading = true;
    this.error = '';
    try {
      this.reviewSummary = await this.productApi.listAdminProductReviews(this.username, this.password, productId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load product reviews.';
    } finally {
      this.reviewsLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  async importReviews(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const product = this.selectedProduct;
    if (!product || this.busy) return;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const result = await this.productApi.importMeeshoReviews(
        this.username,
        this.password,
        product.id,
        this.meeshoUrl.trim(),
      );
      this.reviewSummary = result.reviews;
      this.notice = `Imported ${result.imported_count} reviews and saved ${result.saved_image_count} images, including photos added to ${result.backfilled_review_count} existing reviews. Skipped ${result.skipped_count} already imported reviews and ${result.skipped_image_count} images that exceeded import limits.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not import reviews.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  editReview(review: ProductReview): void {
    this.editingReviewId = review.id;
    this.editReviewerName = review.reviewer_name;
    this.editRating = review.rating;
    this.editComment = review.comment;
    this.error = '';
  }

  cancelEdit(): void {
    this.editingReviewId = null;
  }

  async saveReview(event: SubmitEvent, review: ProductReview): Promise<void> {
    event.preventDefault();
    if (!this.selectedProduct || this.busy) return;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.productApi.updateProductReview(this.username, this.password, this.selectedProduct.id, {
        id: review.id,
        reviewer_name: this.editReviewerName.trim(),
        rating: this.editRating,
        comment: this.editComment.trim(),
      });
      this.reviewSummary = await this.productApi.listAdminProductReviews(
        this.username,
        this.password,
        this.selectedProduct.id,
      );
      this.editingReviewId = null;
      this.notice = 'Review updated.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not update review.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  async deleteReview(review: ProductReview): Promise<void> {
    if (!this.selectedProduct || this.busy) return;
    if (!window.confirm(`Delete this review by ${review.reviewer_name}?`)) return;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await this.productApi.deleteProductReview(
        this.username,
        this.password,
        this.selectedProduct.id,
        review.id,
      );
      this.reviewSummary = await this.productApi.listAdminProductReviews(
        this.username,
        this.password,
        this.selectedProduct.id,
      );
      this.notice = 'Review deleted.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not delete review.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  formatReviewDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }
}
