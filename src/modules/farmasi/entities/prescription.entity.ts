export class Prescription {
    id: string;
    userId?: string;
    patientName: string;
    patientPhone: string;
    patientRM?: string;
    prescriptionImageUrl?: string;
    deliveryMethod: string;
    address?: string;
    status: string;
    note?: string;
    totalPrice?: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<Prescription>) {
        Object.assign(this, partial);
    }
}
