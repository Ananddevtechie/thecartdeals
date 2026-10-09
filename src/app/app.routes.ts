import { Routes } from '@angular/router';
import { Checkout } from './checkout/checkout';
import { Payment } from './payment/payment';
import { ProductDetails } from './product-details/product-details';
import { OrderSuccess } from './order-success/order-success';
import { OnlinePayment } from './online-payment/online-payment';
import { AdminProducts } from './admin-products/admin-products';
import { StorefrontHome } from './home/storefront-home';
import { AdminOrders } from './admin-orders/admin-orders';
import { OrderTrackingPage } from './order-tracking/order-tracking';
import { CancelOrderReview } from './order-success/cancel-order-review';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', component: StorefrontHome, title: 'Shop | TheCart' },
	{ path: 'product-details', component: ProductDetails, title: 'Product details | TheCart' },
	{ path: 'product-details/:slug', component: ProductDetails, title: 'Product details | TheCart' },
	{ path: 'admin/products', component: AdminProducts, title: 'Add products | TheCart Admin' },
	{ path: 'admin/products/add', component: AdminProducts, title: 'Add a product | TheCart Admin' },
	{ path: 'admin/orders', component: AdminOrders, title: 'Manage orders | TheCart Admin' },
	{ path: 'checkout', component: Checkout, title: 'Secure checkout | TheCart' },
	{ path: 'payment', component: Payment, title: 'Payment | TheCart' },
	{ path: 'online-payment', component: OnlinePayment, title: 'Online payment | TheCart' },
	{ path: 'order/success', component: OrderSuccess, title: 'Order placed successfully | TheCart' },
	{ path: 'order/cancel-review/:orderId', component: CancelOrderReview, title: 'Review order cancellation | TheCart' },
	{ path: 'track-order', component: OrderTrackingPage, title: 'Track your order | TheCart' },
	{ path: 'track-order/:orderId', component: OrderTrackingPage, title: 'Track your order | TheCart' },
	{ path: '**', redirectTo: '' },
];
