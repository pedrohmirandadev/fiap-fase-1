import type { RepositoryContext, UnitOfWork } from './application/unit-of-work';
import type { WorkOrderQueries } from './application/work-order-queries';
import { client } from './infrastructure/database/connection';
import { PgUnitOfWork, repositoryContext } from './infrastructure/database/pg-unit-of-work';
import { PgWorkOrderQueries } from './infrastructure/queries/work-order-queries';
import { CreateCustomer } from './application/use-cases/customer/create-customer';
import { GetCustomer } from './application/use-cases/customer/get-customer';
import { ListCustomers } from './application/use-cases/customer/list-customers';
import { UpdateCustomer } from './application/use-cases/customer/update-customer';
import { DeleteCustomer } from './application/use-cases/customer/delete-customer';
import { CreateVehicle } from './application/use-cases/vehicle/create-vehicle';
import { GetVehicle } from './application/use-cases/vehicle/get-vehicle';
import { ListVehicles } from './application/use-cases/vehicle/list-vehicles';
import { UpdateVehicle } from './application/use-cases/vehicle/update-vehicle';
import { DeleteVehicle } from './application/use-cases/vehicle/delete-vehicle';
import { CreateService } from './application/use-cases/service/create-service';
import { GetService } from './application/use-cases/service/get-service';
import { ListServices } from './application/use-cases/service/list-services';
import { UpdateService } from './application/use-cases/service/update-service';
import { DeactivateService } from './application/use-cases/service/deactivate-service';
import { CreatePart } from './application/use-cases/part/create-part';
import { GetPart } from './application/use-cases/part/get-part';
import { ListParts } from './application/use-cases/part/list-parts';
import { UpdatePart } from './application/use-cases/part/update-part';
import { DeactivatePart } from './application/use-cases/part/deactivate-part';
import { AdjustStock } from './application/use-cases/part/adjust-stock';
import { ListPartMovements } from './application/use-cases/part/list-part-movements';
import { CreateWorkshop } from './application/use-cases/workshop/create-workshop';
import { GetWorkshop } from './application/use-cases/workshop/get-workshop';
import { CreateWorkOrder } from './application/use-cases/work-order/create-work-order';
import { ProposeAdditionalRepair } from './application/use-cases/work-order/propose-additional-repair';
import { DecideQuote } from './application/use-cases/work-order/decide-quote';
import { ChangeWorkOrderStatus } from './application/use-cases/work-order/change-work-order-status';
import { GetWorkOrder } from './application/use-cases/work-order/get-work-order';
import { ListWorkOrders } from './application/use-cases/work-order/list-work-orders';
import { TrackWorkOrder } from './application/use-cases/work-order/track-work-order';
import { GetWorkOrderHistory } from './application/use-cases/work-order/get-work-order-history';
import { GetAverageExecutionTime } from './application/use-cases/work-order/get-average-execution-time';
import { AuthenticateAdmin } from './application/use-cases/authenticate-admin';

export function createUseCases(context: RepositoryContext, unitOfWork: UnitOfWork, workOrderQueries: WorkOrderQueries) {
  return {
    customers: { create: new CreateCustomer(context.customers), get: new GetCustomer(context.customers), list: new ListCustomers(context.customers), update: new UpdateCustomer(context.customers), delete: new DeleteCustomer(context.customers) },
    vehicles: { create: new CreateVehicle(context.vehicles, context.customers), get: new GetVehicle(context.vehicles), list: new ListVehicles(context.vehicles), update: new UpdateVehicle(context.vehicles), delete: new DeleteVehicle(context.vehicles) },
    services: { create: new CreateService(context.services), get: new GetService(context.services), list: new ListServices(context.services), update: new UpdateService(context.services), deactivate: new DeactivateService(context.services) },
    parts: { create: new CreatePart(context.parts), get: new GetPart(context.parts), list: new ListParts(context.parts), update: new UpdatePart(context.parts), deactivate: new DeactivatePart(context.parts), adjustStock: new AdjustStock(unitOfWork), movements: new ListPartMovements(context.parts) },
    workshops: { create: new CreateWorkshop(context.workshops), get: new GetWorkshop(context.workshops) },
    workOrders: { create: new CreateWorkOrder(unitOfWork), addItem: new ProposeAdditionalRepair(unitOfWork), decide: new DecideQuote(unitOfWork), changeStatus: new ChangeWorkOrderStatus(unitOfWork), get: new GetWorkOrder(workOrderQueries), list: new ListWorkOrders(workOrderQueries), track: new TrackWorkOrder(workOrderQueries), history: new GetWorkOrderHistory(context.workOrders, workOrderQueries), average: new GetAverageExecutionTime(workOrderQueries) },
    authenticate: new AuthenticateAdmin(context.users)
  };
}

export type UseCases = ReturnType<typeof createUseCases>;
export const useCases = createUseCases(repositoryContext(client), new PgUnitOfWork(), new PgWorkOrderQueries(client));
