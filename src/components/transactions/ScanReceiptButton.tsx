import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface OcrResult {
  vendor_name: string;
  rnc: string;
  date: string | null;
  amount: number | null;
  itbis: number | null;
  document: string;
  pay_method: string | null;
  raw_text?: string;
  image_base64?: string;
}

interface ScanReceiptButtonProps {
  onResult: (result: OcrResult) => void;
  disabled?: boolean;
}

export function ScanReceiptButton({ onResult, disabled }: ScanReceiptButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB for OCR)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máx 10MB)');
      return;
    }

    setIsScanning(true);

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('ocr-receipt', {
        body: {
          image_base64: base64,
          file_name: file.name,
        },
      });

      if (error) {
        console.error('OCR error:', error);
        toast.error('Error al escanear el recibo. Puede llenar los campos manualmente.');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Pass result with image for attachment
      onResult({ ...data, image_base64: base64 });
      
      const filledFields = [
        data.vendor_name && 'Nombre',
        data.amount && 'Monto',
        data.document && 'NCF',
        data.date && 'Fecha',
        data.itbis && 'ITBIS',
        data.rnc && 'RNC',
      ].filter(Boolean);

      if (filledFields.length > 0) {
        toast.success(`Recibo escaneado: ${filledFields.join(', ')}`);
      } else {
        toast.warning('No se pudieron extraer datos del recibo. Verifique la imagen.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Error al procesar el recibo');
    } finally {
      setIsScanning(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isScanning}
        onClick={() => fileInputRef.current?.click()}
      >
        {isScanning ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Camera className="h-4 w-4 mr-2" />
        )}
        {isScanning ? 'Escaneando...' : 'Escanear Recibo'}
      </Button>
    </>
  );
}
