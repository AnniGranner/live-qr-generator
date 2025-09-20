import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Download, QrCode, ImageIcon, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InputType = 'text' | 'url' | 'contact' | 'image';
type ImageMode = 'link' | 'embed';
type ExportFormat = 'png' | 'jpeg' | 'svg';

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  organization: string;
}

export default function QRGenerator() {
  const [inputType, setInputType] = useState<InputType>('text');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: '',
    phone: '',
    email: '',
    organization: ''
  });
  const [qrColor, setQrColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [qrSize, setQrSize] = useState(300);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportResolution, setExportResolution] = useState(300);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [urlError, setUrlError] = useState('');
  
  // Image-related state
  const [imageMode, setImageMode] = useState<ImageMode>('link');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [embedDataUrl, setEmbedDataUrl] = useState<string>('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [imageFileError, setImageFileError] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const validateURL = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError('');
      return false;
    }
    
    try {
      new URL(url);
      setUrlError('');
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  };

  const generateVCard = (contact: ContactInfo): string => {
    let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
    if (contact.name) vcard += `FN:${contact.name}\n`;
    if (contact.organization) vcard += `ORG:${contact.organization}\n`;
    if (contact.phone) vcard += `TEL:${contact.phone}\n`;
    if (contact.email) vcard += `EMAIL:${contact.email}\n`;
    vcard += 'END:VCARD';
    return vcard;
  };

  // Image processing functions
  const validateImageURL = (url: string): { isValid: boolean; error: string } => {
    if (!url.trim()) {
      return { isValid: false, error: '' };
    }
    
    try {
      new URL(url);
      return { isValid: true, error: '' };
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
  };

  // Helper function to calculate actual base64 payload bytes
  const getBase64PayloadBytes = (dataUrl: string): number => {
    const base64Index = dataUrl.indexOf('base64,');
    if (base64Index === -1) return dataUrl.length;
    
    const base64Data = dataUrl.substring(base64Index + 7);
    // Calculate bytes: base64 uses 4 chars for every 3 bytes
    // Remove padding and calculate actual bytes
    const padding = (base64Data.match(/=/g) || []).length;
    return Math.floor((base64Data.length - padding) * 3 / 4);
  };

  const compressImageToSize = async (file: File, maxSizeBytes: number = 1000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      let objectUrl: string | null = null;

      const cleanup = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      };

      img.onload = () => {
        cleanup(); // Clean up object URL once image is loaded
        
        // Start with reasonable dimensions and iteratively reduce
        let width = Math.min(img.width, 128);
        let height = Math.min(img.height, 128);
        let quality = 0.5;
        let attempts = 0;
        const maxAttempts = 50;

        const compress = () => {
          attempts++;
          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // Calculate actual payload bytes (not including data URL header)
            const payloadBytes = getBase64PayloadBytes(dataUrl);
            
            // Check if it fits within QR code capacity or we've hit limits
            if (payloadBytes <= maxSizeBytes || attempts >= maxAttempts || (width <= 24 && quality <= 0.05)) {
              if (payloadBytes > maxSizeBytes) {
                reject(new Error(`Image too large for QR embedding (${payloadBytes} bytes > ${maxSizeBytes} bytes limit). Please use Link mode instead.`));
                return;
              }
              resolve(dataUrl);
              return;
            }
            
            // Reduce size/quality and try again
            if (quality > 0.05) {
              quality = Math.max(0.05, quality - 0.05);
            } else {
              width = Math.max(24, Math.floor(width * 0.9));
              height = Math.max(24, Math.floor(height * 0.9));
              quality = 0.5;
            }
            
            setTimeout(compress, 5); // Async to prevent blocking
          }
        };

        compress();
      };

      img.onerror = () => {
        cleanup();
        reject(new Error('Failed to load image'));
      };
      
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    });
  };

  const processImageFile = async (file: File) => {
    setImageFileError('');
    setIsCompressing(false);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageFileError('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB for initial upload)
    const maxInitialSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxInitialSize) {
      setImageFileError('Image must be smaller than 5MB');
      return;
    }

    try {
      // Clean up previous preview URL to prevent memory leaks
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      
      // Generate preview
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImageFile(file);
      
      if (imageMode === 'embed') {
        setIsCompressing(true);
        
        try {
          // Compress for embedding with proper error handling
          const compressedDataUrl = await compressImageToSize(file, 1000);
          setEmbedDataUrl(compressedDataUrl);
          setIsCompressing(false);
          
          const payloadBytes = getBase64PayloadBytes(compressedDataUrl);
          toast({
            title: "Image Processed",
            description: `Image compressed for QR embedding (${payloadBytes} bytes)`,
          });
        } catch (compressionError) {
          console.error('Image compression failed:', compressionError);
          setImageFileError(compressionError instanceof Error ? compressionError.message : 'Image too large for QR embedding. Please use Link mode instead.');
          setIsCompressing(false);
          setEmbedDataUrl('');
        }
      }
    } catch (error) {
      console.error('Image processing failed:', error);
      setImageFileError('Failed to process image. Please try a different file.');
      setIsCompressing(false);
    }
  };

  const getQRContent = (): string => {
    switch (inputType) {
      case 'text':
        return textContent.trim();
      case 'url':
        return urlContent.trim();
      case 'contact':
        return generateVCard(contactInfo);
      case 'image':
        if (imageMode === 'link') {
          return imageUrl.trim();
        } else {
          return embedDataUrl;
        }
      default:
        return '';
    }
  };

  const isValidURL = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const hasValidContent = (): boolean => {
    switch (inputType) {
      case 'text':
        return textContent.trim().length > 0;
      case 'url':
        return urlContent.trim().length > 0 && isValidURL(urlContent);
      case 'contact':
        return contactInfo.name.trim().length > 0 || 
               contactInfo.phone.trim().length > 0 || 
               contactInfo.email.trim().length > 0;
      case 'image':
        if (imageMode === 'link') {
          return imageUrl.trim().length > 0 && !imageUrlError;
        } else {
          return embedDataUrl.length > 0 && !isCompressing && !imageFileError;
        }
      default:
        return false;
    }
  };

  const generateQRCode = async () => {
    const content = getQRContent();
    
    if (!content || !hasValidContent()) {
      setQrCodeGenerated(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      return;
    }

    try {
      if (canvasRef.current) {
        // Use lower error correction level for embedded images to maximize capacity
        const errorCorrectionLevel = (inputType === 'image' && imageMode === 'embed') ? 'L' : 'M';
        
        await QRCode.toCanvas(canvasRef.current, content, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel,
          color: {
            dark: qrColor,
            light: bgColor
          }
        });
        setQrCodeGenerated(true);
      }
    } catch (error) {
      console.error('QR Code generation failed:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = async () => {
    if (!qrCodeGenerated) {
      toast({
        title: "No QR Code",
        description: "Please generate a QR code first.",
        variant: "destructive",
      });
      return;
    }

    const content = getQRContent();
    if (!content) return;

    try {
      let downloadData: string;
      let filename: string;
      
      // Use same error correction level as display
      const errorCorrectionLevel = (inputType === 'image' && imageMode === 'embed') ? 'L' : 'M';

      if (exportFormat === 'svg') {
        // Generate SVG format
        const svgString = await QRCode.toString(content, {
          type: 'svg',
          width: exportResolution,
          margin: 2,
          errorCorrectionLevel,
          color: {
            dark: qrColor,
            light: bgColor
          }
        });
        downloadData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        filename = 'qrcode.svg';
      } else if (exportFormat === 'jpeg') {
        // Generate JPEG format using canvas
        if (!canvasRef.current) return;
        
        // Create a temporary canvas at export resolution
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportResolution;
        tempCanvas.height = exportResolution;
        
        await QRCode.toCanvas(tempCanvas, content, {
          width: exportResolution,
          margin: 2,
          errorCorrectionLevel,
          color: {
            dark: qrColor,
            light: bgColor
          }
        });
        
        downloadData = tempCanvas.toDataURL('image/jpeg', 0.9);
        filename = 'qrcode.jpg';
      } else {
        // Generate PNG format using canvas
        if (!canvasRef.current) return;
        
        // Create a temporary canvas at export resolution if different from display size
        if (exportResolution !== qrSize) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = exportResolution;
          tempCanvas.height = exportResolution;
          
          await QRCode.toCanvas(tempCanvas, content, {
            width: exportResolution,
            margin: 2,
            errorCorrectionLevel,
            color: {
              dark: qrColor,
              light: bgColor
            }
          });
          
          downloadData = tempCanvas.toDataURL('image/png');
        } else {
          downloadData = canvasRef.current.toDataURL('image/png');
        }
        filename = 'qrcode.png';
      }

      const link = document.createElement('a');
      link.download = filename;
      link.href = downloadData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download Complete",
        description: `QR code downloaded as ${exportFormat.toUpperCase()} successfully!`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    generateQRCode();
  }, [textContent, urlContent, contactInfo, imageUrl, embedDataUrl, qrColor, bgColor, qrSize, inputType, imageMode]);

  useEffect(() => {
    if (inputType === 'url') {
      validateURL(urlContent);
    }
  }, [urlContent, inputType]);

  useEffect(() => {
    if (inputType === 'image' && imageMode === 'link') {
      const validation = validateImageURL(imageUrl);
      setImageUrlError(validation.error);
    }
  }, [imageUrl, inputType, imageMode]);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, []);

  useEffect(() => {
    if (inputType === 'image' && imageMode === 'embed' && imageFile && !embedDataUrl) {
      processImageFile(imageFile);
    }
  }, [imageMode, imageFile]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">
              QR Code Generator
            </h1>
            <p className="text-muted-foreground text-lg">
              Create professional QR codes instantly
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Input Card */}
            <Card>
              <CardHeader>
                <CardTitle>Enter Your Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Content Type Selection */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Content Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      data-testid="button-text-type"
                      variant={inputType === 'text' ? 'default' : 'outline'}
                      className="text-sm font-medium"
                      onClick={() => setInputType('text')}
                    >
                      Text
                    </Button>
                    <Button
                      data-testid="button-url-type"
                      variant={inputType === 'url' ? 'default' : 'outline'}
                      className="text-sm font-medium"
                      onClick={() => setInputType('url')}
                    >
                      URL
                    </Button>
                    <Button
                      data-testid="button-contact-type"
                      variant={inputType === 'contact' ? 'default' : 'outline'}
                      className="text-sm font-medium"
                      onClick={() => setInputType('contact')}
                    >
                      Contact
                    </Button>
                    <Button
                      data-testid="button-image-type"
                      variant={inputType === 'image' ? 'default' : 'outline'}
                      className="text-sm font-medium"
                      onClick={() => setInputType('image')}
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      Image
                    </Button>
                  </div>
                </div>

                {/* Text Input */}
                {inputType === 'text' && (
                  <div>
                    <Label htmlFor="text-content">Enter your text here...</Label>
                    <Textarea
                      id="text-content"
                      data-testid="input-text-content"
                      className="mt-2 h-24 resize-none"
                      placeholder="Enter your text here..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                    />
                  </div>
                )}

                {/* URL Input */}
                {inputType === 'url' && (
                  <div>
                    <Label htmlFor="url-content">URL</Label>
                    <Input
                      id="url-content"
                      data-testid="input-url-content"
                      className="mt-2"
                      placeholder="https://example.com"
                      value={urlContent}
                      onChange={(e) => setUrlContent(e.target.value)}
                    />
                    {urlError && (
                      <p className="text-destructive text-sm mt-1" data-testid="text-url-error">
                        ⚠ {urlError}
                      </p>
                    )}
                    {urlContent && !urlError && (
                      <p className="text-green-600 text-sm mt-1" data-testid="text-url-success">
                        ✓ Valid URL
                      </p>
                    )}
                  </div>
                )}

                {/* Contact Input */}
                {inputType === 'contact' && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contact-name">Full Name</Label>
                        <Input
                          id="contact-name"
                          data-testid="input-contact-name"
                          className="mt-2"
                          placeholder="Full Name"
                          value={contactInfo.name}
                          onChange={(e) => 
                            setContactInfo(prev => ({ ...prev, name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-phone">Phone Number</Label>
                        <Input
                          id="contact-phone"
                          data-testid="input-contact-phone"
                          type="tel"
                          className="mt-2"
                          placeholder="Phone Number"
                          value={contactInfo.phone}
                          onChange={(e) => 
                            setContactInfo(prev => ({ ...prev, phone: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="contact-email">Email Address</Label>
                      <Input
                        id="contact-email"
                        data-testid="input-contact-email"
                        type="email"
                        className="mt-2"
                        placeholder="Email Address"
                        value={contactInfo.email}
                        onChange={(e) => 
                          setContactInfo(prev => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-org">Organization (Optional)</Label>
                      <Input
                        id="contact-org"
                        data-testid="input-contact-organization"
                        className="mt-2"
                        placeholder="Organization"
                        value={contactInfo.organization}
                        onChange={(e) => 
                          setContactInfo(prev => ({ ...prev, organization: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Image Input */}
                {inputType === 'image' && (
                  <div className="space-y-6">
                    {/* Mode Selection */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Image Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          data-testid="button-image-link-mode"
                          variant={imageMode === 'link' ? 'default' : 'outline'}
                          className="text-sm font-medium"
                          onClick={() => {
                            setImageMode('link');
                            // Clear embed-specific state when switching to link mode
                            if (imagePreview) {
                              URL.revokeObjectURL(imagePreview);
                            }
                            setImageFile(null);
                            setImagePreview('');
                            setEmbedDataUrl('');
                            setImageFileError('');
                          }}
                        >
                          🔗 Link to URL
                        </Button>
                        <Button
                          data-testid="button-image-embed-mode"
                          variant={imageMode === 'embed' ? 'default' : 'outline'}
                          className="text-sm font-medium"
                          onClick={() => {
                            setImageMode('embed');
                            // Clear URL-specific state when switching to embed mode
                            setImageUrl('');
                            setImageUrlError('');
                          }}
                        >
                          📤 Upload & Embed
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {imageMode === 'link' 
                          ? 'QR code will contain a link to your image URL (recommended)'
                          : 'Image will be embedded directly in QR code (limited size)'
                        }
                      </p>
                    </div>

                    {/* Link Mode Input */}
                    {imageMode === 'link' && (
                      <div>
                        <Label htmlFor="image-url">Image URL</Label>
                        <Input
                          id="image-url"
                          data-testid="input-image-url"
                          className="mt-2"
                          placeholder="https://example.com/image.jpg"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          onBlur={() => {
                            const validation = validateImageURL(imageUrl);
                            setImageUrlError(validation.error);
                          }}
                        />
                        {imageUrlError && (
                          <p className="text-destructive text-sm mt-1" data-testid="text-image-url-error">
                            ⚠ {imageUrlError}
                          </p>
                        )}
                        {imageUrl && !imageUrlError && (
                          <p className="text-green-600 text-sm mt-1" data-testid="text-image-url-success">
                            ✓ Valid URL
                          </p>
                        )}
                      </div>
                    )}

                    {/* Upload/Embed Mode */}
                    {imageMode === 'embed' && (
                      <div className="space-y-4">
                        {/* File Upload Area */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Upload Image</Label>
                          <div 
                            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                            data-testid="dropzone-image-upload"
                            onDrop={(e) => {
                              e.preventDefault();
                              const files = Array.from(e.dataTransfer.files);
                              if (files.length > 0 && files[0].type.startsWith('image/')) {
                                processImageFile(files[0]);
                              }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={(e) => e.preventDefault()}
                            onClick={() => document.getElementById('image-file-input')?.click()}
                          >
                            <input
                              id="image-file-input"
                              data-testid="input-image-file"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  processImageFile(file);
                                }
                              }}
                            />
                            {!imageFile ? (
                              <div>
                                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-sm font-medium mb-2">
                                  Click to upload or drag & drop
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Supports JPG, PNG, GIF, WebP (max 5MB)
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-sm font-medium text-green-600">
                                  ✓ Image selected: {imageFile.name}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Click to select a different image
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Image Preview */}
                        {imagePreview && (
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Preview</Label>
                            <div className="border border-border rounded-lg p-3 bg-muted">
                              <div className="flex items-start space-x-4">
                                <img
                                  src={imagePreview}
                                  alt="Preview"
                                  data-testid="img-image-preview"
                                  className="w-20 h-20 object-cover rounded-lg border border-border"
                                />
                                <div className="flex-1 space-y-2">
                                  <div className="text-sm">
                                    <div className="font-medium" data-testid="text-image-filename">
                                      {imageFile?.name}
                                    </div>
                                    <div className="text-muted-foreground" data-testid="text-image-filesize">
                                      Original: {imageFile ? Math.round(imageFile.size / 1024) : 0}KB
                                    </div>
                                    {embedDataUrl && (
                                      <div className="text-green-600 text-xs" data-testid="text-compressed-size">
                                        Compressed: {Math.round(embedDataUrl.length / 1024 * 10) / 10}KB
                                      </div>
                                    )}
                                  </div>
                                  {isCompressing && (
                                    <div className="text-xs text-muted-foreground" data-testid="text-compressing">
                                      🔄 Compressing for QR embedding...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* File Error */}
                        {imageFileError && (
                          <div className="text-destructive text-sm" data-testid="text-image-file-error">
                            ⚠ {imageFileError}
                          </div>
                        )}

                        {/* Info Box */}
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <div className="text-blue-600 dark:text-blue-400 text-sm">💡</div>
                            <div className="text-blue-800 dark:text-blue-200 text-xs space-y-1">
                              <p><strong>Embed Mode Tips:</strong></p>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Images are compressed to fit QR capacity (~1KB max)</li>
                                <li>Simple graphics work better than photos</li>
                                <li>QR codes with embedded images are larger and may be harder to scan</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  data-testid="button-generate"
                  className="w-full"
                  onClick={generateQRCode}
                  disabled={!hasValidContent()}
                >
                  Generate QR Code
                </Button>
              </CardContent>
            </Card>

            {/* Customization Card */}
            <Card>
              <CardHeader>
                <CardTitle>Customization Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">QR Code Color</Label>
                    <div className="flex items-center space-x-3">
                      <input
                        data-testid="input-qr-color"
                        type="color"
                        value={qrColor}
                        onChange={(e) => setQrColor(e.target.value)}
                        className="w-10 h-10 border border-border rounded-lg cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">Foreground</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Background Color</Label>
                    <div className="flex items-center space-x-3">
                      <input
                        data-testid="input-bg-color"
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-10 h-10 border border-border rounded-lg cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">Background</span>
                    </div>
                  </div>
                </div>

                {/* Size Options */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">QR Code Size</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      data-testid="button-size-small"
                      variant={qrSize === 200 ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3"
                      onClick={() => setQrSize(200)}
                    >
                      <span>Small</span>
                      <span className="text-xs opacity-70">200px</span>
                    </Button>
                    <Button
                      data-testid="button-size-medium"
                      variant={qrSize === 300 ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3"
                      onClick={() => setQrSize(300)}
                    >
                      <span>Medium</span>
                      <span className="text-xs opacity-70">300px</span>
                    </Button>
                    <Button
                      data-testid="button-size-large"
                      variant={qrSize === 400 ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3"
                      onClick={() => setQrSize(400)}
                    >
                      <span>Large</span>
                      <span className="text-xs opacity-70">400px</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview and Download Section */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle>QR Code Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[200px] bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center relative">
                  {!qrCodeGenerated && (
                    <div className="text-center text-muted-foreground" data-testid="text-empty-state">
                      <QrCode className="mx-auto h-12 w-12 mb-4" />
                      <p className="font-medium">Enter content to generate QR code</p>
                      <p className="text-sm">Your QR code will appear here</p>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    data-testid="canvas-qr-code"
                    className={`rounded-lg shadow-lg ${qrCodeGenerated ? 'block' : 'hidden'}`}
                  />
                </div>

                {/* Download Section */}
                <div className="mt-6">
                  <Button
                    data-testid="button-download"
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    onClick={downloadQRCode}
                    disabled={!qrCodeGenerated}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download PNG
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Usage Tips */}
            <Card className="bg-accent">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-3 text-accent-foreground">
                  💡 Quick Tips
                </h3>
                <ul className="space-y-2 text-sm text-accent-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Keep URLs short for better scanning reliability</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Test your QR codes before printing or sharing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Use high contrast colors for better readability</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Larger sizes work better for printing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Made with ❤️ by{' '}
              <a
                href="https://techysphere.blog"
                className="text-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-techysphere"
              >
                Techysphere.blog
              </a>
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Free QR Code Generator Tool - No registration required
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
