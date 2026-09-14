import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Addressform } from './addressform';

describe('Addressform', () => {
  let component: Addressform;
  let fixture: ComponentFixture<Addressform>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Addressform],
    }).compileComponents();

    fixture = TestBed.createComponent(Addressform);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
