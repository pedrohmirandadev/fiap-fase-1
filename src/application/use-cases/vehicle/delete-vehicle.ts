import type { VehicleRepository } from '../../../domain/vehicle/vehicle-repository';
import { ApplicationError, ErrorKind } from '../../errors';
export class DeleteVehicle {
  constructor(private readonly repository: VehicleRepository) {}
  async execute(id: number) {
    if (!(await this.repository.delete(id))) throw new ApplicationError(ErrorKind.NotFound, 'Veículo não encontrado');
    return { deleted: true };
  }
}
