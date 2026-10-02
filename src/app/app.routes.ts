import { Routes } from '@angular/router';
import { Checkout } from './checkout/checkout';
import { Payment } from './payment/payment';
import { ProductDetails } from './product-details/product-details';
import { OrderSuccess } from './order-success/order-success';
import { OnlinePayment } from './online-payment/online-payment';
import { AdminProducts } from './admin-products/admin-products';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'product-details' },
	{ path: 'product-details', component: ProductDetails, title: 'Product details | TheCart' },
	{ path: 'product-details/:slug', component: ProductDetails, title: 'Product details | TheCart' },
	{ path: 'admin/products', component: AdminProducts, title: 'Add products | TheCart Admin' },
	{ path: 'admin/products/add', component: AdminProducts, title: 'Add a product | TheCart Admin' },
	{ path: 'checkout', component: Checkout, title: 'Secure checkout | TheCart' },
	{ path: 'payment', component: Payment, title: 'Payment | TheCart' },
	{ path: 'online-payment', component: OnlinePayment, title: 'Online payment | TheCart' },
	{ path: 'order/success', component: OrderSuccess, title: 'Order placed successfully | TheCart' },
	{ path: '**', redirectTo: 'product-details' },
];
