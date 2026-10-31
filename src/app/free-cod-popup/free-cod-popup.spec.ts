import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { FreeCodPopup } from './free-cod-popup';

describe('FreeCodPopup', () => {
  let fixture: ComponentFixture<FreeCodPopup>;
  let routeEvents: Subject<NavigationEnd>;
  let routeUrl: string;

  beforeEach(async () => {
    sessionStorage.removeItem('free-cod-popup-dismissed');
    routeEvents = new Subject<NavigationEnd>();
    routeUrl = '/';

    await TestBed.configureTestingModule({
      imports: [FreeCodPopup],
      providers: [
        {
          provide: Router,
          useValue: {
            get url(): string {
              return routeUrl;
            },
            events: routeEvents.asObservable(),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    sessionStorage.removeItem('free-cod-popup-dismissed');
  });

  function navigate(url: string): void {
    const previousUrl = routeUrl;
    routeUrl = url;
    routeEvents.next(new NavigationEnd(1, previousUrl, url));
    fixture.detectChanges();
  }

  it('opens on a product details page and locks background scrolling', () => {
    routeUrl = '/product-details/test-item';
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does not open on the storefront landing page', () => {
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('opens after navigating from the landing page to a product details page', () => {
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    navigate('/product-details/test-item');

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('closes on CTA, persists dismissal for the tab session, and restores scrolling', () => {
    routeUrl = '/product-details/test-item';
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.cod-popup-cta') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(sessionStorage.getItem('free-cod-popup-dismissed')).toBe('true');
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape', () => {
    routeUrl = '/product-details/test-item';
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();

  });

  it('closes when the customer clicks outside the popup', () => {
    routeUrl = '/product-details/test-item';
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.cod-popup-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not open on checkout routes', () => {
    routeUrl = '/checkout';
    fixture = TestBed.createComponent(FreeCodPopup);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
