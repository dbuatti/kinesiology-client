"use client";

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckSquare, Square, ChevronRight, Image as ImageIcon, Info, XCircle } from 'lucide-react';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { NotionBlock, NotionRichText, GetNotionPageContentPayload, GetNotionPageContentResponse } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'; // Import Card components
import { Badge } from './ui/badge'; // Import Badge component
import { Button } from './ui/button'; // Import Button component

interface NotionPageViewerProps {
  pageId: string | null;
  onClearSelection?: () => void;
}

const renderRichText = (richText: NotionRichText[]) => {
  return richText.map((text, i) => {
    const { annotations, text: textContent, href } = text;
    let element: React.ReactNode = textContent.content;

    if (annotations.bold) element = <strong>{element}</strong>;
    if (annotations.italic) element = <em>{element}</em>;
    if (annotations.strikethrough) element = <del>{element}</del>;
    if (annotations.underline) element = <u>{element}</u>;
    if (annotations.code) element = <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{element}</code>;
    if (annotations.color && annotations.color !== 'default') element = <span style={{ color: annotations.color }}>{element}</span>;

    if (href) {
      element = (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {element}
        </a>
      );
    }

    return <Fragment key={i}>{element}</Fragment>;
  });
};

const NotionPageViewer: React.FC<NotionPageViewerProps> = ({ pageId, onClearSelection }) => {
  const [internalPageTitle, setInternalPageTitle] = useState<string | null>(null);

  const {
    data: pageContent,
    loading,
    error,
    execute: fetchPageContent,
    isCached,
  } = useCachedEdgeFunction<GetNotionPageContentPayload, GetNotionPageContentResponse>(
    'get-notion-page-content',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: pageId ? `page:${pageId}` : undefined,
      cacheTtl: 120, // 2 hours cache for page content
      onSuccess: (data) => {
        console.log('[NotionPageViewer] Fetched page content:', data.title);
        setInternalPageTitle(data.title);
      },
      onError: (msg) => {
        console.error('[NotionPageViewer] Error fetching page content:', msg);
        setInternalPageTitle(null);
      },
    }
  );

  useEffect(() => {
    if (pageId) {
      setInternalPageTitle(null);
      fetchPageContent({ pageId });
    } else {
      setInternalPageTitle(null);
    }
  }, [pageId, fetchPageContent]);

  const renderBlock = (block: NotionBlock, index: number) => {
    switch (block.type) {
      case 'paragraph':
        return block.text && block.text.length > 0 ? (
          <p key={block.id} className="mb-2 text-gray-800 leading-relaxed">
            {renderRichText(block.text)}
          </p>
        ) : <p key={block.id} className="mb-2">&nbsp;</p>;
      case 'heading_1':
        return (
          <h1 key={block.id} className="text-3xl font-bold mt-6 mb-3 text-gray-900">
            {block.text && renderRichText(block.text)}
          </h1>
        );
      case 'heading_2':
        return (
          <h2 key={block.id} className="text-2xl font-semibold mt-5 mb-2 text-gray-800">
            {block.text && renderRichText(block.text)}
          </h2>
        );
      case 'heading_3':
        return (
          <h3 key={block.id} className="text-xl font-semibold mt-4 mb-1 text-gray-700">
            {block.text && renderRichText(block.text)}
          </h3>
        );
      case 'bulleted_list_item':
        return (
          <ul key={block.id} className="list-disc list-inside ml-4 mb-1 text-gray-700">
            <li>
              {block.text && renderRichText(block.text)}
              {block.children && block.children.map(renderBlock)}
            </li>
          </ul>
        );
      case 'numbered_list_item':
        return (
          <ol key={block.id} className="list-decimal list-inside ml-4 mb-1 text-gray-700">
            <li>
              {block.text && renderRichText(block.text)}
              {block.children && block.children.map(renderBlock)}
            </li>
          </ol>
        );
      case 'to_do':
        return (
          <div key={block.id} className="flex items-center mb-2 text-gray-700">
            {block.checked ? <CheckSquare className="w-5 h-5 mr-2 text-green-600" /> : <Square className="w-5 h-5 mr-2 text-gray-400" />}
            <span>{block.text && renderRichText(block.text)}</span>
          </div>
        );
      case 'toggle':
        return (
          <details key={block.id} className="mb-2 p-2 rounded-md bg-gray-50 border border-gray-200">
            <summary className="font-semibold cursor-pointer flex items-center text-gray-800">
              <ChevronRight className="w-4 h-4 mr-2 inline-block transform transition-transform duration-200 group-open:rotate-90" />
              {block.text && renderRichText(block.text)}
            </summary>
            <div className="pl-6 pt-2 border-l border-gray-300 ml-2">
              {block.children && block.children.map(renderBlock)}
            </div>
          </details>
        );
      case 'image':
        return (
          <div key={block.id} className="my-4">
            {block.url && (
              <img src={block.url} alt={block.caption?.[0]?.plain_text || 'Notion Image'} className="max-w-full h-auto rounded-lg shadow-sm" />
            )}
            {block.caption && block.caption.length > 0 && (
              <p className="text-sm text-gray-500 mt-1 text-center">{renderRichText(block.caption)}</p>
            )}
          </div>
        );
      case 'callout':
        const icon = block.icon?.emoji || (block.icon?.file?.url ? <img src={block.icon.file.url} alt="icon" className="w-5 h-5 mr-2 inline-block" /> : <Info className="w-5 h-5 mr-2" />);
        return (
          <div key={block.id} className={cn("p-3 my-3 rounded-lg border flex items-start", block.color === 'gray_background' ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-200')}>
            {icon}
            <div className="flex-1 text-gray-800">
              {block.text && renderRichText(block.text)}
              {block.children && block.children.map(renderBlock)}
            </div>
          </div>
        );
      case 'quote':
        return (
          <blockquote key={block.id} className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4">
            {block.text && renderRichText(block.text)}
          </blockquote>
        );
      case 'divider':
        return <hr key={block.id} className="my-6 border-t border-gray-200" />;
      case 'unsupported':
        return (
          <p key={block.id} className="text-sm text-red-500 italic my-2">
            [Unsupported Notion block type: {block.type}]
          </p>
        );
      default:
        return (
          <p key={block.id} className="text-sm text-gray-500 italic my-2">
            [Block type: {block.type}]
          </p>
        );
    }
  };

  if (!pageId) {
    return (
      <div className="text-center p-6 text-gray-500">
        <Info className="w-10 h-10 mx-auto mb-4" />
        <p>Select an item from another tab (e.g., a muscle, chakra, or channel) to view its Notion page details here.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-600">Loading Notion page...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600">
        <AlertCircle className="w-10 h-10 mx-auto mb-4" />
        <p className="font-semibold">Error loading Notion page:</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!pageContent || !pageContent.blocks || pageContent.blocks.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <ImageIcon className="w-10 h-10 mx-auto mb-4" />
        <p>No content found for this Notion page.</p>
      </div>
    );
  }

  return (
    <div className="notion-page-viewer max-h-[70vh] overflow-y-auto">
      <Card className="shadow-none border-none">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
            <Info className="w-6 h-6 text-indigo-600" />
            {internalPageTitle || "Notion Page"}
            {isCached && (
              <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
                Cached
              </Badge>
            )}
          </CardTitle>
          {onClearSelection && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {pageContent.blocks.map(renderBlock)}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotionPageViewer;