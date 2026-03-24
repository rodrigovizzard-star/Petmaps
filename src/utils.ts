import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatWhatsAppLink = (phone: string, message: string) => {
  let cleanedPhone = phone.replace(/\D/g, '');
  // If it's a Brazilian number without country code (10 or 11 digits)
  if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
    cleanedPhone = '55' + cleanedPhone;
  }
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
};

export const maskCpf = (cpf?: string) => {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length < 5) return cpf;
  return `${cleaned.substring(0, 3)}.***.***-${cleaned.substring(cleaned.length - 2)}`;
};
