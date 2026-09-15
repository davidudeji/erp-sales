import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import { GeoPoint, RouteStop } from '../../../domain/logistics/logistics.dto';

declare const L: any;

// Shared loader with route-map.component.ts / location-picker.component.ts —
// Leaflet is fetched from CDN once and reused across the app.
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
  selector: 'app-route-builder-map',
  templateUrl: './route-builder-map.component.html',
  styleUrl: './route-builder-map.component.scss'
})
export class RouteBuilderMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() stops: RouteStop[] = [];
  @Input() activeOrderId: string | null = null;
  @Input() editable = true;

  @Output() selectStop = new EventEmitter<string>();
  @Output() locationPicked = new EventEmitter<GeoPoint>();

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  loadFailed = false;
  searchTerm = '';
  suggestions: GeoPoint[] = [];
  isSearching = false;

  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private map: any;
  private layerGroup: any;
  private viewReady = false;

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
    this.viewReady = true;
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['stops'] || changes['activeOrderId']) && this.viewReady) {
      this.renderMarkers();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) this.map.remove();
  }

  get activeStop(): RouteStop | null {
    return this.stops.find((s) => s.orderId === this.activeOrderId) ?? null;
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    if (value.trim().length >= 3) this.search$.next(value.trim());
    else this.suggestions = [];
  }

  pickSuggestion(point: GeoPoint): void {
    this.suggestions = [];
    this.searchTerm = '';
    if (this.map) this.map.setView([point.lat, point.lng], 16);
    this.locationPicked.emit(point);
  }

  private initMap(): void {
    loadLeaflet()
      .then(() => {
        if (!this.mapEl) return;
        // Everything Leaflet does internally (pan, zoom, inertia, tile loads) fires
        // native DOM events. Creating the map outside Angular's zone stops those
        // from triggering a full change-detection pass on every mouse move — this
        // is what was making the tab lag/freeze while interacting with the map.
        this.ngZone.runOutsideAngular(() => {
          this.map = L.map(this.mapEl.nativeElement, { zoomControl: true, attributionControl: true }).setView([9.0765, 7.3986], 12);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(this.map);

          this.map.on('click', (e: any) => {
            if (!this.editable || !this.activeOrderId) return;
            const { lat, lng } = e.latlng;
            this.logisticsService.reverseGeocode(lat, lng).subscribe((point) => {
              this.ngZone.run(() => this.locationPicked.emit(point));
            });
          });

          this.renderMarkers();
          setTimeout(() => this.map?.invalidateSize(), 150);
        });
      })
      .catch(() => {
        this.loadFailed = true;
      });
  }

  private renderMarkers(): void {
    if (!this.map) return;
    // Marker creation/removal and fitBounds also churn through native DOM
    // events (drag handles, popups) — keep this outside Angular's zone too.
    this.ngZone.runOutsideAngular(() => {
      if (this.layerGroup) this.layerGroup.clearLayers();
      else this.layerGroup = L.layerGroup().addTo(this.map);

      const withCoords = (this.stops || []).filter((s) => s.lat != null && s.lng != null);
      if (!withCoords.length) return;

      withCoords.forEach((stop) => {
        const isActive = stop.orderId === this.activeOrderId;
        const isConfirmed = !!stop.locationConfirmed;
        const color = isActive ? '#2563eb' : isConfirmed ? '#00a191' : '#f97316';
        const icon = L.divIcon({
          className: 'rbm-pin',
          html: `<div class="rbm-pin-inner${isActive ? ' rbm-pin-inner--active' : ''}" style="background:${color}">${stop.sequence}</div>`,
          iconSize: [isActive ? 32 : 26, isActive ? 32 : 26],
          iconAnchor: [isActive ? 16 : 13, isActive ? 16 : 13]
        });
        const marker = L.marker([stop.lat as number, stop.lng as number], { icon, draggable: this.editable && isActive }).addTo(this.layerGroup);
        marker.bindPopup(`<strong>Stop ${stop.sequence}</strong><br>${stop.location}${isConfirmed ? ' (confirmed)' : ' (unconfirmed)'}`);
        marker.on('click', () => this.ngZone.run(() => this.selectStop.emit(stop.orderId)));
        if (this.editable && isActive) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            this.logisticsService.reverseGeocode(pos.lat, pos.lng).subscribe((point) => {
              this.ngZone.run(() => this.locationPicked.emit(point));
            });
          });
        }
      });

      const confirmedCoords = withCoords.filter((s) => s.locationConfirmed).map((s) => [s.lat as number, s.lng as number] as [number, number]);
      if (confirmedCoords.length > 1) {
        L.polyline(confirmedCoords, { color: '#00a191', weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(this.layerGroup);
      }

      const allCoords = withCoords.map((s) => [s.lat as number, s.lng as number] as [number, number]);
      this.map.fitBounds(L.latLngBounds(allCoords), { padding: [32, 32] });
    });
  }
}
