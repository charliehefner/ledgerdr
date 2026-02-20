import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, X, FileImage, Loader2, Camera, Video, XCircle, SwitchCamera, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getSignedAttachmentUrl, AttachmentCategory } from '@/lib/attachments';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { generateAttachmentFileName } from '@/lib/attachmentNaming';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

export interface CategoryAttachments {
  ncf: string | null;
  payment_receipt: string | null;
  quote: string | null;
}

interface MultiAttachmentUploadProps {
  attachments: CategoryAttachments;
  onUpload: (category: AttachmentCategory, url: string) => void;
  onClear: (category: AttachmentCategory) => void;
}

const CATEGORY_LABELS: Record<AttachmentCategory, { en: string; es: string }> = {
  ncf: { en: 'NCF', es: 'NCF' },
  payment_receipt: { en: 'Payment Receipt', es: 'Comprobante de Pago' },
  quote: { en: 'Quote', es: 'Cotización' },
};

export function MultiAttachmentUpload({ attachments, onUpload, onClear }: MultiAttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<AttachmentCategory | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const attachmentCount = Object.values(attachments).filter(Boolean).length;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCategory) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG, GIF, WebP) or PDF file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    await uploadFile(file, uploadCategory);
  };

  const uploadFile = async (file: File, category: AttachmentCategory) => {
    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = generateAttachmentFileName(fileExt, category);
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      onUpload(category, storagePath);
      toast.success(`${CATEGORY_LABELS[category].es} uploaded successfully`);
    } catch (error: any) {
      console.error('Upload error:', error);
      const detail = error?.message || error?.statusCode || '';
      toast.error(`Failed to upload attachment: ${detail}`);
    } finally {
      setIsUploading(false);
      setUploadCategory(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileClick = (category: AttachmentCategory) => {
    setUploadCategory(category);
    setTimeout(() => fileInputRef.current?.click(), 0);
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
      toast.error('Could not access camera. Please check permissions.');
    }
  }, []);

  const startCamera = useCallback(async (category: AttachmentCategory) => {
    setUploadCategory(category);
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
      toast.error('No cameras found on this device.');
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
      setImageName(`receipt-${new Date().toISOString().slice(0, 10)}`);
      stopCamera();
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(async () => {
    setCapturedImage(null);
    if (uploadCategory) {
      const cameras = await loadCameras();
      if (cameras.length > 0) {
        const cameraToUse = selectedCameraId || cameras[0].deviceId;
        await startCameraWithDevice(cameraToUse);
      }
    }
  }, [loadCameras, selectedCameraId, startCameraWithDevice, uploadCategory]);

  const savePhoto = useCallback(async () => {
    if (!capturedImage || !uploadCategory) return;

    setIsUploading(true);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = generateAttachmentFileName('jpg', uploadCategory);
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      onUpload(uploadCategory, storagePath);
      toast.success('Photo saved successfully');
      closeCamera();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to save photo');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, imageName, uploadCategory, onUpload]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
    setImageName('');
    setUploadCategory(null);
  }, [stopCamera]);

  const renderCategoryItem = (category: AttachmentCategory, useCamera: boolean) => {
    const hasAttachment = !!attachments[category];
    const label = CATEGORY_LABELS[category];
    
    return (
      <DropdownMenuItem 
        key={`${category}-${useCamera ? 'camera' : 'file'}`}
        onClick={() => useCamera ? startCamera(category) : handleFileClick(category)}
        disabled={hasAttachment}
        className="flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          {useCamera ? <Camera className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}
          {label.es}
        </span>
        {hasAttachment && <Check className="h-4 w-4 text-green-500" />}
      </DropdownMenuItem>
    );
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Paperclip className="mr-2 h-4 w-4" />
                  Adjuntar
                  {attachmentCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {attachmentCount}
                    </Badge>
                  )}
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Upload File
            </div>
            {renderCategoryItem('ncf', false)}
            {renderCategoryItem('payment_receipt', false)}
            {renderCategoryItem('quote', false)}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Use Camera
            </div>
            {renderCategoryItem('ncf', true)}
            {renderCategoryItem('payment_receipt', true)}
            {renderCategoryItem('quote', true)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Show attached badges */}
        {(Object.entries(attachments) as [AttachmentCategory, string | null][]).map(([category, url]) => 
          url && (
            <Badge key={category} variant="secondary" className="flex items-center gap-1 py-1">
              <FileImage className="h-3 w-3" />
              {CATEGORY_LABELS[category].es}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-muted"
                onClick={() => onClear(category)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )
        )}
      </div>

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capturar {uploadCategory ? CATEGORY_LABELS[uploadCategory].es : ''}
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
                    placeholder="Ingrese un nombre para este documento"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeCamera}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              
              {!capturedImage ? (
                <Button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraActive}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Capturar
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={retakePhoto}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Volver a tomar
                  </Button>
                  <Button
                    type="button"
                    onClick={savePhoto}
                    disabled={isUploading}
                  >
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
