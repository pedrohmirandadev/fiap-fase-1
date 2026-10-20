import { Vehicle } from '../../src/domain/vehicle/vehicle';
import { VehiclePlate } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type VehicleProps = Parameters<typeof Vehicle.create>[0] & { id: number | undefined };

export function createVehicleFactory(context: FactoryContext) {
  return (overrides: Partial<VehicleProps> = {}): Vehicle => {
    const sequence = context.nextId('vehicle');
    const props = { id: sequence, customerId: 1, plate: context.plate(sequence), brand: 'Honda', model: 'Civic', year: 2022, ...overrides };
    return new Vehicle(props.id, props.customerId, new VehiclePlate(props.plate), props.brand, props.model, props.year);
  };
}
