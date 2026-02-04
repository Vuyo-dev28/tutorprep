import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  // Cleanup function to fix nested markdown in HTML tags before rendering
  const cleanupContent = (text: string): string => {
    // Fix markdown bold/italic inside HTML tags
    // Pattern: <tag>**text**</tag> or <tag>*text*</tag>
    return text
      // Fix bold inside sup tags: <sup>**2**</sup> -> <sup><strong>2</strong></sup>
      // Also handles cases like **7**<sup>**2**</sup> -> **7**<sup><strong>2</strong></sup>
      .replace(/<sup>(\s*)\*\*([^*]+)\*\*(\s*)<\/sup>/g, '<sup>$1<strong>$2</strong>$3</sup>')
      .replace(/<sub>(\s*)\*\*([^*]+)\*\*(\s*)<\/sub>/g, '<sub>$1<strong>$2</strong>$3</sub>')
      // Fix italic inside sup/sub tags: <sup>*text*</sup> -> <sup><em>text</em></sup>
      .replace(/<sup>(\s*)\*([^*]+)\*(\s*)<\/sup>/g, '<sup>$1<em>$2</em>$3</sup>')
      .replace(/<sub>(\s*)\*([^*]+)\*(\s*)<\/sub>/g, '<sub>$1<em>$2</em>$3</sub>')
      // Fix bold inside span tags (but preserve color spans that already have proper formatting)
      .replace(/<span([^>]*)>(\s*)\*\*([^*]+)\*\*(\s*)<\/span>/g, (match, attrs, p1, p2, p3) => {
        // If it's a color span, keep the attributes and fix the content
        return `<span${attrs}>${p1}<strong>${p2}</strong>${p3}</span>`;
      })
      // Fix italic inside span tags
      .replace(/<span([^>]*)>(\s*)\*([^*]+)\*(\s*)<\/span>/g, (match, attrs, p1, p2, p3) => {
        return `<span${attrs}>${p1}<em>${p2}</em>${p3}</span>`;
      });
  };

  // Process content to extract and render LaTeX math expressions
  const renderWithMath = (text: string): React.ReactNode => {
    const cleaned = cleanupContent(text);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Match block math: $$...$$
    const blockMathRegex = /\$\$([^$]+)\$\$/g;
    // Match inline math: $...$ (but not $$)
    const inlineMathRegex = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;
    
    const mathMatches: Array<{ type: 'block' | 'inline'; start: number; end: number; content: string }> = [];
    
    // Find block math first
    let match;
    while ((match = blockMathRegex.exec(cleaned)) !== null) {
      mathMatches.push({
        type: 'block',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1].trim(),
      });
    }
    
    // Find inline math (excluding those inside block math)
    inlineMathRegex.lastIndex = 0;
    while ((match = inlineMathRegex.exec(cleaned)) !== null) {
      const isInsideBlock = mathMatches.some(
        (bm) => match!.index >= bm.start && match!.index < bm.end
      );
      if (!isInsideBlock) {
        mathMatches.push({
          type: 'inline',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1].trim(),
        });
      }
    }
    
    // Sort by position
    mathMatches.sort((a, b) => a.start - b.start);
    
    // Build result
    mathMatches.forEach((mathMatch, index) => {
      // Add text before this math expression
      if (mathMatch.start > lastIndex) {
        const textBefore = cleaned.substring(lastIndex, mathMatch.start);
        if (textBefore.trim()) {
          parts.push(
            <ReactMarkdown
              key={`text-${index}`}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {textBefore}
            </ReactMarkdown>
          );
        }
      }
      
      // Add the math expression
      try {
        if (mathMatch.type === 'block') {
          parts.push(
            <div key={`math-block-${index}`} className="my-4">
              <BlockMath math={mathMatch.content} />
            </div>
          );
        } else {
          parts.push(
            <InlineMath key={`math-inline-${index}`} math={mathMatch.content} />
          );
        }
      } catch (error) {
        // If KaTeX fails to parse, show the original
        parts.push(<span key={`math-error-${index}`}>${mathMatch.content}$</span>);
      }
      
      lastIndex = mathMatch.end;
    });
    
    // Add remaining text
    if (lastIndex < cleaned.length) {
      const remainingText = cleaned.substring(lastIndex);
      if (remainingText.trim()) {
        parts.push(
          <ReactMarkdown
            key="text-final"
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {remainingText}
          </ReactMarkdown>
        );
      }
    }
    
    return parts.length > 0 ? <>{parts}</> : <>{cleaned}</>;
  };

  const cleanedContent = cleanupContent(content);
  
  // Check if content contains LaTeX math expressions
  const hasMath = /\$\$?[^$]+\$\$?/.test(cleanedContent);
  
  // Markdown components configuration
  const markdownComponents = {
    // Customize paragraph styling
    p: ({ children }: any) => <p className="mb-3 last:mb-0">{children}</p>,
    // Customize strong (bold) styling
    strong: ({ children }: any) => <strong className="font-semibold text-gray-900">{children}</strong>,
    // Customize emphasis (italic) styling
    em: ({ children }: any) => <em className="italic text-gray-700">{children}</em>,
    // Customize code styling
    code: ({ children, className }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-gray-800">
            {children}
          </code>
        );
      }
      return (
        <code className="block px-4 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 overflow-x-auto">
          {children}
        </code>
      );
    },
    // Customize list styling
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="ml-2">{children}</li>,
    // Customize heading styling
    h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-bold mb-2 mt-3">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-semibold mb-2 mt-3">{children}</h3>,
    // Customize blockquote styling
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-blue-50 rounded-r">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className={`markdown-content ${className}`}>
      {hasMath ? (
        renderWithMath(content)
      ) : (
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={markdownComponents}
        >
          {cleanedContent}
        </ReactMarkdown>
      )}
      <style>{`
        .markdown-content span[style*="color"] {
          font-weight: 500;
        }
        .markdown-content code {
          font-family: 'Courier New', monospace;
        }
      `}</style>
    </div>
  );
}
