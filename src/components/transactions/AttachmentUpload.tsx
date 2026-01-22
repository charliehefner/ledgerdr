import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, X, FileImage, Loader2, Camera, Video, XCircle, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getSignedAttachmentUrl } from '@/lib/attachments';
import { toast } from 'sonner';
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

interface AttachmentUploadProps {
  onUpload: (url: string) => void;
  attachmentUrl: string | null;
  onClear: () => void;
}

export function AttachmentUpload({ onUpload, attachmentUrl, onClear }: AttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch signed URL when attachment URL changes
  useEffect(() => {
    async function fetchSignedUrl() {
      if (attachmentUrl) {
        setIsLoadingUrl(true);
        const url = await getSignedAttachmentUrl(attachmentUrl);
        setSignedUrl(url);
        setIsLoadingUrl(false);
      } else {
        setSignedUrl(null);
      }
    }
    fetchSignedUrl();
  }, [attachmentUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG, GIF, WebP) or PDF file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
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

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast.success('Attachment uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload attachment');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const loadCameras = useCallback(async () => {
    try {
      // Request permission first to get device labels, then immediately stop the stream
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // Only set default if we don't already have a selection
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
      // Stop any existing stream
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

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const savePhoto = useCallback(async () => {
    if (!capturedImage) return;

    setIsUploading(true);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `${imageName || 'receipt'}-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast.success('Photo saved successfully');
      closeCamera();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to save photo');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, imageName, onUpload]);

  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
    setImageName('');
  }, [stopCamera]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {attachmentUrl ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm">
          {isLoadingUrl ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <FileImage className="h-4 w-4 text-primary" />
          )}
          <a
            href={signedUrl || attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline max-w-[150px] truncate"
          >
            View Attachment
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onClear}
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
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleFileClick}>
              <FileImage className="mr-2 h-4 w-4" />
              Upload File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={startCamera}>
              <Camera className="mr-2 h-4 w-4" />
              Use Camera
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capture Receipt
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Camera Selector */}
            {availableCameras.length > 1 && !capturedImage && (
              <div className="space-y-2">
                <Label htmlFor="cameraSelect" className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4" />
                  Select Camera
                </Label>
                <Select value={selectedCameraId} onValueChange={switchCamera}>
                  <SelectTrigger id="cameraSelect">
                    <SelectValue placeholder="Choose a camera" />
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
                  <Label htmlFor="imageName">Image Name</Label>
                  <Input
                    id="imageName"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="Enter a name for this receipt"
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
                Cancel
              </Button>
              
              {!capturedImage ? (
                <Button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraActive}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Capture
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={retakePhoto}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Retake
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
                    Save
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
