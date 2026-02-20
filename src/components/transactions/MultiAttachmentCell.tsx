import { useState, useRef, useEffect } from 'react';
import { Paperclip, Upload, Loader2, Camera, FileImage, FileText, Receipt, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { saveAttachment, getSignedAttachmentUrl, AttachmentCategory } from '@/lib/attachments';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
import { useLanguage } from '@/contexts/LanguageContext';
import { generateAttachmentFileName } from '@/lib/attachmentNaming';

interface MultiAttachmentCellProps {
  transactionId: string;
  attachments: Record<AttachmentCategory, string | null>;
  onUpdate: () => void;
  showCategories?: AttachmentCategory[];
}

const categoryConfig: Record<AttachmentCategory, { icon: typeof FileText; labelEs: string; labelEn: string; color: string }> = {
  ncf: { icon: FileText, labelEs: 'NCF', labelEn: 'NCF', color: 'text-blue-600' },
  payment_receipt: { icon: Receipt, labelEs: 'Comprobante', labelEn: 'Receipt', color: 'text-green-600' },
  quote: { icon: Quote, labelEs: 'Cotización', labelEn: 'Quote', color: 'text-orange-500' },
};

export function MultiAttachmentCell({ 
  transactionId, 
  attachments, 
  onUpdate,
  showCategories = ['ncf', 'payment_receipt', 'quote']
}: MultiAttachmentCellProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<AttachmentCategory | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraCategory, setCameraCategory] = useState<AttachmentCategory>('payment_receipt');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<AttachmentCategory, string | null>>({
    ncf: null,
    payment_receipt: null,
    quote: null
  });
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);
  
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Memoize showCategories to prevent infinite re-renders
  const categoriesKey = showCategories.join(',');
  
  // Fetch signed URLs for all attachments with error handling
  useEffect(() => {
    let isMounted = true;
    
    async function fetchSignedUrls() {
      setIsLoadingUrls(true);
      const urls: Record<AttachmentCategory, string | null> = { ncf: null, payment_receipt: null, quote: null };
      
      try {
        // Process each category in parallel with individual error handling
        const promises = showCategories.map(async (category) => {
          if (attachments[category]) {
            try {
              const url = await getSignedAttachmentUrl(attachments[category]!);
              return { category, url };
            } catch {
              return { category, url: null };
            }
          }
          return { category, url: null };
        });
        
        const results = await Promise.all(promises);
        
        if (isMounted) {
          results.forEach(({ category, url }) => {
            urls[category] = url;
          });
          setSignedUrls(urls);
        }
      } catch (error) {
        // Silently fail - just show no previews
        console.warn('Failed to fetch signed URLs');
      } finally {
        if (isMounted) {
          setIsLoadingUrls(false);
        }
      }
    }
    
    fetchSignedUrls();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.ncf, attachments.payment_receipt, attachments.quote, categoriesKey]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingCategory) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(language === 'es' ? 'Suba una imagen o PDF' : 'Please upload an image or PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'es' ? 'Máximo 5MB' : 'File size must be less than 5MB');
      return;
    }

    await uploadFile(file, uploadingCategory);
  };

  const uploadFile = async (file: File, category: AttachmentCategory) => {
    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = generateAttachmentFileName(fileExt, category, transactionId);
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      const success = await saveAttachment(transactionId, storagePath, category);
      
      if (!success) throw new Error('Failed to save attachment');
      
      const label = categoryConfig[category][language === 'es' ? 'labelEs' : 'labelEn'];
      toast.success(language === 'es' ? `${label} guardado` : `${label} saved`);
      onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(language === 'es' ? 'Error al subir' : 'Failed to upload');
    } finally {
      setIsUploading(false);
      setUploadingCategory(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = (category: AttachmentCategory) => {
    setUploadingCategory(category);
    fileInputRef.current?.click();
  };

  const startCamera = (category: AttachmentCategory) => {
    setCameraCategory(category);
    setShowCamera(true);
    setCapturedImage(null);
    setImageName('');
    
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
    }).then(stream => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    }).catch(error => {
      console.error('Camera error:', error);
      toast.error(language === 'es' ? 'No se pudo acceder a la cámara' : 'Could not access camera');
      setShowCamera(false);
    });
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
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
      setImageName(`${cameraCategory}-${new Date().toISOString().slice(0, 10)}`);
      stopCamera();
    }
  };

  const savePhoto = async () => {
    if (!capturedImage) return;
    setIsUploading(true);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const fileName = generateAttachmentFileName('jpg', cameraCategory, transactionId);
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      await uploadFile(file, cameraCategory);
      closeCamera();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(language === 'es' ? 'Error al guardar' : 'Failed to save');
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

  // Count how many attachments exist
  const attachmentCount = showCategories.filter(cat => attachments[cat]).length;
  const hasAnyAttachment = attachmentCount > 0;

  // Get first available image for hover preview
  const firstImageUrl = showCategories
    .map(cat => signedUrls[cat])
    .find(url => url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url));

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
      
      <HoverCard openDelay={300} closeDelay={100}>
        <DropdownMenu>
          <HoverCardTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center justify-center p-1 rounded hover:bg-muted transition-colors gap-0.5 ${
                  hasAnyAttachment ? 'text-primary' : 'text-muted-foreground'
                }`}
                disabled={isUploading || isLoadingUrls}
                title={hasAnyAttachment ? `${attachmentCount} adjuntos` : 'Agregar adjunto'}
              >
                {isUploading || isLoadingUrls ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    {attachmentCount > 0 && (
                      <span className="text-xs font-medium">{attachmentCount}</span>
                    )}
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
          </HoverCardTrigger>
          
          <DropdownMenuContent align="center" className="bg-popover z-50 w-56">
            {showCategories.map(category => {
              const config = categoryConfig[category];
              const Icon = config.icon;
              const label = language === 'es' ? config.labelEs : config.labelEn;
              const hasAttachment = !!attachments[category];
              const signedUrl = signedUrls[category];

              return (
                <div key={category}>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className={`h-3 w-3 ${config.color}`} />
                    {label}
                    {hasAttachment && <span className="text-green-600">✓</span>}
                  </DropdownMenuLabel>
                  
                  {hasAttachment && signedUrl && (
                    <DropdownMenuItem asChild>
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                        <FileImage className="mr-2 h-4 w-4" />
                        {language === 'es' ? 'Ver' : 'View'}
                      </a>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem onClick={() => handleUploadClick(category)}>
                    <Upload className="mr-2 h-4 w-4" />
                    {hasAttachment 
                      ? (language === 'es' ? 'Reemplazar archivo' : 'Replace file')
                      : (language === 'es' ? 'Subir archivo' : 'Upload file')
                    }
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => startCamera(category)}>
                    <Camera className="mr-2 h-4 w-4" />
                    {hasAttachment 
                      ? (language === 'es' ? 'Reemplazar con cámara' : 'Replace with camera')
                      : (language === 'es' ? 'Usar cámara' : 'Use camera')
                    }
                  </DropdownMenuItem>
                  
                  {category !== showCategories[showCategories.length - 1] && (
                    <DropdownMenuSeparator />
                  )}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {firstImageUrl && (
          <HoverCardContent side="left" className="w-64 p-2 z-50">
            <img
              src={firstImageUrl}
              alt="Preview"
              className="w-full h-auto rounded-md object-contain max-h-48"
            />
          </HoverCardContent>
        )}
      </HoverCard>

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {language === 'es' ? 'Capturar' : 'Capture'} {categoryConfig[cameraCategory][language === 'es' ? 'labelEs' : 'labelEn']}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
              <div className="space-y-4">
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageName">{language === 'es' ? 'Nombre' : 'Name'}</Label>
                  <Input id="imageName" value={imageName} onChange={(e) => setImageName(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCamera}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              
              {!capturedImage ? (
                <Button type="button" onClick={capturePhoto} disabled={!isCameraActive}>
                  <Camera className="mr-2 h-4 w-4" />
                  {language === 'es' ? 'Capturar' : 'Capture'}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => { setCapturedImage(null); startCamera(cameraCategory); }}>
                    {language === 'es' ? 'Repetir' : 'Retake'}
                  </Button>
                  <Button type="button" onClick={savePhoto} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                    {language === 'es' ? 'Guardar' : 'Save'}
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
