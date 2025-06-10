import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs-extra';
import winston from 'winston';
import { AuthContext } from '../middleware/auth';
import { ApiClient } from '../services/api-client';
import { createUserFeatureDir } from '../../../shared/src/utils/file-utils';

interface LocationContext extends AuthContext {
  // Session management is now handled by AuthContext
}

interface UserLocationState {
  isActive: boolean;
  firstPoint?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  secondPoint?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: number;
  transportMode?: 'walking' | 'driving' | 'motorcycling';
}

interface LastMeasurement {
  firstPoint: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  secondPoint: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: number;
}

export class LocationHandler {
  private logger: winston.Logger;
  private apiClient: ApiClient;
  private backendUrl: string;
  private userStates = new Map<string, UserLocationState>();
  private lastMeasurements = new Map<string, LastMeasurement>();
  private showJarakSessions = new Set<string>(); // Track show_jarak sessions
  private mapsApiKey: string;

  // Constants
  private readonly MEASUREMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor(apiClient: ApiClient, logger: winston.Logger) {
    this.logger = logger;
    this.apiClient = apiClient;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    this.mapsApiKey = process.env.MAPS_API_KEY || '';

    if (!this.mapsApiKey) {
      this.logger.warn('MAPS_API_KEY not configured for location handler');
    }
  }

  /**
   * Handle /location command to activate location mode
   */
  async handleLocationCommand(ctx: LocationContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      this.logger.info('Location command received', { telegramId });

      // Set user mode to location
      ctx.setUserMode?.('location');

      // Initialize user state if not exists
      if (!this.userStates.has(telegramId)) {
        this.initUserLocationState(telegramId);
      } else {
        this.checkAndCleanupLocationState(telegramId);
      }

      await ctx.reply(
        '📍 **Mode Lokasi Diaktifkan**\n\n' +
          '**Perintah yang tersedia:**\n' +
          '• `/alamat [alamat]` - Mendapatkan koordinat dari alamat\n' +
          '• `/koordinat [lat] [lon]` - Mendapatkan alamat dari koordinat\n' +
          '• `/show_map [lokasi]` - Menampilkan peta lokasi\n' +
          '• `/show_jarak` - Pengukuran jarak detail (max 1km)\n' +
          '• `/ukur` - Mengukur jarak antara dua titik (pejalan kaki)\n' +
          '• `/ukur_mobil` - Mengukur jarak untuk mobil\n' +
          '• `/ukur_motor` - Mengukur jarak untuk motor\n' +
          '• `/batal` - Membatalkan pengukuran aktif\n\n' +
          '**Anda juga dapat:**\n' +
          '• Mengirim lokasi Telegram untuk mendapatkan informasi lengkap\n' +
          '• Mengirim koordinat (contoh: -7.6382862, 112.7372882)\n\n' +
          `🗝️ Google Maps API: ${this.mapsApiKey ? '✅ Configured' : '❌ Not configured'}\n\n` +
          'Ketik /menu untuk kembali ke menu utama.',
        { parse_mode: 'Markdown' }
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'activate_location_mode',
        mode: 'location',
        success: true,
      });
    } catch (error) {
      this.logger.error('Location command failed', { error, telegramId: ctx.from?.id });
      await ctx.reply('❌ Terjadi kesalahan saat mengaktifkan mode lokasi.');
    }
  }

  /**
   * Handle /alamat command to get coordinates from address
   */
  async handleAlamatCommand(ctx: LocationContext, addressQuery?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      if (!addressQuery) {
        await ctx.reply('Silakan masukkan alamat yang valid.\nContoh: `/alamat Monas Jakarta`', {
          parse_mode: 'Markdown',
        });
        return;
      }

      await ctx.reply(`🔍 Mencari koordinat untuk alamat: ${addressQuery}...`);

      const coordinates = await this.geocodeAddress(addressQuery);
      if (!coordinates) {
        await ctx.reply('❌ Tidak dapat menemukan koordinat untuk alamat tersebut.');
        return;
      }

      // Send location
      await ctx.replyWithLocation(coordinates.latitude, coordinates.longitude);

      // Send detailed info with Google Maps link
      const googleMapsUrl = `https://maps.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;

      await ctx.reply(
        `📍 Koordinat untuk "${coordinates.address}":\n` +
          `Latitude: ${coordinates.latitude}\n` +
          `Longitude: ${coordinates.longitude}\n` +
          `Lihat gmaps nya\n` +
          `${googleMapsUrl}`
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'geocode_address',
        mode: 'location',
        details: { query: addressQuery, found: true },
        success: true,
      });
    } catch (error) {
      this.logger.error('Alamat command failed', { error, addressQuery, telegramId: ctx.from?.id });
      await ctx.reply('❌ Terjadi kesalahan saat mencari koordinat.');
    }
  }

  /**
   * Handle /koordinat command to get address from coordinates
   */
  async handleKoordinatCommand(ctx: LocationContext, lat?: string, lon?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      if (!lat || !lon) {
        await ctx.reply(
          'Silakan masukkan koordinat yang valid.\nContoh: `/koordinat -6.200000 106.816666`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        await ctx.reply('❌ Koordinat tidak valid. Pastikan menggunakan format angka decimal.');
        return;
      }

      await ctx.reply(`🔍 Mencari alamat untuk koordinat: ${latitude}, ${longitude}...`);

      const address = await this.reverseGeocode(latitude, longitude);
      if (!address) {
        await ctx.reply('❌ Tidak dapat menemukan alamat untuk koordinat tersebut.');
        return;
      }

      // Send location
      await ctx.replyWithLocation(latitude, longitude);

      await ctx.reply(
        `📍 **Alamat ditemukan:**\n` +
          `**Alamat:** ${address}\n` +
          `**Latitude:** ${latitude}\n` +
          `**Longitude:** ${longitude}`,
        { parse_mode: 'Markdown' }
      );

      // Save to cache
      await this.saveLocationCache(telegramId, {
        query: `${latitude},${longitude}`,
        result: { latitude, longitude, address },
        timestamp: new Date().toISOString(),
      });

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'reverse_geocode',
        mode: 'location',
        details: { latitude, longitude, found: true },
        success: true,
      });
    } catch (error) {
      this.logger.error('Koordinat command failed', { error, lat, lon });
      await ctx.reply('❌ Terjadi kesalahan saat mencari alamat.');
    }
  }

  /**
   * Handle /show_map command to display map
   */
  async handleShowMapCommand(ctx: LocationContext, locationQuery?: string) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      if (!locationQuery) {
        await ctx.reply(
          'Silakan masukkan lokasi untuk ditampilkan.\nContoh: `/show_map -6.200000,106.816666` atau `/show_map Monas Jakarta`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let latitude: number, longitude: number;

      // Check if it's coordinates format
      const coordMatch = locationQuery.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1]);
        longitude = parseFloat(coordMatch[2]);
      } else {
        // Geocode the location
        const coordinates = await this.geocodeAddress(locationQuery);
        if (!coordinates) {
          await ctx.reply('❌ Tidak dapat menemukan lokasi tersebut.');
          return;
        }
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      }

      await ctx.reply('🗺️ Membuat peta...');

      // Generate map image using Google Maps Static API
      const mapImageBuffer = await this.generateMapImage(latitude, longitude);

      await ctx.replyWithPhoto(
        { source: mapImageBuffer },
        {
          caption: `🗺️ **Peta Lokasi**\n**Koordinat:** ${latitude}, ${longitude}`,
          parse_mode: 'Markdown',
        }
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'show_map',
        mode: 'location',
        details: { latitude, longitude, query: locationQuery },
        success: true,
      });
    } catch (error) {
      this.logger.error('Show map command failed', { error, locationQuery });
      await ctx.reply('❌ Terjadi kesalahan saat membuat peta.');
    }
  }

  /**
   * Handle measurement commands (/ukur, /ukur_mobil, /ukur_transit)
   */
  async handleUkurCommand(
    ctx: LocationContext,
    transportMode: 'walking' | 'driving' | 'motorcycling' = 'walking'
  ) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      const state = this.getUserLocationState(telegramId);

      // Cancel any existing measurement
      if (state.isActive) {
        state.isActive = false;
      }

      // Start new measurement
      state.isActive = true;
      state.transportMode = transportMode;
      state.timestamp = Date.now();
      delete state.firstPoint;
      delete state.secondPoint;

      const modeText = {
        walking: 'Pejalan Kaki 🚶‍♂️',
        driving: 'Mobil 🚗',
        motorcycling: 'Motor 🏍️',
      };

      await ctx.reply(
        `📏 **Pengukuran Jarak Diaktifkan**\n` +
          `**Mode:** ${modeText[transportMode]}\n\n` +
          `Silakan kirim lokasi **PERTAMA** yang ingin diukur jaraknya.\n` +
          `Anda dapat mengirim:\n` +
          `• Lokasi Telegram (bagikan lokasi)\n` +
          `• Koordinat (contoh: -6.200000 106.816666)\n\n` +
          `Ketik /batal untuk membatalkan pengukuran.`,
        { parse_mode: 'Markdown' }
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_measurement',
        mode: 'location',
        details: { transportMode },
        success: true,
      });
    } catch (error) {
      this.logger.error('Ukur command failed', { error, transportMode });
      await ctx.reply('❌ Terjadi kesalahan saat memulai pengukuran.');
    }
  }

  /**
   * Handle /batal command to cancel measurement
   */
  /**
   * Handle /show_jarak command for detailed short distance measurement (max 1km)
   */
  async handleShowJarakCommand(ctx: LocationContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      const state = this.getUserLocationState(telegramId);

      // Cancel any existing measurement
      if (state.isActive) {
        state.isActive = false;
      }

      // Start new short distance measurement
      state.isActive = true;
      state.transportMode = 'walking'; // Default to walking for short distances
      state.timestamp = Date.now();
      delete state.firstPoint;
      delete state.secondPoint;

      // Mark this as a show_jarak session
      this.showJarakSessions.add(telegramId);

      await ctx.reply(
        `📏 **Pengukuran Jarak Detail Diaktifkan**\n` +
          `**Maksimal:** 1 kilometer\n` +
          `**Mode:** Pejalan Kaki 🚶‍♂️\n\n` +
          `Silakan kirim lokasi **PERTAMA** yang ingin diukur jaraknya.\n` +
          `Anda dapat mengirim:\n` +
          `• Lokasi Telegram (bagikan lokasi)\n` +
          `• Koordinat (contoh: -6.200000 106.816666)\n\n` +
          `Ketik /batal untuk membatalkan pengukuran.\n\n` +
          `*Catatan: Fitur ini khusus untuk jarak pendek dengan detail tinggi*`,
        { parse_mode: 'Markdown' }
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'start_short_distance_measurement',
        mode: 'location',
        details: { maxDistance: 1000 },
        success: true,
      });
    } catch (error) {
      this.logger.error('Show jarak command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memulai pengukuran jarak detail.');
    }
  }

  /**
   * Handle /batal command to cancel measurement
   */
  async handleBatalCommand(ctx: LocationContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') {
        await ctx.reply(
          'Anda harus berada dalam mode Lokasi untuk menggunakan perintah ini. Ketik /location untuk masuk ke mode Lokasi.'
        );
        return;
      }

      const state = this.getUserLocationState(telegramId);

      if (!state.isActive) {
        await ctx.reply('❌ Tidak ada pengukuran aktif untuk dibatalkan.');
        return;
      }

      // Cancel measurement
      state.isActive = false;
      delete state.firstPoint;
      delete state.secondPoint;
      delete state.transportMode;

      // Remove from show_jarak sessions if applicable
      this.showJarakSessions.delete(telegramId);

      await ctx.reply('✅ Pengukuran dibatalkan.');

      // Record activity
      await this.recordActivity({
        userId: ctx.user.id,
        telegramId,
        action: 'cancel_measurement',
        mode: 'location',
        success: true,
      });
    } catch (error) {
      this.logger.error('Batal command failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat membatalkan pengukuran.');
    }
  }

  /**
   * Handle location messages for measurement or location info
   */
  async handleLocation(ctx: LocationContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') return;

      const message = ctx.message as any;
      if (!message.location) return;

      const receivedLocation = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
      };

      const state = this.getUserLocationState(telegramId);

      if (state.isActive) {
        // Handle measurement flow
        await this.handleMeasurementLocation(ctx, receivedLocation);
      } else {
        // Handle regular location info
        await this.handleLocationInfo(ctx, receivedLocation);
      }
    } catch (error) {
      this.logger.error('Location handling failed', { error });
      await ctx.reply('❌ Terjadi kesalahan saat memproses lokasi.');
    }
  }

  /**
   * Handle text messages that might be coordinates
   */
  async handleText(ctx: LocationContext) {
    try {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId || !ctx.user) return;

      const userMode = ctx.getUserMode?.();
      if (userMode !== 'location') return;

      const message = ctx.message as any;
      const text = message.text?.trim();

      if (!text) return;

      // Check if text contains coordinates pattern (space or comma separated)
      const coordMatch = text.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const latitude = parseFloat(coordMatch[1]);
        const longitude = parseFloat(coordMatch[2]);

        if (!isNaN(latitude) && !isNaN(longitude)) {
          const location = { latitude, longitude };

          const state = this.getUserLocationState(telegramId);
          if (state.isActive) {
            await this.handleMeasurementLocation(ctx, location);
          } else {
            await this.handleCoordinateInput(ctx, location);
          }
        }
      }
    } catch (error) {
      this.logger.error('Text handling failed', { error });
    }
  }

  // Private helper methods
  private async geocodeAddress(
    address: string
  ): Promise<{ latitude: number; longitude: number; address: string } | null> {
    try {
      if (!this.mapsApiKey) {
        this.logger.warn('MAPS_API_KEY not configured, cannot geocode address');
        return null;
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: this.mapsApiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Geocoding failed', { error, address });
      return null;
    }
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      if (!this.mapsApiKey) {
        this.logger.warn('MAPS_API_KEY not configured, cannot reverse geocode');
        return null;
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.mapsApiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }

      return null;
    } catch (error) {
      this.logger.error('Reverse geocoding failed', { error, latitude, longitude });
      return null;
    }
  }

  private async generateMapImage(latitude: number, longitude: number): Promise<Buffer> {
    try {
      if (!this.mapsApiKey) {
        throw new Error('MAPS_API_KEY not configured');
      }

      const mapUrl = 'https://maps.googleapis.com/maps/api/staticmap';
      const params = {
        center: `${latitude},${longitude}`,
        zoom: '15',
        size: '600x400',
        maptype: 'roadmap',
        markers: `color:red|${latitude},${longitude}`,
        key: this.mapsApiKey,
      };

      const response = await axios.get(mapUrl, {
        params,
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Map generation failed', { error, latitude, longitude });
      // Generate fallback image
      return this.generateFallbackMap();
    }
  }

  private async generateRouteMap(
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    distance: number,
    transportMode: 'walking' | 'driving' | 'motorcycling'
  ): Promise<Buffer> {
    try {
      if (!this.mapsApiKey) {
        return this.generateFallbackRouteMap(firstPoint, secondPoint, distance);
      }

      // Calculate optimal zoom level based on distance
      const zoom = this.calculateOptimalZoom(distance);

      // Get directions for polyline
      const directionsResponse = await this.getDirectionsWithPolyline(
        firstPoint,
        secondPoint,
        transportMode
      );

      const mapUrl = 'https://maps.googleapis.com/maps/api/staticmap';
      const params: any = {
        size: '800x600',
        maptype: 'roadmap',
        key: this.mapsApiKey,
        zoom: zoom.toString(),
      };

      // Add markers for start and end points
      params.markers = [
        `color:green|label:A|${firstPoint.latitude},${firstPoint.longitude}`,
        `color:red|label:B|${secondPoint.latitude},${secondPoint.longitude}`,
      ];

      // Add polyline if available
      if (directionsResponse && directionsResponse.polyline) {
        params.path = `enc:${directionsResponse.polyline}`;
      }

      // Set center point to middle of the two points
      const centerLat = (firstPoint.latitude + secondPoint.latitude) / 2;
      const centerLng = (firstPoint.longitude + secondPoint.longitude) / 2;
      params.center = `${centerLat},${centerLng}`;

      this.logger.info('Generating route map', { params, distance, zoom });

      const response = await axios.get(mapUrl, {
        params,
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Route map generation failed', { error, firstPoint, secondPoint });
      return this.generateFallbackRouteMap(firstPoint, secondPoint, distance);
    }
  }

  private calculateOptimalZoom(distanceInMeters: number): number {
    // Calculate zoom level based on distance
    if (distanceInMeters < 1000) return 15; // < 1km: very detailed
    if (distanceInMeters < 5000) return 13; // < 5km: detailed
    if (distanceInMeters < 10000) return 12; // < 10km: normal
    if (distanceInMeters < 25000) return 11; // < 25km: wide view
    if (distanceInMeters < 50000) return 10; // < 50km: city level
    if (distanceInMeters < 100000) return 9; // < 100km: regional
    if (distanceInMeters < 250000) return 8; // < 250km: province level
    return 7; // > 250km: very wide view
  }

  private async getDirectionsWithPolyline(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: 'walking' | 'driving' | 'motorcycling'
  ): Promise<{ polyline: string } | null> {
    try {
      const apiMode = mode === 'motorcycling' ? 'driving' : mode;

      const params: any = {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: apiMode,
        key: this.mapsApiKey,
      };

      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params,
        timeout: 10000,
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          polyline: route.overview_polyline.points,
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Polyline directions failed', { error });
      return null;
    }
  }

  private async generateFallbackRouteMap(
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    distance: number
  ): Promise<Buffer> {
    // Create a simple fallback image with route info
    const distanceText =
      distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`;

    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f0f0f0"/>
        
        <!-- Header -->
        <rect width="800" height="60" fill="#4285f4"/>
        <text x="400" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="white" font-weight="bold">
          Peta Rute - ${distanceText}
        </text>
        
        <!-- Start Point -->
        <circle cx="200" cy="200" r="15" fill="green"/>
        <text x="200" y="225" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="black" font-weight="bold">A</text>
        <text x="200" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#666">Titik Awal</text>
        
        <!-- End Point -->
        <circle cx="600" cy="400" r="15" fill="red"/>
        <text x="600" y="425" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="black" font-weight="bold">B</text>
        <text x="600" y="445" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#666">Titik Tujuan</text>
        
        <!-- Route Line -->
        <line x1="200" y1="200" x2="600" y2="400" stroke="#4285f4" stroke-width="4" stroke-dasharray="10,5"/>
        
        <!-- Distance Info -->
        <rect x="300" y="285" width="200" height="50" rx="10" fill="white" stroke="#ddd" stroke-width="2"/>
        <text x="400" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="black" font-weight="bold">
          Jarak: ${distanceText}
        </text>
        <text x="400" y="325" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#666">
          Google Maps tidak tersedia
        </text>
        
        <!-- Footer -->
        <text x="400" y="580" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#999">
          TeleWeb Location Service
        </text>
      </svg>
    `;
    return Buffer.from(svg);
  }

  private async generateDetailedShortDistanceMap(
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    distance: number
  ): Promise<Buffer> {
    try {
      if (!this.mapsApiKey) {
        return this.generateFallbackDetailedMap(firstPoint, secondPoint, distance);
      }

      // Validate distance (max 1km)
      if (distance > 1000) {
        throw new Error('Distance exceeds 1km limit for detailed view');
      }

      // Calculate very detailed zoom level for short distances
      let zoom = 18; // Very detailed
      if (distance > 500)
        zoom = 17; // 500m-1km
      else if (distance > 200)
        zoom = 18; // 200m-500m
      else if (distance > 100)
        zoom = 19; // 100m-200m
      else zoom = 20; // < 100m (maximum detail)

      const mapUrl = 'https://maps.googleapis.com/maps/api/staticmap';
      const params: any = {
        size: '1024x768', // Larger size for better detail
        maptype: 'roadmap',
        key: this.mapsApiKey,
        zoom: zoom.toString(),
      };

      // Add detailed markers with correct format
      params.markers = [
        `color:green|size:mid|label:1|${firstPoint.latitude},${firstPoint.longitude}`,
        `color:red|size:mid|label:2|${secondPoint.latitude},${secondPoint.longitude}`,
      ];

      // Try to get walking polyline for more accurate path
      const walkingPolyline = await this.getDirectionsWithPolyline(
        firstPoint,
        secondPoint,
        'walking'
      );

      if (walkingPolyline && walkingPolyline.polyline) {
        // Use actual walking path
        params.path = `color:blue|weight:4|enc:${walkingPolyline.polyline}`;
      } else {
        // Fallback to straight line
        params.path = `color:blue|weight:3|${firstPoint.latitude},${firstPoint.longitude}|${secondPoint.latitude},${secondPoint.longitude}`;
      }

      // Set center point to middle of the two points
      const centerLat = (firstPoint.latitude + secondPoint.latitude) / 2;
      const centerLng = (firstPoint.longitude + secondPoint.longitude) / 2;
      params.center = `${centerLat},${centerLng}`;

      this.logger.info('Generating detailed short distance map', { params, distance, zoom });

      // Create URL with proper marker handling
      const baseUrl = new URL(mapUrl);
      baseUrl.searchParams.set('size', params.size);
      baseUrl.searchParams.set('maptype', params.maptype);
      baseUrl.searchParams.set('key', params.key);
      baseUrl.searchParams.set('zoom', params.zoom);
      baseUrl.searchParams.set('center', params.center);

      // Add each marker separately
      baseUrl.searchParams.append('markers', params.markers[0]);
      baseUrl.searchParams.append('markers', params.markers[1]);

      // Add path
      baseUrl.searchParams.set('path', params.path);

      const response = await axios.get(baseUrl.toString(), {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Detailed map generation failed', { error, firstPoint, secondPoint });
      return this.generateFallbackDetailedMap(firstPoint, secondPoint, distance);
    }
  }

  private async generateFallbackDetailedMap(
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    distance: number
  ): Promise<Buffer> {
    const distanceText = `${Math.round(distance)} meter`;

    const svg = `
      <svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="768" fill="#f8f9fa"/>
        
        <!-- Header -->
        <rect width="1024" height="80" fill="#28a745"/>
        <text x="512" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="white" font-weight="bold">
          Pengukuran Jarak Detail - ${distanceText}
        </text>
        
        <!-- Grid Background -->
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e9ecef" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="1024" height="688" y="80" fill="url(#grid)"/>
        
        <!-- Scale indicator -->
        <text x="50" y="120" font-family="Arial, sans-serif" font-size="14" fill="#495057" font-weight="bold">
          Skala: 1 kotak = 10 meter (perkiraan)
        </text>
        
        <!-- Point 1 -->
        <circle cx="300" cy="300" r="20" fill="#28a745" stroke="white" stroke-width="3"/>
        <text x="300" y="307" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">1</text>
        <rect x="200" y="330" width="200" height="60" rx="5" fill="white" stroke="#28a745" stroke-width="2"/>
        <text x="300" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#28a745" font-weight="bold">
          TITIK AWAL
        </text>
        <text x="300" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
          ${firstPoint.latitude.toFixed(6)}
        </text>
        <text x="300" y="385" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
          ${firstPoint.longitude.toFixed(6)}
        </text>
        
        <!-- Point 2 -->
        <circle cx="724" cy="500" r="20" fill="#dc3545" stroke="white" stroke-width="3"/>
        <text x="724" y="507" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">2</text>
        <rect x="624" y="530" width="200" height="60" rx="5" fill="white" stroke="#dc3545" stroke-width="2"/>
        <text x="724" y="550" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#dc3545" font-weight="bold">
          TITIK TUJUAN
        </text>
        <text x="724" y="570" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
          ${secondPoint.latitude.toFixed(6)}
        </text>
        <text x="724" y="585" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6c757d">
          ${secondPoint.longitude.toFixed(6)}
        </text>
        
        <!-- Distance Line -->
        <line x1="300" y1="300" x2="724" y2="500" stroke="#007bff" stroke-width="4" stroke-dasharray="8,4"/>
        
        <!-- Distance Info Box -->
        <rect x="412" y="350" width="200" height="80" rx="10" fill="white" stroke="#007bff" stroke-width="3"/>
        <text x="512" y="375" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#007bff" font-weight="bold">
          JARAK
        </text>
        <text x="512" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#dc3545" font-weight="bold">
          ${distanceText}
        </text>
        <text x="512" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6c757d">
          Jarak lurus udara
        </text>
        
        <!-- Footer -->
        <rect width="1024" height="40" y="728" fill="#6c757d"/>
        <text x="512" y="752" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="white">
          TeleWeb Location Service - Pengukuran Detail (Google Maps tidak tersedia)
        </text>
      </svg>
    `;
    return Buffer.from(svg);
  }

  private async generateFallbackMap(): Promise<Buffer> {
    // Create a simple fallback image
    const svg = `
      <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#e0e0e0"/>
        <text x="300" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#666">
          Peta tidak tersedia
        </text>
        <text x="300" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#666">
          Google Maps API tidak dikonfigurasi
        </text>
      </svg>
    `;
    return Buffer.from(svg);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  private async getDirections(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: 'walking' | 'driving' | 'motorcycling'
  ): Promise<{ distance: number; duration: number; traffic?: string } | null> {
    try {
      if (!this.mapsApiKey) {
        // Fallback to direct distance calculation
        const distance = this.calculateDistance(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
        );
        return { distance, duration: (distance / 50) * 3.6, traffic: '' }; // Rough estimation
      }

      // Map internal modes to Google API modes
      let apiMode = mode;
      // let routeType = ''; // Reserved for future route type display

      if (mode === 'motorcycling') {
        apiMode = 'driving';
        // routeType = 'motorcycle';
      } else if (mode === 'driving') {
        // routeType = 'car';
      }

      const params: any = {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: apiMode,
        key: this.mapsApiKey,
        alternatives: false,
        units: 'metric',
      };

      // Add traffic model and departure time for driving modes
      if (apiMode === 'driving') {
        params.departure_time = 'now';
        params.traffic_model = 'best_guess';
      }

      this.logger.info('Calling Google Directions API', {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: apiMode,
      });

      this.logger.info('Directions API request params', { params });

      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params,
        timeout: 10000,
      });

      this.logger.info('Google Directions API response', {
        status: response.data.status,
        routesCount: response.data.routes?.length || 0,
        errorMessage: response.data.error_message || null,
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const leg = route.legs[0];

        let traffic = '';

        if (apiMode === 'driving' && leg.duration_in_traffic) {
          // For driving modes (car and motorcycle), check traffic
          const normalDuration = leg.duration.value;
          const trafficDuration = leg.duration_in_traffic.value;
          const delay = trafficDuration - normalDuration;

          if (delay > 300) {
            // More than 5 minutes delay
            traffic = `⚠️ Kemacetan: +${Math.round(delay / 60)} menit`;
          } else if (delay > 60) {
            // 1-5 minutes delay
            traffic = `🟡 Lalu lintas padat: +${Math.round(delay / 60)} menit`;
          } else {
            traffic = `✅ Lalu lintas lancar`;
          }
        } else if (apiMode === 'walking') {
          // For walking, always show smooth traffic
          traffic = `✅ Lalu lintas lancar`;
        }

        let finalDuration = leg.duration_in_traffic?.value || leg.duration.value;

        // Adjust duration for motorcycles (typically 15-20% faster than cars)
        if (mode === 'motorcycling') {
          finalDuration = Math.round(finalDuration * 0.8); // 20% faster
        }

        return {
          distance: leg.distance.value, // in meters
          duration: finalDuration, // in seconds with traffic adjustment
          traffic,
        };
      }

      this.logger.warn('No routes found in Directions API response', {
        status: response.data.status,
      });
      return null;
    } catch (error) {
      this.logger.error('Directions API failed', {
        error: (error as Error).message,
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mode,
      });

      // Fallback to direct distance
      const distance = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      // Estimate duration based on mode
      let estimatedDuration = 0;
      if (mode === 'walking') {
        estimatedDuration = distance / 1.4; // 1.4 m/s average walking speed
      } else if (mode === 'driving') {
        estimatedDuration = distance / 13.89; // 50 km/h average city speed
      } else if (mode === 'motorcycling') {
        estimatedDuration = distance / 11.11; // 40 km/h average motorcycle speed
      }

      return { distance, duration: estimatedDuration, traffic: '' };
    }
  }

  private async handleMeasurementLocation(
    ctx: LocationContext,
    location: { latitude: number; longitude: number }
  ) {
    const telegramId = ctx.from!.id.toString();
    const state = this.getUserLocationState(telegramId);

    // Get address for the location
    const address = await this.reverseGeocode(location.latitude, location.longitude);

    if (!state.firstPoint) {
      // First point
      state.firstPoint = {
        ...location,
        address: address || 'Alamat tidak diketahui',
      };

      await ctx.reply(
        `✅ **Titik PERTAMA diterima:**\n` +
          `📍 ${state.firstPoint.address}\n` +
          `📐 ${location.latitude}, ${location.longitude}\n\n` +
          `Sekarang kirim lokasi **KEDUA** untuk mengukur jarak.`,
        { parse_mode: 'Markdown' }
      );
    } else if (!state.secondPoint) {
      // Second point - complete measurement
      state.secondPoint = {
        ...location,
        address: address || 'Alamat tidak diketahui',
      };

      await ctx.reply('⏳ Menghitung jarak dan rute...');

      // Calculate straight-line distance for validation
      const straightDistance = this.calculateDistance(
        state.firstPoint.latitude,
        state.firstPoint.longitude,
        state.secondPoint.latitude,
        state.secondPoint.longitude
      );

      // Check if this is a show_jarak session (detect by checking if it was started with walking mode and has specific marker)
      const isShowJarakMode =
        state.transportMode === 'walking' &&
        straightDistance <= 1000 &&
        this.isShowJarakSession(telegramId);

      if (isShowJarakMode) {
        // Validate 1km limit for show_jarak
        if (straightDistance > 1000) {
          await ctx.reply(
            `❌ **Jarak terlalu jauh untuk mode detail!**\n\n` +
              `📏 Jarak: ${(straightDistance / 1000).toFixed(2)} km\n` +
              `📋 Maksimal: 1.00 km\n\n` +
              `Silakan pilih titik yang lebih dekat atau gunakan /ukur untuk jarak jauh.`,
            { parse_mode: 'Markdown' }
          );

          // Reset state but keep active for retry
          delete state.firstPoint;
          delete state.secondPoint;
          return;
        }

        // Send detailed short distance results
        await this.sendDetailedShortDistanceResults(
          ctx,
          state.firstPoint,
          state.secondPoint,
          straightDistance
        );
      } else {
        // Regular measurement mode
        const directions = await this.getDirections(
          state.firstPoint,
          state.secondPoint,
          state.transportMode!
        );

        if (directions) {
          await this.sendMeasurementResults(
            ctx,
            state.firstPoint,
            state.secondPoint,
            directions,
            state.transportMode!
          );
        } else {
          await ctx.reply('❌ Tidak dapat menghitung rute. Menggunakan jarak lurus.');
          await this.sendMeasurementResults(
            ctx,
            state.firstPoint,
            state.secondPoint,
            { distance: straightDistance, duration: 0 },
            state.transportMode!
          );
        }
      }

      // Save last measurement
      this.lastMeasurements.set(telegramId, {
        firstPoint: state.firstPoint,
        secondPoint: state.secondPoint,
        timestamp: Date.now(),
      });

      // Reset state
      state.isActive = false;
      delete state.firstPoint;
      delete state.secondPoint;
    }
  }

  private async handleCoordinateInput(
    ctx: LocationContext,
    location: { latitude: number; longitude: number }
  ) {
    const telegramId = ctx.from!.id.toString();

    // Send location first
    await ctx.replyWithLocation(location.latitude, location.longitude);

    // Get address and send as separate message
    const address = await this.reverseGeocode(location.latitude, location.longitude);
    if (address) {
      await ctx.reply(`Alamat: ${address}`);
    }

    // Save to cache and record activity
    await this.saveLocationCache(telegramId, {
      query: `${location.latitude},${location.longitude}`,
      result: { ...location, address: address || 'Unknown' },
      timestamp: new Date().toISOString(),
    });

    await this.recordActivity({
      userId: ctx.user!.id,
      telegramId,
      action: 'coordinate_input',
      mode: 'location',
      details: location,
      success: true,
    });
  }

  private async handleLocationInfo(
    ctx: LocationContext,
    location: { latitude: number; longitude: number }
  ) {
    const telegramId = ctx.from!.id.toString();

    await ctx.reply('🔍 Menganalisis lokasi...');

    const address = await this.reverseGeocode(location.latitude, location.longitude);

    await ctx.reply(
      `📍 Informasi Lokasi:\n` +
        `Latitude,Longitude: \`${location.latitude}, ${location.longitude}\`\n\n` +
        `Alamat: ${address || 'Alamat tidak diketahui'}\n\n` +
        `\`/koordinat ${location.latitude} ${location.longitude}\``,
      { parse_mode: 'Markdown' }
    );

    // Save to cache
    await this.saveLocationCache(telegramId, {
      query: `${location.latitude},${location.longitude}`,
      result: { ...location, address: address || 'Unknown' },
      timestamp: new Date().toISOString(),
    });

    // Record activity
    await this.recordActivity({
      userId: ctx.user!.id,
      telegramId,
      action: 'location_info',
      mode: 'location',
      details: location,
      success: true,
    });
  }

  private async sendMeasurementResults(
    ctx: LocationContext,
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    directions: { distance: number; duration: number; traffic?: string },
    transportMode: 'walking' | 'driving' | 'motorcycling'
  ) {
    const telegramId = ctx.from!.id.toString();

    const formatDistance = (meters: number): string => {
      if (meters < 1000) return `${Math.round(meters)} m`;
      return `${(meters / 1000).toFixed(2)} km`;
    };

    const formatDuration = (seconds: number): string => {
      if (seconds === 0) return 'Tidak tersedia';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}j ${minutes}m`;
      return `${minutes}m`;
    };

    const modeEmoji = {
      walking: '🚶‍♂️',
      driving: '🚗',
      motorcycling: '🏍️',
    };

    const modeText = {
      walking: 'Pejalan Kaki',
      driving: 'Mobil',
      motorcycling: 'Motor',
    };

    // Generate Google Maps link
    const travelMode = transportMode === 'motorcycling' ? 'driving' : transportMode;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${firstPoint.latitude},${firstPoint.longitude}&destination=${secondPoint.latitude},${secondPoint.longitude}&travelmode=${travelMode}`;

    let message =
      `📏 Hasil Pengukuran Jarak\n\n` +
      `${modeEmoji[transportMode]} Mode: ${modeText[transportMode]}\n\n` +
      `📍 Titik Awal:\n${firstPoint.address}\n` +
      `📐 ${firstPoint.latitude}, ${firstPoint.longitude}\n\n` +
      `📍 Titik Tujuan:\n${secondPoint.address}\n` +
      `📐 ${secondPoint.latitude}, ${secondPoint.longitude}\n\n` +
      `📏 Jarak: ${formatDistance(directions.distance)}\n` +
      `⏱️ Waktu Tempuh: ${formatDuration(directions.duration)}\n`;

    // Add traffic info if available
    if (directions.traffic) {
      message += `🚦 ${directions.traffic}\n`;
    }

    message += `\nPowered by Google Maps API`;

    // Generate and send route map
    try {
      const routeMapBuffer = await this.generateRouteMap(
        firstPoint,
        secondPoint,
        directions.distance,
        transportMode
      );
      await ctx.replyWithPhoto(
        { source: routeMapBuffer },
        {
          caption: message,
          reply_markup: {
            inline_keyboard: [[{ text: '🗺️ Lihat Rute di Google Maps', url: googleMapsUrl }]],
          },
        }
      );
    } catch (error) {
      this.logger.error('Failed to send route map', { error });
      // Fallback to text message only
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [[{ text: '🗺️ Lihat Rute di Google Maps', url: googleMapsUrl }]],
        },
      });
    }

    // Record activity
    await this.recordActivity({
      userId: ctx.user!.id,
      telegramId,
      action: 'complete_measurement',
      mode: 'location',
      details: {
        transportMode,
        distance: directions.distance,
        duration: directions.duration,
        firstPoint,
        secondPoint,
      },
      success: true,
    });
  }

  private isShowJarakSession(telegramId: string): boolean {
    return this.showJarakSessions.has(telegramId);
  }

  private async sendDetailedShortDistanceResults(
    ctx: LocationContext,
    firstPoint: { latitude: number; longitude: number; address?: string },
    secondPoint: { latitude: number; longitude: number; address?: string },
    straightDistance: number
  ) {
    const telegramId = ctx.from!.id.toString();

    try {
      await ctx.reply('⏳ Menghitung rute jalan kaki...');

      // Get actual walking directions
      const walkingDirections = await this.getDirections(firstPoint, secondPoint, 'walking');

      let actualDistance = straightDistance;
      let actualDuration = Math.round(straightDistance / 1.4); // fallback duration
      let distanceSource = 'jarak lurus udara';

      if (walkingDirections) {
        actualDistance = walkingDirections.distance;
        actualDuration = walkingDirections.duration;
        distanceSource = 'rute jalan kaki';
      }

      // Generate detailed map using actual walking distance
      const detailedMapBuffer = await this.generateDetailedShortDistanceMap(
        firstPoint,
        secondPoint,
        actualDistance
      );

      const distanceText =
        actualDistance < 1000
          ? `${Math.round(actualDistance)} meter`
          : `${(actualDistance / 1000).toFixed(2)} km`;

      const durationText =
        actualDuration < 60
          ? `${Math.round(actualDuration)} detik`
          : `${Math.round(actualDuration / 60)} menit`;

      const message =
        `📏 **Pengukuran Jarak Detail**\n\n` +
        `📍 **Titik 1:** ${firstPoint.address}\n` +
        `📐 ${firstPoint.latitude}, ${firstPoint.longitude}\n\n` +
        `📍 **Titik 2:** ${secondPoint.address}\n` +
        `📐 ${secondPoint.latitude}, ${secondPoint.longitude}\n\n` +
        `📏 **Jarak:** ${distanceText}\n` +
        `🚶‍♂️ **Waktu Jalan:** ${durationText}\n` +
        `📊 **Metode:** ${distanceSource}\n\n` +
        `*Terimakasih*`;

      await ctx.replyWithPhoto(
        { source: detailedMapBuffer },
        {
          caption: message,
          parse_mode: 'Markdown',
        }
      );

      // Record activity
      await this.recordActivity({
        userId: ctx.user!.id,
        telegramId,
        action: 'detailed_distance_measurement',
        mode: 'location',
        details: {
          straightDistance,
          actualDistance,
          actualDuration,
          distanceSource,
          firstPoint,
          secondPoint,
        },
        success: true,
      });
    } catch (error) {
      this.logger.error('Failed to send detailed distance results', { error });
      await ctx.reply('❌ Terjadi kesalahan saat membuat peta detail.');
    }

    // Reset state and remove from show_jarak sessions
    const state = this.getUserLocationState(telegramId);
    state.isActive = false;
    delete state.firstPoint;
    delete state.secondPoint;
    this.showJarakSessions.delete(telegramId);
  }

  private initUserLocationState(telegramId: string): void {
    this.userStates.set(telegramId, {
      isActive: false,
      timestamp: Date.now(),
    });
  }

  private getUserLocationState(telegramId: string): UserLocationState {
    let state = this.userStates.get(telegramId);
    if (!state) {
      this.initUserLocationState(telegramId);
      state = this.userStates.get(telegramId)!;
    }
    return state;
  }

  private checkAndCleanupLocationState(telegramId: string): boolean {
    const state = this.getUserLocationState(telegramId);
    const now = Date.now();
    const elapsed = now - state.timestamp;

    if (state.isActive && elapsed > this.MEASUREMENT_TIMEOUT_MS) {
      this.logger.info('Measurement timeout cleanup', {
        telegramId,
        elapsed: Math.round(elapsed / 1000),
      });
      this.initUserLocationState(telegramId);
      return true;
    }

    return false;
  }

  private async saveLocationCache(telegramId: string, data: any): Promise<void> {
    try {
      const baseDir = process.env.BOT_API_DATA_PATH || path.join(process.cwd(), 'data-bot-user');
      const userDir = await createUserFeatureDir(baseDir, telegramId, 'location');
      const filename = `${Date.now()}_${data.query.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.json`;
      const filepath = path.join(userDir, filename);

      await fs.writeJson(filepath, data, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save location cache', { error, telegramId });
    }
  }

  /**
   * Record user activity
   */
  private async recordActivity(data: {
    userId: string;
    telegramId: string;
    action: string;
    mode: 'location';
    details?: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      await axios.post(`${this.backendUrl}/activity/record`, data);
    } catch (error) {
      this.logger.warn('Failed to record activity', {
        error: (error as Error).message,
        data,
      });
    }
  }
}
