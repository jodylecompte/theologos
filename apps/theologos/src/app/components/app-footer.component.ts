import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer">
      <div class="footer-content">
        <p class="footer-text">
          Theologos &copy; {{ currentYear }} • A Ministry-Oriented Theological Study System
        </p>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background: #2c3e50;
      color: rgba(255, 255, 255, 0.7);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem 2rem;
    }

    .footer-content {
      max-width: 1600px;
      margin: 0 auto;
      text-align: center;
    }

    .footer-text {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 400;
    }

    @media (max-width: 640px) {
      .app-footer {
        padding: 1rem;
      }

      .footer-text {
        font-size: 0.75rem;
      }
    }
  `]
})
export class AppFooterComponent {
  currentYear = new Date().getFullYear();
}
