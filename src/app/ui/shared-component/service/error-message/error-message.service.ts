import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {
  getUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (!error) return fallback;

    if (typeof error === 'string') {
      const status = Number(error);
      if (!Number.isNaN(status)) {
        return this.messageFromStatus(status, fallback);
      }
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Unable to reach the server. Please check your internet connection.';
      }

      const serverMessage = this.extractServerMessage(error.error);
      if (serverMessage) return serverMessage;

      return this.messageFromStatus(error.status, fallback);
    }

    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    return fallback;
  }

  private messageFromStatus(status: number, fallback: string): string {
    switch (status) {
      case 400:
      case 422:
        return 'Please check the form details and try again.';
      case 401:
        return 'You are not logged in or your session has expired.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This record already exists or conflicts with existing data.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Server error. Please try again in a few minutes.';
      default:
        return fallback;
    }
  }

  private extractServerMessage(payload: unknown): string | null {
    if (!payload) return null;

    if (typeof payload === 'string') return payload;

    const obj = payload as {
      message?: unknown;
      error?: unknown;
      detail?: unknown;
      title?: unknown;
      errors?: unknown;
    };

    const direct =
      this.asString(obj.message) ||
      this.asString(obj.error) ||
      this.asString(obj.detail) ||
      this.asString(obj.title);
    if (direct) return direct;

    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0] as unknown;
      return this.asString(first) || this.asString((first as { message?: unknown })?.message);
    }

    if (obj.errors && typeof obj.errors === 'object') {
      const errorMap = obj.errors as Record<string, unknown>;
      const firstKey = Object.keys(errorMap)[0];
      if (firstKey) {
        const val = errorMap[firstKey];
        if (Array.isArray(val) && val.length > 0) return this.asString(val[0]);
        return this.asString(val);
      }
    }

    return null;
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return null;
  }
}
