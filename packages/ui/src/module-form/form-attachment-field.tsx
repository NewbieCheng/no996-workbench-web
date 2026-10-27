import * as React from 'react';
import {
  AttachmentUploader,
  type AttachmentUploaderProps,
} from '../attachment-uploader';
import { cn } from '../utils';
import { FormField } from './field';

export function FormAttachmentField({
  label,
  required,
  hint,
  error,
  labelMode = 'stacked',
  className,
  uploaderClassName,
  layout = 'grid',
  ...uploaderProps
}: AttachmentUploaderProps & {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  labelMode?: 'stacked' | 'floating';
  uploaderClassName?: string;
}) {
  return (
    <FormField label={label} labelMode={labelMode} required={required} hint={hint} error={error} className={className}>
      <div className={cn('mf-attachment-field', uploaderClassName)}>
        <AttachmentUploader layout={layout} className="au--form" {...uploaderProps} />
      </div>
    </FormField>
  );
}
