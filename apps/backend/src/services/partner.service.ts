import type { CreatePartnerInput, UpdatePartnerInput } from '@inventario-local/shared/schemas';
import type { PartnerType } from '@inventario-local/shared/types';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';

export interface ListPartnersFilter {
  type?: PartnerType;
  search?: string;
}

export class PartnerService {
  async listPartners(filters: ListPartnersFilter = {}) {
    const search = filters.search?.trim();

    return prisma.partner.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { taxId: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getPartnerById(id: string) {
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      throw new AppError(404, 'Tercero no encontrado.', 'PartnerNotFound');
    }
    return partner;
  }

  async createPartner(input: CreatePartnerInput) {
    return prisma.partner.create({
      data: {
        type: input.type,
        name: input.name,
        taxId: input.taxId ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
      },
    });
  }

  async updatePartner(id: string, input: UpdatePartnerInput) {
    return prisma.partner.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId ?? null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.address !== undefined ? { address: input.address ?? null } : {}),
      },
    });
  }

  async deletePartner(id: string) {
    await prisma.partner.delete({ where: { id } });
    return { deleted: true, id };
  }
}

export const partnerService = new PartnerService();
