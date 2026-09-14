import { Routes } from '@angular/router';
import { Addressform } from './addressform/addressform';
import { Dashboard } from './dashboard/dashboard';
import { Home } from './home/home';
import { Products } from './products/products';
import { ProfitLoss } from './profit-loss/profit-loss';
import { Settings } from './settings/settings';
import { Shipments } from './shipments/shipments';

export const routes: Routes = [
	{
		path: '',
		component: Home,
		children: [
			{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
			{ path: 'dashboard', component: Dashboard },
			{ path: 'address-extract', component: Addressform },
			{ path: 'products', component: Products },
			{ path: 'shipments', component: Shipments },
			{ path: 'profit-loss', component: ProfitLoss },
			{ path: 'settings', component: Settings },
		],
	},
	{ path: '**', redirectTo: '' },
];
