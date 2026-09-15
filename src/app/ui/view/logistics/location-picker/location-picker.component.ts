import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import { GeoPoint } from '../../../domain/logistics/logistics.dto';

declare const L: any;

// Shared with route-map.component.ts — Leaflet is loaded once and reused everywhere.
let leafletLoadPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof (window as any).L !== 'undefined') return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise<void>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load map library'));
    document.body.appendChild(script);
  });
  return leafletLoadPromise;
}

@Component({
  selector: 'app-location-picker',
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss'
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialPoint: GeoPoint | null = null;
  @Input() title = 'Set stop location';
  @Output() confirmed = new EventEmitter<GeoPoint>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  searchTerm = '';
  suggestions: GeoPoint[] = [];
  selectedPoint: GeoPoint | null = null;
  isSearching = false;
  mapLoadFailed = false;

  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private map: any;
  private marker: any;

  constructor(private logisticsService: LogisticsService, private ngZone: NgZone) {
    this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => {
          this.isSearching = true;
          return this.logisticsService.searchAddress(q);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.suggestions = results;
        this.isSearching = false;
      });
  }

  ngAfterViewInit(): void {
    this.selectedPoint = this.initialPoint;
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) this.map.remove();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    if (value.trim().length >= 3) {
      this.search$.next(value.trim());
    } else {
      this.suggestions = [];
    }
  }

  pickSuggestion(point: GeoPoint): void {
    this.selectedPoint = point;
    this.searchTerm = point.label;
    this.suggestions = [];
    this.placeMarker(point.lat, point.lng);
    this.map?.setView([point.lat, point.lng], 15);
  }

  confirm(): void {
    if (this.selectedPoint) this.confirmed.emit(this.selectedPoint);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private initMap(): void {
    loadLeaflet()
      .then(() => {
        if (!this.mapEl) return;
        this.ngZone.runOutsideAngular(() => {
          const start: [number, number] = this.initialPoint ? [this.initialPoint.lat, this.initialPoint.lng] : [9.0765, 7.3986];
          this.map = L.map(this.mapEl.nativeElement).setView(start, this.initialPoint ? 15 : 12);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(this.map);

          if (this.initialPoint) this.placeMarker(this.initialPoint.lat, this.initialPoint.lng);

          this.map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            this.placeMarker(lat, lng);
            this.logisticsService.reverseGeocode(lat, lng).subscribe((point) => {
              this.ngZone.run(() => {
                this.selectedPoint = point;
                this.searchTerm = point.label;
              });
            });
          });

          setTimeout(() => this.map?.invalidateSize(), 150);
        });
      })
      .catch(() => {
        this.mapLoadFailed = true;
      });
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker.getLatLng();
        this.logisticsService.reverseGeocode(pos.lat, pos.lng).subscribe((point) => {
          this.ngZone.run(() => {
            this.selectedPoint = point;
            this.searchTerm = point.label;
          });
        });
      });
    }
  }
}
