import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { WorkUnitSelectorComponent } from './work-unit-selector.component';

describe('WorkUnitSelectorComponent - Chapter Label Extraction', () => {
  let component: WorkUnitSelectorComponent;
  let fixture: ComponentFixture<WorkUnitSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkUnitSelectorComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkUnitSelectorComponent);
    component = fixture.componentInstance;
  });

  describe('getUnitDisplayLabel', () => {
    it('should extract "Preface" from "Preface: Tenth-Anniversary Edition"', () => {
      // Setup mock work data
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 0
      });

      const unit = {
        number: 1,
        displayText: 'Preface: Tenth-Anniversary Edition',
        hasReferences: false
      };

      const label = component.getUnitDisplayLabel(unit);
      expect(label).toBe('Preface');
    });

    it('should extract "Chapter 1" from "Chapter 1: Why I Wrote This Book"', () => {
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 0
      });

      const unit = {
        number: 3,
        displayText: 'Chapter 1: Why I Wrote This Book',
        hasReferences: true
      };

      const label = component.getUnitDisplayLabel(unit);
      expect(label).toBe('Chapter 1');
    });

    it('should handle multiple prefaces with same displayNumber', () => {
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 0
      });

      const unit1 = {
        number: 1,
        displayText: 'Preface: Tenth-Anniversary Edition',
        hasReferences: false
      };

      const unit2 = {
        number: 2,
        displayText: 'Preface: Preface and a Prayer',
        hasReferences: false
      };

      expect(component.getUnitDisplayLabel(unit1)).toBe('Preface');
      expect(component.getUnitDisplayLabel(unit2)).toBe('Preface');
    });

    it('should fallback to "Section N" for books without colon format', () => {
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 0
      });

      const unit = {
        number: 5,
        displayText: 'Some text without colon',
        hasReferences: false
      };

      const label = component.getUnitDisplayLabel(unit);
      expect(label).toBe('Section 5');
    });

    it('should use correct labels for non-book types', () => {
      // Test catechism
      component['workData'].set({
        slug: 'wsc',
        title: 'Westminster Shorter Catechism',
        author: null,
        type: 'catechism',
        units: [],
        totalUnits: 0
      });

      const unit = {
        number: 10,
        displayText: 'What is God?',
        hasReferences: true
      };

      expect(component.getUnitDisplayLabel(unit)).toBe('Q. 10');
    });
  });

  describe('getCurrentUnitDisplayLabel', () => {
    it('should return correct label for current unit', () => {
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 0
      });

      component['units'].set([
        { number: 1, displayText: 'Preface: First Preface', hasReferences: false },
        { number: 2, displayText: 'Preface: Second Preface', hasReferences: false },
        { number: 3, displayText: 'Chapter 1: First Chapter', hasReferences: true }
      ]);

      // Select first preface
      component['currentUnit'].set(1);
      expect(component.getCurrentUnitDisplayLabel()).toBe('Preface');

      // Select chapter 1
      component['currentUnit'].set(3);
      expect(component.getCurrentUnitDisplayLabel()).toBe('Chapter 1');
    });
  });

  describe('Chapter dropdown integration test', () => {
    it('should display all chapters including prefaces in correct order', () => {
      component['workData'].set({
        slug: 'when-i-dont-desire-god',
        title: 'When I Don\'t Desire God',
        author: 'John Piper',
        type: 'book',
        units: [],
        totalUnits: 3
      });

      const units = [
        { number: 1, displayText: 'Preface: Tenth-Anniversary Edition', hasReferences: false, firstPage: 1 },
        { number: 2, displayText: 'Preface: Preface and a Prayer', hasReferences: false, firstPage: 3 },
        { number: 3, displayText: 'Chapter 1: Why I Wrote This Book', hasReferences: true, firstPage: 7 }
      ];

      component['units'].set(units);

      // Verify all units appear with correct labels
      const labels = units.map(u => component.getUnitDisplayLabel(u));
      expect(labels).toEqual(['Preface', 'Preface', 'Chapter 1']);

      // Verify full display texts are preserved
      expect(units[0].displayText).toBe('Preface: Tenth-Anniversary Edition');
      expect(units[1].displayText).toBe('Preface: Preface and a Prayer');
      expect(units[2].displayText).toBe('Chapter 1: Why I Wrote This Book');

      // Verify first page numbers are correct
      expect(units[0].firstPage).toBe(1);
      expect(units[1].firstPage).toBe(3);
      expect(units[2].firstPage).toBe(7);
    });
  });

  describe('Chapter navigation', () => {
    it('should emit correct firstPage when chapter is selected', () => {
      component['workData'].set({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Author',
        type: 'book',
        units: [],
        totalUnits: 3
      });

      component['units'].set([
        { number: 1, displayText: 'Preface: First', hasReferences: false, firstPage: 1 },
        { number: 2, displayText: 'Preface: Second', hasReferences: false, firstPage: 3 },
        { number: 3, displayText: 'Chapter 1: Content', hasReferences: true, firstPage: 7 }
      ]);

      let emittedSelection: any;
      component.selectionChange.subscribe((selection: any) => {
        emittedSelection = selection;
      });

      // Select Chapter 1 (unit 3) - should emit firstPage: 7
      component.selectUnit(3);

      expect(emittedSelection).toEqual({ unitNumber: 3, firstPage: 7 });
    });
  });
});
