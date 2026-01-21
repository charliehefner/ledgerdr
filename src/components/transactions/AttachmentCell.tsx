import { useState, useRef } from 'react';
import { Paperclip, Upload, Loader2, Camera, X, FileImage, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { saveAttachment } from '@/lib/attachments';
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AttachmentCellProps {
  transactionId: string | number;
  attachmentUrl: string | null | undefined;
  onUpdate: () => void;
}

export function AttachmentCell({ transactionId, attachmentUrl, onUpdate }: AttachmentCellProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG, GIF, WebP) or PDF file');
      return;
    }

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

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(filePath);

      const success = await saveAttachment(transactionId, publicUrl);
      if (!success) throw new Error('Failed to save attachment to database');
      toast.success('Attachment updated successfully');
      onUpdate();
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

  const startCamera = async () => {
    setShowCamera(true);
    setCapturedImage(null);
    setImageName('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Could not access camera. Please check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
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
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const savePhoto = async () => {
    if (!capturedImage) return;

    setIsUploading(true);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `${imageName || 'receipt'}-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(filePath);

      const success = await saveAttachment(transactionId, publicUrl);
      if (!success) throw new Error('Failed to save attachment to database');
      toast.success('Photo saved successfully');
      closeCamera();
      onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to save photo');
    } finally {
      setIsUploading(false);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
    setImageName('');
  };

  // Check if attachment is an image (for preview)
  const isImageAttachment = attachmentUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl);

  const TriggerButton = (
    <button
      className={`inline-flex items-center justify-center p-1 rounded hover:bg-muted transition-colors ${
        attachmentUrl ? 'text-primary' : 'text-muted-foreground'
      }`}
      disabled={isUploading}
      title={attachmentUrl ? 'View or update attachment' : 'Add attachment'}
    >
      {isUploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Paperclip className="h-4 w-4" />
      )}
    </button>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {isImageAttachment ? (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {TriggerButton}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem asChild>
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <FileImage className="mr-2 h-4 w-4" />
                    View Attachment
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFileClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Replace with File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  Replace with Camera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </HoverCardTrigger>
          <HoverCardContent side="left" className="w-64 p-2">
            <img
              src={attachmentUrl}
              alt="Receipt preview"
              className="w-full h-auto rounded-md object-contain max-h-48"
            />
          </HoverCardContent>
        </HoverCard>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {TriggerButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {attachmentUrl && (
              <DropdownMenuItem asChild>
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <FileImage className="mr-2 h-4 w-4" />
                  View Attachment
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleFileClick}>
              <Upload className="mr-2 h-4 w-4" />
              {attachmentUrl ? 'Replace with File' : 'Upload File'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={startCamera}>
              <Camera className="mr-2 h-4 w-4" />
              {attachmentUrl ? 'Replace with Camera' : 'Use Camera'}
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
                    <Camera className="mr-2 h-4 w-4" />
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
    </>
  );
}
