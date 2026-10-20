import { WorkOrderStatus } from './work-order/status';
import { describe, expect, it } from 'bun:test';
import { assertTransition, canTransition, isValidCpfCnpj, isValidPlate, quoteTotalCents } from './work-order';

describe('regras de domínio da OS', () => {
  it('aceita transições permitidas e rejeita as demais', () => {
    expect(canTransition(WorkOrderStatus.Received, WorkOrderStatus.Diagnosis)).toBe(true);
    expect(canTransition(WorkOrderStatus.Delivered, WorkOrderStatus.Received)).toBe(false);
    expect(() => assertTransition(WorkOrderStatus.Received, WorkOrderStatus.Delivered)).toThrow('Transição inválida');
  });
  it('calcula orçamento em centavos e rejeita quantidades inválidas', () => {
    expect(quoteTotalCents([{ quantity: 2, unitPriceCents: 1000 }, { quantity: 1, unitPriceCents: 500 }])).toBe(2500);
    expect(() => quoteTotalCents([{ quantity: 0, unitPriceCents: 100 }])).toThrow();
  });
  it('valida CPF/CNPJ e placas no padrão Mercosul', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('11111111111')).toBe(false);
    expect(isValidCpfCnpj('12.345.678/0001-95')).toBe(true);
    expect(isValidPlate('ABC1D23')).toBe(true);
    expect(isValidPlate('ABC-1234')).toBe(true);
    expect(isValidPlate('123-ABCD')).toBe(false);
  });
});
