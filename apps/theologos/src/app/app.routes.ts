import { Route } from '@angular/router';
import { ReaderContainerComponent } from './components/reader-container.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/reader', pathMatch: 'full' },
  { path: 'reader', component: ReaderContainerComponent }
];
