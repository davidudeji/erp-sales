import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { RouteStop } from '../../../domain/logistics/logistics.dto';

// Leaflet is loaded lazily from a CDN at runtime (see loadLeaflet below) so this
// component works out of the box with zero extra npm installs.
// For a production/offline build, install it instead and swap the loader:
//   npm install leaflet @types/leaflet --save
// then `import * as L from 'leaflet';` and remove loadLeaflet().
declare const L: any;

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
  selector: 'app-route-map',
  templateUrl: './route-map.component.html',
  styleUrl: './route-map.component.scss'
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() stops: RouteStop[] = [];

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  loadFailed = false;
  private map: any;
  private layerGroup: any;
  private viewReady = false;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stops'] && this.viewReady) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    const withCoords = (this.stops || []).filter((s) => s.lat != null && s.lng != null);
    if (!withCoords.length) return;

    loadLeaflet()
      .then(() => {
        if (!this.mapEl) return;

        // Keep Leaflet's internal pan/zoom/tile-load listeners out of Angular's
        // zone so interacting with the map doesn't trigger full app-wide change
        // detection on every mouse move.
        this.ngZone.runOutsideAngular(() => {
          if (!this.map) {
            this.map = L.map(this.mapEl.nativeElement, { zoomControl: true, attributionControl: true });
          }
          if (this.layerGroup) {
            this.layerGroup.clearLayers();
          } else {
            this.layerGroup = L.layerGroup().addTo(this.map);
          }

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(this.map);

          const latlngs: [number, number][] = withCoords.map((s) => [s.lat as number, s.lng as number]);

          withCoords.forEach((stop) => {
            const icon = L.divIcon({
              className: 'route-map-pin',
              html: `<div class="route-map-pin-inner">${stop.sequence}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            L.marker([stop.lat as number, stop.lng as number], { icon })
              .addTo(this.layerGroup)
              .bindPopup(`<strong>Stop ${stop.sequence}</strong><br>${stop.location}`);
          });

          L.polyline(latlngs, { color: '#00a191', weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(this.layerGroup);

          this.map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28] });

          // Leaflet needs a nudge to size correctly inside dynamically-shown panels.
          setTimeout(() => this.map?.invalidateSize(), 150);
        });
      })
      .catch(() => {
        this.loadFailed = true;
      });
  }
}
