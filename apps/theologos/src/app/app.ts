import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BibleReaderComponent } from './components/bible-reader.component';

@Component({
  standalone: true,
  imports: [BibleReaderComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
