import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ShiprocketService {
  private token: string | null = null;
  private baseUrl = 'https://apiv2.shiprocket.in/v1/external';

  private async login() {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      });
      this.token = response.data.token;
      return this.token;
    } catch (error) {
      console.error('Shiprocket login failed:', error.response?.data || error.message);
      throw new InternalServerErrorException('Shiprocket authentication failed');
    }
  }

  private async getToken() {
    if (this.token) return this.token;
    return this.login();
  }

  async getTracking(trackingId: string) {
    const token = await this.getToken();
    try {
      const response = await axios.get(`${this.baseUrl}/courier/track/awb/${trackingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error('Shiprocket tracking failed:', error.response?.data || error.message);
      return null;
    }
  }

  async createOrder(orderData: any) {
    const token = await this.getToken();
    try {
      const response = await axios.post(`${this.baseUrl}/orders/create/adhoc`, orderData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error('Shiprocket order creation failed:', error.response?.data || error.message);
      throw new InternalServerErrorException('Shiprocket order creation failed');
    }
  }
}
