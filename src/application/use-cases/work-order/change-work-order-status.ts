import { WorkOrderStatus } from '../../../domain/work-order/status';
import type { UnitOfWork } from '../../unit-of-work';
import { ApplicationError, ErrorKind } from '../../errors';
import { StartDiagnosis } from './start-diagnosis';
import { SubmitQuote } from './submit-quote';
import { FinishRepair } from './finish-repair';
import { RecordDelivery } from './record-delivery';

/** Adaptador da rota existente; regras e transações pertencem ao handler de cada comando. */
export class ChangeWorkOrderStatus {
  private readonly diagnosis: StartDiagnosis;
  private readonly submit: SubmitQuote;
  private readonly finish: FinishRepair;
  private readonly deliver: RecordDelivery;
  constructor(unitOfWork: UnitOfWork) {
    this.diagnosis = new StartDiagnosis(unitOfWork);
    this.submit = new SubmitQuote(unitOfWork);
    this.finish = new FinishRepair(unitOfWork);
    this.deliver = new RecordDelivery(unitOfWork);
  }
  execute(id: number, target: WorkOrderStatus, note?: string) {
    const command = { workOrderId: id, note };
    switch (target) {
      case WorkOrderStatus.Diagnosis: return this.diagnosis.execute(command);
      case WorkOrderStatus.AwaitingApproval: return this.submit.execute(command);
      case WorkOrderStatus.Finished: return this.finish.execute(command);
      case WorkOrderStatus.Delivered: return this.deliver.execute(command);
      default: throw new ApplicationError(ErrorKind.Conflict, 'Transição inválida; execução exige aprovação do orçamento');
    }
  }
}
