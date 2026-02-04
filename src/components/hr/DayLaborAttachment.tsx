import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, X, FileImage, Loader2, Camera, Video, XCircle, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DayLaborAttachmentProps {
  weekEndingDate: string; // YYYY-MM-DD format
}

export function DayLaborAttachment({ weekEndingDate }: DayLaborAttachmentProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch existing attachment for this week
  useEffect(() => {
    let isMounted = true;
    
    async function fetchAttachment() {
      if (!weekEndingDate) return;
      
      setIsLoadingUrl(true);
      try {
        const { data, error } = await supabase
          .from('day_labor_attachments')
          .select('attachment_url')
          .eq('week_ending_date', weekEndingDate)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching day labor attachment:', error);
        } else if (data?.attachment_url) {
          setAttachmentUrl(data.attachment_url);
          // Get signed URL
          const url = await getSignedUrl(data.attachment_url);
          if (isMounted) {
            setSignedUrl(url);
          }
        } else {
          setAttachmentUrl(null);
          setSignedUrl(null);
        }
      } catch (err) {
        console.error('Error in fetchAttachment:', err);
      } finally {
        if (isMounted) {
          setIsLoadingUrl(false);
        }
      }
    }
    fetchAttachment();
    
    return () => { isMounted = false; };
  }, [weekEndingDate]);

  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    if (!storagePath) return null;

    const match = storagePath.match(/transaction-attachments\/(.+)$/);
    if (!match) return null;

    const filePath = match[1];
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { filePath },
      });

      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Por favor suba una imagen (JPG, PNG, GIF, WebP) o PDF', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'El archivo debe ser menor a 5MB', variant: 'destructive' });
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      await saveAttachment(storagePath);
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: 'Error al subir el archivo', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveAttachment = async (storagePath: string) => {
    const { error } = await supabase
      .from('day_labor_attachments')
      .upsert(
        { week_ending_date: weekEndingDate, attachment_url: storagePath },
        { onConflict: 'week_ending_date' }
      );

    if (error) {
      console.error('Error saving attachment:', error);
      toast({ title: 'Error', description: 'Error al guardar el adjunto', variant: 'destructive' });
      return;
    }

    setAttachmentUrl(storagePath);
    const url = await getSignedUrl(storagePath);
    setSignedUrl(url);
    toast({ title: 'Adjunto guardado' });
  };

  const clearAttachment = async () => {
    const { error } = await supabase
      .from('day_labor_attachments')
      .delete()
      .eq('week_ending_date', weekEndingDate);

    if (error) {
      console.error('Error deleting attachment:', error);
      toast({ title: 'Error', description: 'Error al eliminar el adjunto', variant: 'destructive' });
      return;
    }

    setAttachmentUrl(null);
    setSignedUrl(null);
    toast({ title: 'Adjunto eliminado' });
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const loadCameras = useCallback(async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
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
          : { width: { ideal: 1920 }, height: { ideal: 1080 } }
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
      toast({ title: 'Error', description: 'No se pudo acceder a la cámara', variant: 'destructive' });
    }
  }, []);

  const startCamera = useCallback(async () => {
    setShowCamera(true);
    setCapturedImage(null);
    setImageName('');
    setIsCameraActive(false);
    
    const cameras = await loadCameras();
    if (cameras.length > 0) {
      const cameraToUse = selectedCameraId || cameras[0].deviceId;
      setSelectedCameraId(cameraToUse);
      await startCameraWithDevice(cameraToUse);
    } else {
      toast({ title: 'Error', description: 'No se encontraron cámaras', variant: 'destructive' });
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
      setImageName(`jornales-${weekEndingDate}`);
      stopCamera();
    }
  }, [stopCamera, weekEndingDate]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const savePhoto = useCallback(async () => {
    if (!capturedImage) return;

    setIsUploading(true);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `${imageName || 'jornales'}-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      await saveAttachment(storagePath);
      closeCamera();
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: 'Error al guardar la foto', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, imageName, saveAttachment]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
    setImageName('');
  }, [stopCamera]);

  return (
    <div className="flex items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {attachmentUrl ? (
        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm">
          {isLoadingUrl ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <FileImage className="h-4 w-4 text-primary" />
          )}
          <a
            href={signedUrl || attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline max-w-[100px] truncate text-xs"
          >
            Ver Adjunto
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={clearAttachment}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              className="h-8"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Paperclip className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Adjuntar</span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleFileClick}>
              <FileImage className="mr-2 h-4 w-4" />
              Subir Archivo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={startCamera}>
              <Camera className="mr-2 h-4 w-4" />
              Usar Cámara
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capturar Recibo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {availableCameras.length > 1 && !capturedImage && (
              <div className="space-y-2">
                <Label htmlFor="cameraSelect" className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4" />
                  Seleccionar Cámara
                </Label>
                <Select value={selectedCameraId} onValueChange={switchCamera}>
                  <SelectTrigger id="cameraSelect">
                    <SelectValue placeholder="Elegir cámara" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCameras.map((camera, index) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Cámara ${index + 1}`}
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
              <div className="space-y-4">
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageName">Nombre de Imagen</Label>
                  <Input
                    id="imageName"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="Nombre del recibo"
                  />
                </div>
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
                    Volver a Tomar
                  </Button>
                  <Button type="button" onClick={savePhoto} disabled={isUploading}>
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="mr-2 h-4 w-4" />
                    )}
                    Guardar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}