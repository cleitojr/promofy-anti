export interface GeneratedCopy {
  id: string;
  originalLink: string;
  text: string; // Changed back from variations[] to single string
  category: 'TECH' | 'HOME' | 'BEAUTY' | 'FASHION' | 'FOOD' | 'VIRAL' | 'OTHER';
  platform?: 'AMAZON' | 'SHOPEE' | 'MERCADO_LIVRE' | 'MAGALU' | 'ALIEXPRESS' | 'OTHER';
  imageUrl?: string; // The uploaded print/screenshot
  productImageUrl?: string; // The clean product image found by AI
  timestamp: number;
  isError?: boolean;
}

export interface GenerationResponse {
  results: GeneratedCopy[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}