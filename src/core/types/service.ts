/**
 * Service Types
 *
 * Domain representations of operating system services.
 */

export type ServiceStatus = 'running' | 'stopped' | 'not_installed' | 'unknown';

export interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  pid?: number;
  startupType?: string;
}
