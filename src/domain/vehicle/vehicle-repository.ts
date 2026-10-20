import type { Vehicle } from './vehicle';
export interface VehicleRepository {
  findById(id: number): Promise<Vehicle | undefined>;
  findAll(): Promise<Vehicle[]>;
  save(vehicle: Vehicle): Promise<Vehicle>;
  /** Remove o veículo e suas OS com os respectivos filhos; preserva cliente, estoque e eventos. */
  delete(id: number): Promise<boolean>;
}
