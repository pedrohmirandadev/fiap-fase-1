export enum WorkOrderStatus {
  Received = 'RECEIVED',
  Diagnosis = 'DIAGNOSIS',
  AwaitingApproval = 'AWAITING_APPROVAL',
  InProgress = 'IN_PROGRESS',
  Finished = 'FINISHED',
  Delivered = 'DELIVERED'
}

const allowedTransitions: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  [WorkOrderStatus.Received]: [WorkOrderStatus.Diagnosis],
  [WorkOrderStatus.Diagnosis]: [WorkOrderStatus.AwaitingApproval],
  [WorkOrderStatus.AwaitingApproval]: [WorkOrderStatus.InProgress],
  [WorkOrderStatus.InProgress]: [WorkOrderStatus.Finished, WorkOrderStatus.AwaitingApproval],
  [WorkOrderStatus.Finished]: [WorkOrderStatus.Delivered],
  [WorkOrderStatus.Delivered]: []
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
  if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} -> ${to}`);
}
