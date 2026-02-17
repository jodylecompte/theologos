import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type FlagType = 'HEADING_SUSPECT' | 'FOOTNOTE_SUSPECT' | 'METADATA_SUSPECT';

export interface WorkUnit {
  id: string;
  workId: string;
  type: string;
  positionIndex: number;
  pdfPageNumber: number | null;
  title: string | null;
  contentText: string;
  editedText: string | null;
  status: 'AUTO' | 'EDITED' | 'REVIEWED';
  flags: FlagType[];
  updatedAt: string;
}

export interface WorkUnitListItem {
  id: string;
  positionIndex: number;
  pdfPageNumber: number | null;
  title: string | null;
  status: 'AUTO' | 'EDITED' | 'REVIEWED';
  flags: FlagType[];
  updatedAt: string;
}

export interface WorkUnitListResponse {
  workUnits: WorkUnitListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Work {
  id: string;
  title: string;
  author: string | null;
  type: string;
}

export interface Navigation {
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
}

export interface WorkUnitDetailResponse {
  workUnit: WorkUnit;
  work: Work;
  navigation: Navigation;
}

export interface UpdateWorkUnitRequest {
  editedText?: string;
  status?: 'AUTO' | 'EDITED' | 'REVIEWED';
}

@Injectable({
  providedIn: 'root'
})
export class WorkUnitService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3333/api/work-units';

  /**
   * Get a WorkUnit by ID with navigation context
   */
  async getWorkUnit(workUnitId: string): Promise<WorkUnitDetailResponse> {
    const url = `${this.apiUrl}/${workUnitId}`;
    return firstValueFrom(this.http.get<WorkUnitDetailResponse>(url));
  }

  /**
   * Update a WorkUnit's editedText and/or status
   */
  async updateWorkUnit(
    workUnitId: string,
    updates: UpdateWorkUnitRequest
  ): Promise<{ workUnit: WorkUnit }> {
    const url = `${this.apiUrl}/${workUnitId}`;
    return firstValueFrom(
      this.http.put<{ workUnit: WorkUnit }>(url, updates)
    );
  }

  /**
   * Get WorkUnits for a book with optional filtering
   */
  async getWorkUnitsForBook(
    workId: string,
    options?: {
      status?: 'AUTO' | 'EDITED' | 'REVIEWED';
      flag?: FlagType;
      limit?: number;
      offset?: number;
    }
  ): Promise<WorkUnitListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.flag) params.set('flag', options.flag);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const url = `${this.apiUrl}/books/${workId}?${params.toString()}`;
    return firstValueFrom(this.http.get<WorkUnitListResponse>(url));
  }

  /**
   * Get the first WorkUnit ID for a work
   * (API defaults to 'page' type, which has content)
   */
  async getFirstWorkUnitId(workId: string): Promise<string | null> {
    const response = await this.getWorkUnitsForBook(workId, { limit: 1 });
    return response.workUnits.length > 0 ? response.workUnits[0].id : null;
  }

  /**
   * Recompute flags for all WorkUnits in a book
   */
  async recomputeFlags(workId: string): Promise<{
    success: boolean;
    processed: number;
    flagged: number;
    unflagged: number;
  }> {
    const url = `http://localhost:3333/api/flags/books/${workId}/work-units/recompute`;
    return firstValueFrom(
      this.http.post<any>(url, {})
    );
  }
}
