import { useState, useRef, useCallback } from 'react';
import { Camera, Loader2, FileImage, SwitchCamera, XCircle, Video, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface OcrResult {
  vendor_name: string;
  rnc: string;
  date: string | null;
  amount: number | null;
  itbis: number | null;
  document: string;
  pay_method: string | null;
  description?: string;
  master_acct_code?: string;
  raw_text?: string;
  image_base64?: string;
}

interface ScanReceiptButtonProps {
  onResult: (result: OcrResult) => void;
  disabled?: boolean;
}

export function ScanReceiptButton({ onResult, disabled }: ScanReceiptButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processImage = async (base64: string, fileName: string) => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ocr-receipt', {
        body: { image_base64: base64, file_name: fileName },
      });

      if (error) {
        console.error('OCR error details:', {
          message: error.message,
          name: error.name,
          context: error.context,
          status: error.status,
          full: JSON.stringify(error),
        });
        const isTimeout = error.message?.includes('timed out') || error.message?.includes('timeout');
        const isPayload = error.message?.includes('payload') || error.message?.includes('too large');
        if (isTimeout) {
          toast.error('El escaneo tardó demasiado. Intente con una imagen más pequeña.');
        } else if (isPayload) {
          toast.error('La imagen es demasiado grande. Reduzca el tamaño e intente de nuevo.');
        } else {
          toast.error(`Error al escanear: ${error.message || 'Error desconocido'}. Puede llenar los campos manualmente.`);
        }
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

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
    }
  };

  const fileToBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máx 10MB)');
      return;
    }

    const base64 = await fileToBase64(file);
    await processImage(base64, file.name);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Camera logic
  const loadCameras = useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);

      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
      return videoDevices;
    } catch (error) {
      console.error('Error loading cameras:', error);
      return [];
    }
  }, [selectedCameraId]);

  const startCameraWithDevice = useCallback(async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('No se pudo acceder a la cámara. Verifique los permisos.');
    }
  }, []);

  const openCamera = useCallback(async () => {
    setShowCamera(true);
    setCapturedImage(null);
    setIsCameraActive(false);

    const cameras = await loadCameras();
    if (cameras.length > 0) {
      const cameraToUse = selectedCameraId || cameras[0].deviceId;
      setSelectedCameraId(cameraToUse);
      await startCameraWithDevice(cameraToUse);
    } else {
      toast.error('No se encontraron cámaras en este dispositivo.');
      setShowCamera(false);
    }
  }, [loadCameras, selectedCameraId, startCameraWithDevice]);

  const switchCamera = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    setIsCameraActive(false);
    await startCameraWithDevice(deviceId);
  }, [startCameraWithDevice]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(async () => {
    setCapturedImage(null);
    const cameras = await loadCameras();
    if (cameras.length > 0) {
      const cameraToUse = selectedCameraId || cameras[0].deviceId;
      await startCameraWithDevice(cameraToUse);
    }
  }, [loadCameras, selectedCameraId, startCameraWithDevice]);

  const useCapturedPhoto = useCallback(async () => {
    if (!capturedImage) return;

    // Extract base64 from data URL (strip prefix)
    const base64 = capturedImage.replace(/^data:image\/jpeg;base64,/, '');
    closeCamera();
    await processImage(base64, `receipt-camera-${Date.now()}.jpg`);
  }, [capturedImage]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
  }, [stopCamera]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
      <canvas ref={canvasRef} className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isScanning}
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {isScanning ? 'Escaneando...' : 'Escanear Recibo'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Subir Archivo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCamera}>
            <Camera className="h-4 w-4 mr-2" />
            Tomar Foto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear Recibo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {availableCameras.length > 1 && !capturedImage && (
              <div className="space-y-2">
                <Label htmlFor="ocrCameraSelect" className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4" />
                  Seleccionar Cámara
                </Label>
                <Select value={selectedCameraId} onValueChange={switchCamera}>
                  <SelectTrigger id="ocrCameraSelect">
                    <SelectValue placeholder="Elegir cámara" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCameras.map((camera, index) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!capturedImage ? (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCamera}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>

              {!capturedImage ? (
                <Button type="button" onClick={capturePhoto} disabled={!isCameraActive}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capturar
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={retakePhoto}>
                    <Video className="mr-2 h-4 w-4" />
                    Volver a tomar
                  </Button>
                  <Button type="button" onClick={useCapturedPhoto} disabled={isScanning}>
                    {isScanning ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="mr-2 h-4 w-4" />
                    )}
                    Escanear
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
