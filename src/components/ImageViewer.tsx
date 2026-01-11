import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageViewerProps {
  isOpen: boolean;
  imageUrl: string;
  alt?: string;
  onClose: () => void;
}

export function ImageViewer({ isOpen, imageUrl, alt, onClose }: ImageViewerProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`
        fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm
        transition-opacity duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
      onClick={handleClose}
    >
      {/* 关闭按钮 */}
      <button 
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 图片容器 */}
      <div 
        className={`
          relative max-w-[90vw] max-h-[90vh] overflow-hidden rounded-lg
          transition-transform duration-200 scale-100
          ${isClosing ? 'scale-95' : 'scale-100'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={imageUrl} 
          alt={alt || 'Image Preview'} 
          className="w-full h-full object-contain max-w-full max-h-[90vh]"
        />
      </div>
    </div>,
    document.body
  );
}
