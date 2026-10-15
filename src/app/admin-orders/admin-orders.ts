import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { jsPDF } from 'jspdf';
import { ProductApiService } from '../product-details/product-api.service';
import {
  AdminOrderTracking,
  DELIVERY_STAGES,
  DeliveryStatus,
  OrderTrackingApiService,
} from '../order-tracking/order-tracking-api.service';

type OrderPaymentFilter = 'ALL' | 'COD' | 'PAID' | 'CANCELLED';

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
  expectedDeliveryDateFilter = '';
  paymentFilter: OrderPaymentFilter = 'ALL';
  loading = true;
  error = '';
  updateNotice = '';
  savingUpdates = false;
  downloadingPdf = false;
  deliveryStatusDraft: DeliveryStatus = 'ORDER_CONFIRMED';
  estimatedDeliveryDateDraft = '';
  readonly deliveryStages = DELIVERY_STAGES;
  readonly copyNotice = signal('');

  get filteredOrders(): AdminOrderTracking[] {
    return this.orders.filter((order) => {
      const matchesDate = !this.expectedDeliveryDateFilter
        || order.estimated_delivery_date === this.expectedDeliveryDateFilter;
      const matchesPayment = this.paymentFilter === 'ALL'
        || (this.paymentFilter === 'COD'
          && order.payment_method === 'COD'
          && this.paymentTone(order) !== 'cancelled')
        || (this.paymentFilter === 'PAID' && this.paymentTone(order) === 'paid')
        || (this.paymentFilter === 'CANCELLED' && this.paymentTone(order) === 'cancelled');
      return matchesDate && matchesPayment;
    });
  }

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

  onExpectedDeliveryFilterChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.expectedDeliveryDateFilter = event.target.value;
  }

  onPaymentFilterChange(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const value = event.target.value;
    if (value === 'ALL' || value === 'COD' || value === 'PAID' || value === 'CANCELLED') {
      this.paymentFilter = value;
    }
  }

  clearOrderFilters(): void {
    this.expectedDeliveryDateFilter = '';
    this.paymentFilter = 'ALL';
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
      );
      this.selectedOrder = updatedOrder;
      this.orders = this.orders.map((order) => order.order_id === updatedOrder.order_id ? updatedOrder : order);
      this.deliveryStatusDraft = updatedOrder.delivery_status;
      this.estimatedDeliveryDateDraft = updatedOrder.estimated_delivery_date ?? '';
      this.updateNotice = 'Delivery details saved.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save delivery details.';
    } finally {
      this.savingUpdates = false;
      this.changeDetector.markForCheck();
    }
  }

  async downloadOrderPdf(order: AdminOrderTracking): Promise<void> {
    if (this.downloadingPdf) return;

    this.downloadingPdf = true;
    this.error = '';
    this.changeDetector.markForCheck();

    try {
      const { jsPDF: PdfDocument } = await import('jspdf');
      const pdf = new PdfDocument({ unit: 'mm', format: 'a4' });
      const logo = await this.loadBrandLogo();
      this.renderOrderPdf(pdf, order, logo);
      const safeOrderId = order.order_id.replace(/[^a-zA-Z0-9_-]/g, '-');
      pdf.save(`TheCart-order-${safeOrderId}.pdf`);
    } catch (error) {
      this.error = error instanceof Error
        ? `Could not download the order PDF: ${error.message}`
        : 'Could not download the order PDF. Please try again.';
    } finally {
      this.downloadingPdf = false;
      this.changeDetector.markForCheck();
    }
  }

  private async loadBrandLogo(): Promise<string> {
    const response = await fetch('/app-icon-display.png');
    if (!response.ok) throw new Error('TheCart logo could not be loaded.');

    const logoBlob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('TheCart logo could not be read.'));
      };
      reader.onerror = () => reject(new Error('TheCart logo could not be read.'));
      reader.readAsDataURL(logoBlob);
    });
  }

  private renderOrderPdf(pdf: jsPDF, order: AdminOrderTracking, logo: string): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const forest: [number, number, number] = [18, 61, 50];
    const sage: [number, number, number] = [231, 239, 234];
    const gold: [number, number, number] = [198, 166, 107];
    const ivory: [number, number, number] = [250, 249, 246];
    const white: [number, number, number] = [255, 255, 255];
    const charcoal: [number, number, number] = [37, 43, 40];
    const muted: [number, number, number] = [115, 123, 118];
    const border: [number, number, number] = [229, 232, 229];
    const margin = 16;
    const gap = 8;
    const contentWidth = pageWidth - margin * 2;
    const columnWidth = (contentWidth - gap) / 2;
    const rightX = margin + columnWidth + gap;

    type PdfRow = { label: string; value: string; valueLines: string[]; height: number };
    const measureRows = (rows: Array<[string, string]>, width: number): PdfRow[] =>
      rows.map(([label, value]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const valueLines = pdf.splitTextToSize(value, width - 34) as string[];
        return { label, value, valueLines, height: Math.max(7, valueLines.length * 4.1 + 2) };
      });
    const drawCard = (x: number, y: number, width: number, height: number): void => {
      pdf.setFillColor(...white);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(x, y, width, height, 2, 2, 'FD');
    };
    const drawCardTitle = (title: string, x: number, y: number): void => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...forest);
      pdf.text(title, x, y);
    };
    const drawRows = (rows: PdfRow[], x: number, y: number, width: number): void => {
      for (const row of rows) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.2);
        pdf.setTextColor(...muted);
        pdf.text(row.label, x, y);
        pdf.setFontSize(8);
        pdf.setTextColor(...charcoal);
        pdf.text(row.valueLines, x + 31, y);
        y += row.height;
      }
    };

    const customerRows = measureRows([
      ['Name', order.customer_name],
      ['Phone', `+91 ${order.customer_mobile}`],
      ...(order.alternate_mobile ? [['Alternate phone', `+91 ${order.alternate_mobile}`] as [string, string]] : []),
      ...(order.customer_email ? [['Email', order.customer_email] as [string, string]] : []),
    ], columnWidth - 16);
    const addressRows = measureRows([
      ['House / building', order.address_line1],
      ['Road / area', order.address_line2],
      ...(order.landmark ? [['Landmark', order.landmark] as [string, string]] : []),
      ['City', order.city],
      ['State', order.state],
      ['PIN code', order.pincode],
    ], columnWidth - 16);

    pdf.setFillColor(...ivory);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setFillColor(...sage);
    pdf.roundedRect(margin, 11, 16, 16, 2, 2, 'F');
    pdf.addImage(logo, 'PNG', margin + 1.1, 12.1, 13.8, 13.8);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...forest);
    pdf.text('THE CART', margin + 22, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setCharSpace(0.75);
    pdf.setTextColor(...muted);
    pdf.text('EVERYDAY, ELEVATED', margin + 22, 24);
    pdf.setCharSpace(0);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(...muted);
    pdf.text('ORDER REFERENCE', pageWidth - margin, 14, { align: 'right' });
    pdf.setFontSize(9);
    pdf.setTextColor(...charcoal);
    pdf.text(`#${order.order_id}`, pageWidth - margin, 20, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(...muted);
    pdf.text(`Placed ${this.formatPdfDate(order.order_date)}`, pageWidth - margin, 26, { align: 'right' });

    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.55);
    pdf.line(margin, 34, pageWidth - margin, 34);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(...forest);
    pdf.text('ORDER CONFIRMATION', margin, 47);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text('Thank you for placing your order with TheCart. Here is your order summary.', margin, 54);

    const customerHeight = 17 + customerRows.reduce((sum, row) => sum + row.height, 0);
    const addressHeight = 17 + addressRows.reduce((sum, row) => sum + row.height, 0);
    const detailsTop = 63;
    const detailRowHeight = Math.max(customerHeight, addressHeight);
    drawCard(margin, detailsTop, columnWidth, detailRowHeight);
    drawCardTitle('Customer details', margin + 8, detailsTop + 10);
    drawRows(customerRows, margin + 8, detailsTop + 20, columnWidth - 16);
    drawCard(rightX, detailsTop, columnWidth, detailRowHeight);
    drawCardTitle('Delivery address', rightX + 8, detailsTop + 10);
    drawRows(addressRows, rightX + 8, detailsTop + 20, columnWidth - 16);

    const productRows = measureRows([
      ['Product', order.product_title],
      ['Quantity', String(order.quantity)],
    ], columnWidth - 16);
    const deliveryRows = measureRows([
      ['Expected delivery date', order.estimated_delivery_date
        ? this.formatDeliveryDate(order.estimated_delivery_date)
        : 'Not set'],
    ], columnWidth - 16);
    const productHeight = 17 + productRows.reduce((sum, row) => sum + row.height, 0);
    const deliveryHeight = 17 + deliveryRows.reduce((sum, row) => sum + row.height, 0);
    const productTop = detailsTop + detailRowHeight + 7;
    const productRowHeight = Math.max(productHeight, deliveryHeight, 37);
    drawCard(margin, productTop, columnWidth, productRowHeight);
    drawCardTitle('Product details', margin + 8, productTop + 10);
    drawRows(productRows, margin + 8, productTop + 20, columnWidth - 16);
    drawCard(rightX, productTop, columnWidth, productRowHeight);
    drawCardTitle('Delivery information', rightX + 8, productTop + 10);
    drawRows(deliveryRows, rightX + 8, productTop + 20, columnWidth - 16);

    const paymentTop = productTop + productRowHeight + 7;
    const paymentMethod = order.payment_method === 'UPI' ? 'UPI' : 'Cash on delivery';
    const paymentStatus = this.paymentLabel(order);
    const paymentLines = 1 + 5 + (order.payment_method === 'COD' ? 1 : 0);
    const paymentHeight = 17 + 13 + paymentLines * 6.5 + 19;
    drawCard(margin, paymentTop, contentWidth, paymentHeight);
    drawCardTitle('Payment summary', margin + 8, paymentTop + 10);

    pdf.setFillColor(...sage);
    pdf.roundedRect(margin + 8, paymentTop + 15, contentWidth - 16, 10, 1.5, 1.5, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(...forest);
    pdf.text(`${paymentMethod} · ${paymentStatus}`, margin + 12, paymentTop + 21.5);

    const paymentRows: Array<[string, string]> = [
      ['MRP', `INR ${this.formatMoney(order.mrp)}`],
      ['Discount', `- INR ${this.formatMoney(order.discount)}`],
      ['Shipping', `INR ${this.formatMoney(order.shipping)}`],
      ['Tax', `INR ${this.formatMoney(order.tax)}`],
      ...(order.payment_method === 'COD' ? [['COD fee', `INR ${this.formatMoney(order.cod_fee)}`] as [string, string]] : []),
    ];
    let amountY = paymentTop + 33;
    for (const [label, value] of paymentRows) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.7);
      pdf.setTextColor(...(label === 'Discount' ? forest : muted));
      pdf.text(label, margin + 10, amountY);
      pdf.setTextColor(...(label === 'Discount' ? forest : charcoal));
      pdf.setFontSize(8);
      pdf.text(value, pageWidth - margin - 10, amountY, { align: 'right' });
      amountY += 6.5;
    }

    const totalTop = amountY + 1;
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.3);
    pdf.line(margin + 8, totalTop, pageWidth - margin - 8, totalTop);
    pdf.setFillColor(...sage);
    pdf.roundedRect(margin + 8, totalTop + 3, contentWidth - 16, 13, 1.5, 1.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...forest);
    pdf.text('TOTAL', margin + 12, totalTop + 11.5);
    pdf.setFontSize(11);
    pdf.text(`INR ${this.formatMoney(order.total)}`, pageWidth - margin - 12, totalTop + 11.5, { align: 'right' });

    const footerLineY = pageHeight - 17;
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerLineY, pageWidth - margin, footerLineY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...muted);
    pdf.text('A thoughtful order, delivered with care.', margin, pageHeight - 9);
    pdf.text(`#${order.order_id}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
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

  formatPdfDate(value: string): string {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h12',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value));
    return formatted.replace(/\b(am|pm)\b/i, (period) => period.toUpperCase()) + ' IST';
  }

  formatDeliveryDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
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

  paymentTone(order: AdminOrderTracking): 'paid' | 'pending' | 'cancelled' {
    if (order.delivery_status === 'CANCELLED' || order.payment_status === 'PAYMENT_FAILED') return 'cancelled';
    if (order.payment_status === 'PAID') return 'paid';
    return 'pending';
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
