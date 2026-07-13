
import React, { useState } from 'react';
import { Button } from './Button';
import { CopyIcon, CheckCircle } from '../icons';

interface CodeBlockProps {
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <div className="bg-muted text-muted-foreground rounded-md relative group">
      <pre className="p-4 text-xs overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? (
            <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Copied!
            </>
        ) : (
            <>
                <CopyIcon className="h-4 w-4 mr-2" />
                Copy
            </>
        )}
      </Button>
    </div>
  );
};

export default CodeBlock;
