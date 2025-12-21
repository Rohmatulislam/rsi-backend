export class Banner {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    imageUrl: string;
    link?: string;
    linkText?: string;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
