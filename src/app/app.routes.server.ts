import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'ebook-checkout',
    renderMode: RenderMode.Client,
  },
  {
    path: 'ebook-payment',
    renderMode: RenderMode.Client,
  },
  {
    path: 'product-details/ebook/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'product-details/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'track-order/:orderId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'order/cancel-review/:orderId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'thecartdetailsandpolicy/:section',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
