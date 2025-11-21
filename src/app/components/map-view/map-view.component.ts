import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { ClientData } from '../../services/data.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  standalone: true
})
export class MapViewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() clients: ClientData[] = [];
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  newMap!: GoogleMap;
  apiKey = environment.googleMapsApiKey;
  markerIds: string[] = [];

  constructor() { }

  ngOnInit() {
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['clients'] && this.newMap) {
      await this.addMarkers();
    }
  }

  async ngAfterViewInit() {
    await this.createMap();
  }

  async createMap() {
    if (!this.mapRef) return;

    this.newMap = await GoogleMap.create({
      id: 'my-map',
      element: this.mapRef.nativeElement,
      apiKey: this.apiKey,
      config: {
        center: {
          lat: -33.9249,
          lng: 18.4241,
        },
        zoom: 8,
      },
    });

    // await this.locateUser(); // Temporarily disabled to isolate marker issue
    await this.locateUser();
    await this.addMarkers();
  }

  async addMarkers() {
    if (!this.newMap) return;

    // Clear existing markers
    if (this.markerIds.length > 0) {
      await this.newMap.removeMarkers(this.markerIds);
      this.markerIds = [];
    }

    if (!this.clients) return;

    const markers: Marker[] = this.clients
      .filter(client => client.latLong && typeof client.latLong === 'string')
      .map(client => {
        const parts = client.latLong.split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;

        // Check if overdue (more than 60 days)
        let isOverdue = true;
        if (client.lastSiteVisit) {
          const lastVisit = new Date(client.lastSiteVisit);
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          isOverdue = lastVisit < sixtyDaysAgo;
        }

        // Set icon based on status
        // Using Google Maps standard icons (HTTPS)
        const iconUrl = isOverdue
          ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
          : 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';

        return {
          coordinate: { lat, lng },
          title: client.tradingName,
          snippet: `${client.accountManager} - ${isOverdue ? 'Overdue' : 'Visited'}`,
          iconUrl: iconUrl
        };
      })
      .filter(marker => marker !== null) as Marker[];

    if (markers.length > 0) {
      this.markerIds = await this.newMap.addMarkers(markers);
    }
  }

  async locateUser() {
    try {
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location !== 'granted') {
        const requestStatus = await Geolocation.requestPermissions();
        if (requestStatus.location !== 'granted') return;
      }

      const position = await Geolocation.getCurrentPosition();

      await this.newMap.setCamera({
        coordinate: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        zoom: 10,
        animate: true
      });

      await this.newMap.addMarker({
        coordinate: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        title: 'You are here',
        snippet: 'Current Location'
      });

    } catch (e) {
      console.error('Error getting location', e);
    }
  }

  ngOnDestroy() {
    if (this.newMap) {
      this.newMap.destroy();
    }
  }
}
