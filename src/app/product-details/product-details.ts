import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { productOffer } from './product-offer';

interface ProductMedia {
  src: string;
  alt: string;
  label: string;
}

interface ProductSpec {
  label: string;
  value: string;
}

@Component({
  selector: 'app-product-details',
  standalone: true,
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails {
  private readonly router = inject(Router);

  // Replace this single product record with the selected product returned by the catalog API.
  readonly product = {
    ...productOffer,
    eyebrow: 'A LITTLE BETTER, EVERY DAY',
    description: 'Thoughtfully designed to make your everyday routine easier, faster and more convenient.',
    stockLabel: 'Available now',
    benefits: [
      { icon: '✳', title: 'Easy to use', copy: 'Simple and convenient for everyday use.' },
      { icon: '✦', title: 'Thoughtful quality', copy: 'A practical finish, made for regular use.' },
      { icon: '↗', title: 'Less time, less effort', copy: 'Make everyday tasks feel a little simpler.' },
      { icon: '▱', title: 'Compact by design', copy: 'Easy to keep close and store away.' },
      { icon: '♡', title: 'Made for real life', copy: 'A useful addition to your everyday routine.' },
    ],
    features: [
      'Designed for straightforward, everyday use',
      'A considered form that fits into your routine',
      'Practical details without unnecessary complexity',
      'Easy to store between uses',
    ],
    specifications: [] as ProductSpec[],
    packageContents: [] as string[],
  };

  readonly media: ProductMedia[] = [
    {
      src: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=85',
      alt: 'Minimal reusable bottle on a neutral studio background',
      label: 'The details',
    },
    {
      src: 'https://images.unsplash.com/photo-1523362628745-0c100150b6c0?auto=format&fit=crop&w=1200&q=85',
      alt: 'Everyday bottle ready to take on the go',
      label: 'Made to go',
    },
    {
      src: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=1200&q=85',
      alt: 'Close-up of a carefully finished everyday bottle',
      label: 'A closer look',
    },
  ];

  readonly faqs = [
    { question: 'Is Cash on Delivery available?', answer: 'Cash on Delivery availability depends on your delivery PIN code. We will confirm available payment options during checkout.' },
    { question: 'How long does delivery take?', answer: 'Delivery timelines vary by location. Your estimated delivery window will be shared once a valid PIN code is entered.' },
    { question: 'What is included in the package?', answer: 'Package contents are being confirmed for this listing. Please check back for the verified product details.' },
    { question: 'How do I use the product?', answer: 'Product-specific usage guidance will be included with the verified listing information.' },
    { question: 'Is there a replacement or warranty?', answer: 'Replacement and warranty terms depend on the final product listing. Please contact support before ordering if you need help.' },
    { question: 'How can I contact support?', answer: 'Use the support link in the header to reach our team. We are happy to help with product and delivery questions.' },
  ];

  selectedMedia = 0;
  openFaq = -1;
  zoomed = false;

  get savings(): number {
    return Math.max(0, this.product.mrp - this.product.price);
  }

  selectMedia(index: number): void {
    this.selectedMedia = index;
    this.zoomed = false;
  }

  navigateToCheckout(): void {
    void this.router.navigateByUrl('/checkout');
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? -1 : index;
  }

}
