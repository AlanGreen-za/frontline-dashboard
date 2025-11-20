import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
export class MapViewComponent implements OnInit, OnDestroy {
  @Input() clients: ClientData[] = [];
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  newMap!: GoogleMap;
  apiKey = 'AIzaSyCQlRiBuc2ARzifFEUAaNX7XXfevll1UAQ'; // In a real app, use environment variables

  constructor() { }

  ngOnInit() {
    // Map initialization is handled in ngAfterViewInit or explicitly called
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

    await this.addMarkers();
    await this.locateUser();
  }

  async addMarkers() {
    if (!this.newMap || !this.clients) return;

    const markers: Marker[] = this.clients
      .filter(client => client.latLong)
      .map(client => {
        const [lat, lng] = client.latLong.split(',').map(coord => parseFloat(coord.trim()));
        return {
          coordinate: { lat, lng },
          title: client.tradingName,
          snippet: client.accountManager
        };
      });

    await this.newMap.addMarkers(markers);
  }

  async locateUser() {
    try {
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location !== 'granted') {
        const requestStatus = await Geolocation.requestPermissions();
        if (requestStatus.location !== 'granted') return;
      }

      const position = await Geolocation.getCurrentPosition();

      // Add blue dot for user (using a custom icon if possible, or just a marker for now)
      // Google Maps SDK for Capacitor doesn't support custom marker icons easily in all versions, 
      // but we can try to use a different color or just a marker.
      // For now, we will center the map on the user.

      await this.newMap.setCamera({
        coordinate: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        zoom: 10,
        animate: true
      });

      // Add a marker for the user
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
