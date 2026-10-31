import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FreeCodPopup } from './free-cod-popup/free-cod-popup';

@Component({
  imports: [FreeCodPopup, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly title = signal('frontend');

  get isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin/');
  }
}
