import { Routes } from '@angular/router';
import { Checkout } from './checkout/checkout';
import { Payment } from './payment/payment';
import { ProductDetails } from './product-details/product-details';
import { OrderSuccess } from './order-success/order-success';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'product-details' },
	{ path: 'product-details', component: ProductDetails, title: 'Premium Everyday Product | goodform' },
	{ path: 'checkout', component: Checkout, title: 'Secure checkout | TheCart' },
	{ path: 'payment', component: Payment, title: 'Payment | TheCart' },
	{ path: 'order/success', component: OrderSuccess, title: 'Order placed successfully | TheCart' },
	{ path: '**', redirectTo: 'product-details' },
];
