declare module 'react-signature-canvas' {
  import * as React from 'react';

  export interface SignatureCanvasProps {
    ref?: React.Ref<SignatureCanvas>;
    penColor?: string;
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    onEnd?: () => void;
  }

  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    getTrimmedCanvas(): HTMLCanvasElement;
    toDataURL(type?: string, encoderOptions?: number): string;
    fromDataURL(dataURL: string, options?: any): void;
    clear(): void;
  }
}