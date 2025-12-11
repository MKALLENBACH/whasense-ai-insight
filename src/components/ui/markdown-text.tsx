import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

const MarkdownText = ({ content, className }: MarkdownTextProps) => {
  // Convert markdown to HTML
  const formatMarkdown = (text: string): string => {
    return text
      // Bold: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br />');
  };

  // Sanitize the HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(formatMarkdown(content), {
    ALLOWED_TAGS: ['strong', 'em', 'br'],
    ALLOWED_ATTR: [],
  });

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MarkdownText;
