import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type PolicySectionId =
  | 'faq'
  | 'shipping-delivery'
  | 'returns-refunds'
  | 'cancellation'
  | 'about-us'
  | 'privacy'
  | 'terms'
  | 'payment'
  | 'grievance';

interface PolicySection {
  id: PolicySectionId;
  label: string;
}

interface FrequentlyAskedQuestion {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-thecartdetailsandpolicy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './thecartdetailsandpolicy.html',
  styleUrl: './thecartdetailsandpolicy.scss',
})
export class TheCartDetailsAndPolicy implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly sections: PolicySection[] = [
    { id: 'about-us', label: 'About Us / Our Story' },
    { id: 'faq', label: 'Frequently Asked Questions' },
    { id: 'shipping-delivery', label: 'Shipping & Delivery Policy' },
    { id: 'returns-refunds', label: 'Return & Refund Policy' },
    { id: 'cancellation', label: 'Cancellation Policy' },
    { id: 'privacy', label: 'Privacy Policy' },
    { id: 'payment', label: 'Payment Policy' },
    { id: 'terms', label: 'Terms & Conditions' },
    { id: 'grievance', label: 'Grievance Redressal' },
  ];

  readonly frequentlyAskedQuestions: FrequentlyAskedQuestion[] = [
    {
      question: 'When will my order arrive?',
      answer: 'Orders are usually prepared within 1–2 business days and delivered within 3–7 business days after dispatch. Remote locations may take a little longer.',
    },
    {
      question: 'How much does delivery cost?',
      answer: 'Delivery is free where available. Any location-specific delivery charge or limitation is confirmed after you enter your PIN code at checkout.',
    },
    {
      question: 'Can I return an item or request a refund?',
      answer: 'Eligible unused items can be returned within 7 days of delivery. Contact support with your order number to check eligibility and arrange a return.',
    },
    {
      question: 'Can I cancel my order?',
      answer: 'You can request cancellation before the order is dispatched. Once it has shipped, cancellation may no longer be possible; see our Cancellation Policy for details.',
    },
    {
      question: 'How can I get help with an order?',
      answer: 'Message TheCart support on WhatsApp and include your order number so we can help you.',
    },
  ];

  activeSection: PolicySectionId = 'about-us';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const section = params.get('section');
      this.activeSection = this.isPolicySection(section) ? section : 'about-us';
    });
  }

  get activeSectionLabel(): string {
    return this.sections.find((section) => section.id === this.activeSection)?.label ?? 'About Us / Our Story';
  }

  private isPolicySection(section: string | null): section is PolicySectionId {
    return this.sections.some((item) => item.id === section);
  }
}
