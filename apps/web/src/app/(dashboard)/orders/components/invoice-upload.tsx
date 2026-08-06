'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useGetUploadUrl, useRegisterInvoice } from '@/hooks/use-orders';

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg';

interface InvoiceUploadProps {
  orderId: string;
  onSuccess?: () => void;
}

type UploadState = 'idle' | 'validating' | 'uploading' | 'registering' | 'success' | 'error';

export function InvoiceUpload({ orderId, onSuccess }: InvoiceUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = useGetUploadUrl(orderId);
  const registerInvoice = useRegisterInvoice(orderId);

  const resetState = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
    setSelectedFile(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Aceitos: PDF, PNG, JPG, JPEG.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo excede o tamanho máximo de 10MB. Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        setPreview(null);
        return;
      }

      setSelectedFile(file);

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    },
    [validateFile]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setError(null);
    setState('validating');

    try {
      // Step 1: Get presigned URL
      setState('uploading');
      const { uploadUrl, s3Key } = await getUploadUrl.mutateAsync({
        filename: selectedFile.name,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
      });

      // Step 2: Upload file to S3 via presigned URL
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload falhou com status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Erro de rede durante upload'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.send(selectedFile);
      });

      // Step 3: Register the invoice in the backend
      setState('registering');
      await registerInvoice.mutateAsync({
        filename: selectedFile.name,
        s3Key,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
      });

      setState('success');
      setTimeout(() => {
        resetState();
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setState('error');
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao fazer upload do arquivo. Tente novamente.');
      }
    }
  }, [selectedFile, getUploadUrl, registerInvoice, resetState, onSuccess]);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Upload de Nota Fiscal</h4>

      {/* File input */}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          aria-label="Selecionar arquivo de nota fiscal"
          disabled={state !== 'idle' && state !== 'error'}
        />
      </div>

      {/* File info and preview */}
      {selectedFile && (
        <div className="mt-3 flex items-center gap-3">
          {preview ? (
            <Image
              src={preview}
              alt="Preview da nota fiscal"
              width={64}
              height={64}
              className="h-16 w-16 object-cover rounded border border-gray-200"
            />
          ) : (
            <div className="h-16 w-16 flex items-center justify-center bg-red-50 rounded border border-gray-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <div className="text-sm">
            <p className="font-medium text-gray-700">{selectedFile.name}</p>
            <p className="text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(state === 'uploading' || state === 'registering') && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>
              {state === 'uploading' ? 'Enviando arquivo...' : 'Registrando nota fiscal...'}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Success message */}
      {state === 'success' && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          Nota fiscal enviada com sucesso!
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || (state !== 'idle' && state !== 'error')}
          loading={state === 'uploading' || state === 'registering' || state === 'validating'}
          size="sm"
        >
          Enviar
        </Button>
        {selectedFile && state !== 'uploading' && state !== 'registering' && (
          <Button variant="outline" size="sm" onClick={resetState}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
