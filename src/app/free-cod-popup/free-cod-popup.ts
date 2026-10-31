import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const dismissedStorageKey = 'free-cod-popup-dismissed';

@Component({
  selector: 'app-free-cod-popup',
  standalone: true,
  templateUrl: './free-cod-popup.html',
  styleUrl: './free-cod-popup.scss',
})
export class FreeCodPopup implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private previousBodyOverflow = '';
  private previousFocus: HTMLElement | null = null;
  protected readonly isOpen = signal(false);

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.destroyRef.onDestroy(() => {
      if (this.isOpen()) this.restorePage();
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.syncRoute(event.urlAfterRedirects));

    this.syncRoute(this.router.url);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    sessionStorage.setItem(dismissedStorageKey, 'true');
    this.restorePage();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Tab' && this.isOpen()) {
      const dialog = this.closeButton?.nativeElement.closest('[role="dialog"]');
      const focusableElements = dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private syncRoute(url: string): void {
    const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    const isEligibleRoute = path === '/product-details' || path.startsWith('/product-details/');
    const shouldOpen = isEligibleRoute && sessionStorage.getItem(dismissedStorageKey) !== 'true';

    if (shouldOpen && !this.isOpen()) {
      this.isOpen.set(true);
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => this.closeButton?.nativeElement.focus());
    } else if (!shouldOpen && this.isOpen()) {
      this.isOpen.set(false);
      this.restorePage();
    }
  }

  private restorePage(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    this.previousFocus?.focus();
    this.previousFocus = null;
  }
}
