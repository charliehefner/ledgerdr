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

export interface CedulaOcrResult {
  name: string | null;
  cedula: string | null;
  date_of_birth: string | null;
  sex: string | null;
}

interface ScanCedulaButtonProps {
  onResult: (result: CedulaOcrResult) => void;
  disabled?: boolean;
}

export function ScanCedulaButton({ onResult, disabled }: ScanCedulaButtonProps) {
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
      const { data, error } = await supabase.functions.invoke('ocr-cedula', {
        body: { image_base64: base64, file_name: fileName },
      });

      if (error) {
        console.error('OCR cédula error:', error);
        toast.error(`Error al escanear: ${error.message || 'Error desconocido'}`);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      onResult(data);

      const filledFields = [
        data.name && 'Nombre',
        data.cedula && 'Cédula',
        data.date_of_birth && 'Fecha Nac.',
        data.sex && 'Sexo',
      ].filter(Boolean);

      if (filledFields.length > 0) {
        toast.success(`Cédula escaneada: ${filledFields.join(', ')}`);
      } else {
        toast.warning('No se pudieron extraer datos de la cédula. Verifique la imagen.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Error al procesar la cédula');
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
    } catch {
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
    } catch {
      toast.error('No se pudo acceder a la cámara.');
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
      toast.error('No se encontraron cámaras.');
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
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
      stopCamera();
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(async () => {
    setCapturedImage(null);
    const cameras = await loadCameras();
    if (cameras.length > 0) {
      await startCameraWithDevice(selectedCameraId || cameras[0].deviceId);
    }
  }, [loadCameras, selectedCameraId, startCameraWithDevice]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
  }, [stopCamera]);

  const useCapturedPhoto = useCallback(async () => {
    if (!capturedImage) return;
    const base64 = capturedImage.replace(/^data:image\/jpeg;base64,/, '');
    closeCamera();
    await processImage(base64, `cedula-camera-${Date.now()}.jpg`);
  }, [capturedImage]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <canvas ref={canvasRef} className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || isScanning}>
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {isScanning ? 'Escaneando...' : 'Escanear Cédula'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Subir Imagen
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
              Escanear Cédula
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {availableCameras.length > 1 && !capturedImage && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4" />
                  Seleccionar Cámara
                </Label>
                <Select value={selectedCameraId} onValueChange={switchCamera}>
                  <SelectTrigger>
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
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
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
