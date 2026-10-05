import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderTracking, OrderTrackingApiService } from './order-tracking-api.service';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.scss',
})
export class OrderTrackingPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trackingApi = inject(OrderTrackingApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly stages = [
    'ORDER_CONFIRMED',
    'PROCESSING',
    'PACKED',
    'SHIPPED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ] as const;
  tracking: OrderTracking | null = null;
  loading = true;
  error = '';
  orderIdInput = '';
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (orderId) {
      this.orderIdInput = orderId;
      void this.loadTracking();
    } else {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  async loadTracking(): Promise<void> {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.loading = true;
    this.error = '';
    try {
      const orderId = this.route.snapshot.paramMap.get('orderId');
      if (!orderId) throw new Error('Order reference is missing.');
      this.tracking = await this.trackingApi.getTracking(orderId);
      this.refreshTimer = setTimeout(() => { void this.loadTracking(); }, 30_000);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load tracking details.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  setOrderId(event: Event): void {
    this.orderIdInput = (event.currentTarget as HTMLInputElement).value;
    this.error = '';
  }

  findOrder(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const orderId = String(new FormData(form).get('orderId') ?? '').trim();
    if (!orderId) {
      this.error = 'Enter your order ID to see tracking.';
      return;
    }
    this.orderIdInput = orderId;
    this.error = '';
    void this.router.navigateByUrl(`/track-order/${encodeURIComponent(orderId)}`);
  }

  statusLabel(status: string): string {
    return {
      ORDER_CONFIRMED: 'Order confirmed',
      PROCESSING: 'Preparing your order',
      PACKED: 'Packed and ready',
      SHIPPED: 'Shipped',
      IN_TRANSIT: 'On the way',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Order cancelled',
    }[status] ?? status;
  }

  stageComplete(index: number): boolean {
    if (!this.tracking || this.tracking.delivery_status === 'CANCELLED') return false;
    return this.stages.indexOf(this.tracking.delivery_status as typeof this.stages[number]) > index;
  }

  stageCurrent(index: number): boolean {
    return this.tracking?.delivery_status === this.stages[index];
  }

  stageDate(status: string): string | null {
    const event = [...(this.tracking?.tracking_events ?? [])].reverse().find((entry) => entry.status === status);
    return event ? this.formatDate(event.created_at) : null;
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  }

  get formattedTotal(): string {
    return Number(this.tracking?.total ?? 0).toFixed(2);
  }
}
