import { useState, useRef, useEffect } from 'react';
import { Paperclip, Upload, Loader2, Camera, FileImage, FileText, Receipt, Quote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  saveAttachment,
  getSignedAttachmentUrl,
  deleteAttachmentById,
  getAttachmentsByCategoryMulti,
  AttachmentCategory,
  TransactionAttachment,
  CategoryAttachmentsMulti,
} from '@/lib/attachments';
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
  /** Legacy single-per-category prop – still accepted for backward compat */
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
  attachments: _legacyAttachments,
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
  const [multiAttachments, setMultiAttachments] = useState<CategoryAttachmentsMulti>({
    ncf: [], payment_receipt: [], quote: []
  });
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch multi-per-category attachments
  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      setIsLoading(true);
      try {
        const data = await getAttachmentsByCategoryMulti(transactionId);
        if (!isMounted) return;
        setMultiAttachments(data);

        // Resolve signed URLs for all attachments
        const allItems = Object.values(data).flat();
        const urlEntries = await Promise.all(
          allItems.map(async (item) => {
            try {
              const url = await getSignedAttachmentUrl(item.attachment_url);
              return [item.id, url] as const;
            } catch {
              return [item.id, null] as const;
            }
          })
        );

        if (isMounted) {
          const urls: Record<string, string> = {};
          urlEntries.forEach(([id, url]) => {
            if (url) urls[id] = url;
          });
          setSignedUrls(urls);
        }
      } catch {
        // silent
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [transactionId, _legacyAttachments.ncf, _legacyAttachments.payment_receipt, _legacyAttachments.quote]);

  const totalCount = showCategories.reduce((sum, cat) => sum + multiAttachments[cat].length, 0);

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
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const storagePath = `transaction-attachments/${filePath}`;
      const success = await saveAttachment(transactionId, storagePath, category);
      
      if (!success) throw new Error('Failed to save attachment');
      
      const label = categoryConfig[category][language === 'es' ? 'labelEs' : 'labelEn'];
      toast.success(language === 'es' ? `${label} guardado` : `${label} saved`);
      onUpdate();
    } catch (error: any) {
      console.error('Upload error:', error);
      const detail = error?.message || error?.statusCode || '';
      toast.error(language === 'es' ? `Error al subir: ${detail}` : `Failed to upload: ${detail}`);
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

  const handleDeleteAttachment = async (attachment: TransactionAttachment) => {
    const success = await deleteAttachmentById(attachment.id);
    if (success) {
      toast.success(language === 'es' ? 'Adjunto eliminado' : 'Attachment deleted');
      onUpdate();
    } else {
      toast.error(language === 'es' ? 'Error al eliminar' : 'Failed to delete');
    }
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

  // Get first available image for hover preview
  const firstImageUrl = showCategories
    .flatMap(cat => multiAttachments[cat])
    .map(a => signedUrls[a.id])
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
                  totalCount > 0 ? 'text-primary' : 'text-muted-foreground'
                }`}
                disabled={isUploading || isLoading}
                title={totalCount > 0 ? `${totalCount} adjuntos` : 'Agregar adjunto'}
              >
                {isUploading || isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    {totalCount > 0 && (
                      <span className="text-xs font-medium">{totalCount}</span>
                    )}
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
          </HoverCardTrigger>
          
          <DropdownMenuContent align="center" className="bg-popover z-50 w-64">
            {showCategories.map((category, catIdx) => {
              const config = categoryConfig[category];
              const Icon = config.icon;
              const label = language === 'es' ? config.labelEs : config.labelEn;
              const items = multiAttachments[category];

              return (
                <div key={category}>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className={`h-3 w-3 ${config.color}`} />
                    {label}
                    {items.length > 0 && (
                      <span className="text-xs text-green-600">({items.length})</span>
                    )}
                  </DropdownMenuLabel>
                  
                  {/* Existing attachments */}
                  {items.map((att, idx) => {
                    const url = signedUrls[att.id];
                    return (
                      <div key={att.id} className="flex items-center px-2 py-1 text-sm">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center gap-2 hover:underline truncate text-foreground"
                          >
                            <FileImage className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {label} {items.length > 1 ? `#${idx + 1}` : ''}
                            </span>
                          </a>
                        ) : (
                          <span className="flex-1 flex items-center gap-2 text-muted-foreground truncate">
                            <FileImage className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {label} {items.length > 1 ? `#${idx + 1}` : ''}
                            </span>
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAttachment(att)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                  
                  {/* Add more actions */}
                  <DropdownMenuItem onClick={() => handleUploadClick(category)}>
                    <Upload className="mr-2 h-4 w-4" />
                    {language === 'es' ? 'Subir archivo' : 'Upload file'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => startCamera(category)}>
                    <Camera className="mr-2 h-4 w-4" />
                    {language === 'es' ? 'Usar cámara' : 'Use camera'}
                  </DropdownMenuItem>
                  
                  {catIdx !== showCategories.length - 1 && (
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
