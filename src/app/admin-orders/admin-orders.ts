import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductApiService } from '../product-details/product-api.service';
import {
  AdminOrderTracking,
  DeliveryStatus,
  DELIVERY_STAGES,
  OrderTrackingApiService,
} from '../order-tracking/order-tracking-api.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss',
})
export class AdminOrders implements OnInit {
  private readonly productApi = inject(ProductApiService);
  private readonly trackingApi = inject(OrderTrackingApiService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  private username = '';
  private password = '';
  orders: AdminOrderTracking[] = [];
  selectedOrder: AdminOrderTracking | null = null;
  selectedStatus: DeliveryStatus = 'ORDER_CONFIRMED';
  deliveryDate = '';
  loading = true;
  saving = false;
  error = '';
  notice = '';
  readonly stages = DELIVERY_STAGES;

  ngOnInit(): void {
    const credentials = this.productApi.getAdminCredentials();
    if (!credentials) {
      void this.router.navigateByUrl('/admin/products');
      return;
    }
    this.username = credentials.username;
    this.password = credentials.password;
    void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.changeDetector.markForCheck();
    try {
      this.orders = await this.trackingApi.listAdminOrders(this.username, this.password);
      if (this.selectedOrder) {
        this.selectedOrder = this.orders.find((order) => order.order_id === this.selectedOrder?.order_id) ?? null;
        if (this.selectedOrder) this.selectOrder(this.selectedOrder);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load orders.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  selectOrder(order: AdminOrderTracking): void {
    this.selectedOrder = order;
    this.selectedStatus = order.delivery_status;
    this.deliveryDate = order.estimated_delivery_date ?? '';
    this.error = '';
    this.notice = '';
  }

  setStatus(event: Event): void {
    this.selectedStatus = (event.currentTarget as HTMLSelectElement).value as DeliveryStatus;
  }

  setDeliveryDate(event: Event): void {
    this.deliveryDate = (event.currentTarget as HTMLInputElement).value;
  }

  async saveTracking(): Promise<void> {
    const order = this.selectedOrder;
    if (!order || this.saving) return;
    this.saving = true;
    this.error = '';
    this.notice = '';
    try {
      const updated = await this.trackingApi.updateAdminOrder(
        this.username,
        this.password,
        order.order_id,
        this.selectedStatus,
        this.deliveryDate || null,
      );
      this.orders = this.orders.map((entry) => entry.order_id === updated.order_id ? updated : entry);
      this.selectedOrder = updated;
      this.selectedStatus = updated.delivery_status;
      this.deliveryDate = updated.estimated_delivery_date ?? '';
      this.notice = 'Order tracking was updated.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not update order tracking.';
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  statusLabel(status: DeliveryStatus): string {
    return {
      ORDER_CONFIRMED: 'Order confirmed',
      PROCESSING: 'Processing',
      PACKED: 'Packed',
      SHIPPED: 'Shipped',
      IN_TRANSIT: 'In transit',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
    }[status];
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  formatAddress(order: AdminOrderTracking): string {
    return [order.address_line1, order.address_line2, order.landmark, order.city, order.state, order.pincode]
      .filter(Boolean).join(', ');
  }

  canUpdate(order: AdminOrderTracking): boolean {
    return order.payment_status === 'PAID' || order.payment_status === 'COD_PENDING';
  }

  paymentLabel(order: AdminOrderTracking): string {
    return order.payment_status === 'PAYMENT_PENDING'
      ? 'Payment pending'
      : order.payment_status === 'PAYMENT_FAILED'
        ? 'Payment failed'
        : this.statusLabel(order.delivery_status);
  }
}
