import React from "react";
import { marked } from "marked";

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface ReactMarkdownProps {
  children: string;
}

export function ReactMarkdown({ children }: ReactMarkdownProps) {
  const html = marked(children) as string;

  return (
    <div
      className="markdown-content space-y-3 text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

