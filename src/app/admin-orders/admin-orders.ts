import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductApiService } from '../product-details/product-api.service';
import {
  AdminOrderTracking,
  DELIVERY_STAGES,
  DeliveryStatus,
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
  loading = true;
  error = '';
  updateNotice = '';
  savingUpdates = false;
  deliveryStatusDraft: DeliveryStatus = 'ORDER_CONFIRMED';
  estimatedDeliveryDateDraft = '';
  meeshoUrlDraft = '';
  readonly deliveryStages = DELIVERY_STAGES;
  readonly copyNotice = signal('');

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
    this.error = '';
    this.updateNotice = '';
    this.deliveryStatusDraft = order.delivery_status;
    this.estimatedDeliveryDateDraft = order.estimated_delivery_date ?? '';
    this.meeshoUrlDraft = order.meesho_url ?? '';
  }

  deliveryStatusLabel(status: DeliveryStatus): string {
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

  onDeliveryStatusChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    const status = this.deliveryStages.find((stage) => stage === value);
    if (status) this.deliveryStatusDraft = status;
  }

  onDeliveryDateChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.estimatedDeliveryDateDraft = event.target.value;
  }

  onMeeshoUrlChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.meeshoUrlDraft = event.target.value;
  }

  whatsappUrl(order: AdminOrderTracking): string {
    const phone = order.customer_mobile.replace(/\D/g, '');
    return `https://wa.me/91${phone}`;
  }

  canUpdateDelivery(order: AdminOrderTracking): boolean {
    return order.delivery_status !== 'CANCELLED'
      && (order.payment_status === 'PAID'
        || order.payment_status === 'COD_PENDING');
  }

  async saveOrderUpdates(): Promise<void> {
    if (!this.selectedOrder || this.savingUpdates) return;

    this.savingUpdates = true;
    this.error = '';
    this.updateNotice = '';
    try {
      const updatedOrder = await this.trackingApi.updateAdminOrder(
        this.username,
        this.password,
        this.selectedOrder.order_id,
        this.deliveryStatusDraft,
        this.estimatedDeliveryDateDraft || null,
        this.meeshoUrlDraft.trim() || null,
      );
      this.selectedOrder = updatedOrder;
      this.orders = this.orders.map((order) => order.order_id === updatedOrder.order_id ? updatedOrder : order);
      this.deliveryStatusDraft = updatedOrder.delivery_status;
      this.estimatedDeliveryDateDraft = updatedOrder.estimated_delivery_date ?? '';
      this.meeshoUrlDraft = updatedOrder.meesho_url ?? '';
      this.updateNotice = 'Delivery details saved.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save delivery details.';
    } finally {
      this.savingUpdates = false;
      this.changeDetector.markForCheck();
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(new Date(value)) + ' UTC';
  }

  formatMoney(value: number | string): string {
    return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async copyField(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copyNotice.set(`${label} copied.`);
    } catch {
      this.copyNotice.set(`Could not copy ${label.toLocaleLowerCase()}. Check clipboard permissions and try again.`);
    }
  }

  isPaymentPending(order: AdminOrderTracking): boolean {
    return order.payment_status === 'PAYMENT_PENDING' || order.payment_status === 'COD_PENDING';
  }

  paymentLabel(order: AdminOrderTracking): string {
    return order.delivery_status === 'CANCELLED'
      ? 'Cancelled'
      : order.payment_status === 'PAYMENT_PENDING'
      ? 'Payment pending'
      : order.payment_status === 'PAYMENT_FAILED'
        ? 'Payment failed'
        : order.payment_status === 'COD_PENDING'
          ? 'COD · Pending'
          : order.payment_status === 'PAID'
            ? 'Paid'
            : 'Cancelled';
  }
}
